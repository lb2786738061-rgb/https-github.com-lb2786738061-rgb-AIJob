import jwt
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from app.middleware.auth import get_auth_context, resolve_token
from app.services.interview_session import process_interview_answer
from app.services.voice_service import (
    audio_to_data_url,
    is_voice_api_available,
    synthesize_speech,
    transcribe_audio,
)

router = APIRouter()


@router.post("/synthesize")
async def synthesize(body: dict, auth: dict = Depends(get_auth_context)):
    text = (body.get("text") or "").strip()
    lang = body.get("lang", "zh-CN")
    if not text:
        raise HTTPException(status_code=400, detail={"error": "text required"})

    if is_voice_api_available():
        try:
            audio = await synthesize_speech(text, lang)
            return {
                "text": text,
                "lang": lang,
                "audioUrl": audio_to_data_url(audio),
                "source": "server",
            }
        except Exception as exc:
            return {
                "text": text,
                "lang": lang,
                "audioUrl": None,
                "source": "client",
                "message": f"服务端 TTS 失败，请使用客户端播放: {exc}",
            }

    return {
        "text": text,
        "lang": lang,
        "audioUrl": None,
        "source": "client",
        "message": "未配置 OPENAI_API_KEY，使用客户端 TTS",
    }


@router.post("/transcribe")
async def transcribe(
    file: UploadFile | None = File(None),
    transcript: str = Form(""),
    auth: dict = Depends(get_auth_context),
):
    if transcript.strip():
        return {"text": transcript.strip(), "source": "client"}

    if file and is_voice_api_available():
        content = await file.read()
        if content:
            try:
                text = await transcribe_audio(content, file.filename or "audio.webm")
                return {"text": text, "source": "server"}
            except Exception as exc:
                raise HTTPException(
                    status_code=502,
                    detail={"error": f"语音识别失败: {exc}"},
                ) from exc

    return {
        "text": "",
        "source": "client",
        "message": "请上传音频文件，或通过 WebSocket 发送 transcript",
    }


@router.get("/status")
async def voice_status(auth: dict = Depends(get_auth_context)):
    server_voice = is_voice_api_available()
    return {
        "websocketPath": "/api/v1/voice/ws",
        "protocol": (
            "JSON: ping | {type:'answer', sessionId, text, elapsedSec} "
            "→ answer_result | {type:'question', text}"
        ),
        "serverStt": server_voice,
        "serverTts": server_voice,
        "relayEnabled": True,
    }


@router.websocket("/ws")
async def voice_websocket(websocket: WebSocket, token: str = Query("")):
    await websocket.accept()

    auth: dict | None = None
    if token:
        try:
            auth = await resolve_token(token)
        except HTTPException:
            await websocket.send_json({"type": "error", "text": "认证失败，请重新登录"})
            await websocket.close(code=4401)
            return

    await websocket.send_json(
        {
            "type": "connected",
            "text": "Voice WebSocket connected",
            "authenticated": auth is not None,
            "serverStt": is_voice_api_available(),
            "serverTts": is_voice_api_available(),
        }
    )

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg_type == "transcript" and data.get("text"):
                await websocket.send_json(
                    {"type": "transcript", "text": data["text"], "received": True}
                )
            elif msg_type == "answer":
                if not auth:
                    await websocket.send_json(
                        {"type": "error", "text": "未认证，请在连接 URL 附带 token 参数"}
                    )
                    continue

                session_id = data.get("sessionId")
                answer_text = (data.get("text") or "").strip()
                if not session_id or not answer_text:
                    await websocket.send_json(
                        {"type": "error", "text": "缺少 sessionId 或 text"}
                    )
                    continue

                try:
                    result = await process_interview_answer(
                        int(session_id),
                        auth,
                        answer_text,
                        message_type=data.get("messageType") or "voice",
                        elapsed_sec=int(data.get("elapsedSec") or 0),
                    )
                    await websocket.send_json(
                        {
                            "type": "answer_result",
                            "evaluation": result["evaluation"],
                            "nextQuestion": result.get("nextQuestion"),
                            "questionCount": result["questionCount"],
                            "isComplete": result["isComplete"],
                            "maxQuestions": result.get("maxQuestions"),
                            "elapsedSec": result["elapsedSec"],
                            "stage": result.get("stage"),
                            "techAgenda": result.get("techAgenda"),
                            "currentTech": result.get("currentTech"),
                        }
                    )
                    if result.get("nextQuestion"):
                        question_text = result["nextQuestion"]
                        await websocket.send_json(
                            {"type": "question", "text": question_text}
                        )
                        if is_voice_api_available():
                            try:
                                audio = await synthesize_speech(question_text)
                                await websocket.send_json(
                                    {
                                        "type": "question_audio",
                                        "audioUrl": audio_to_data_url(audio),
                                    }
                                )
                            except Exception:
                                pass
                except ValueError as exc:
                    await websocket.send_json({"type": "error", "text": str(exc)})
                except LookupError:
                    await websocket.send_json({"type": "error", "text": "会话不存在"})
                except PermissionError as exc:
                    await websocket.send_json(
                        {"type": "error", "text": str(exc), "code": "TIME_LIMIT"}
                    )
            elif msg_type == "question" and data.get("text"):
                await websocket.send_json({"type": "question", "text": data["text"]})
            else:
                await websocket.send_json(
                    {"type": "error", "text": "Unknown message type"}
                )
    except WebSocketDisconnect:
        pass
    except jwt.PyJWTError:
        await websocket.send_json({"type": "error", "text": "Invalid token"})
    except Exception:
        await websocket.send_json({"type": "error", "text": "Invalid JSON or server error"})
