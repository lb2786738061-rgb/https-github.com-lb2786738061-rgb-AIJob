import base64
import logging

import httpx

from app.config import OPENAI_API_KEY, OPENAI_BASE_URL
from app.services.llm import _get_ssl_context

logger = logging.getLogger(__name__)


def is_voice_api_available() -> bool:
    return bool(OPENAI_API_KEY)


def _api_root() -> str:
    base = OPENAI_BASE_URL.rstrip("/")
    if base.endswith("/chat/completions"):
        base = base[: -len("/chat/completions")]
    return base


async def transcribe_audio(content: bytes, filename: str = "audio.webm") -> str:
    if not OPENAI_API_KEY:
        raise RuntimeError("未配置 OPENAI_API_KEY，无法使用服务端语音识别")

    url = f"{_api_root()}/audio/transcriptions"
    files = {"file": (filename, content, "application/octet-stream")}
    data = {"model": "whisper-1", "language": "zh"}

    async with httpx.AsyncClient(timeout=60, verify=_get_ssl_context()) as client:
        response = await client.post(
            url,
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            files=files,
            data=data,
        )
        response.raise_for_status()
        payload = response.json()
        return (payload.get("text") or "").strip()


async def synthesize_speech(text: str, lang: str = "zh-CN") -> bytes:
    if not OPENAI_API_KEY:
        raise RuntimeError("未配置 OPENAI_API_KEY，无法使用服务端 TTS")

    url = f"{_api_root()}/audio/speech"
    voice = "alloy" if lang.startswith("en") else "nova"
    body = {
        "model": "tts-1",
        "input": text[:4096],
        "voice": voice,
        "response_format": "mp3",
    }

    async with httpx.AsyncClient(timeout=60, verify=_get_ssl_context()) as client:
        response = await client.post(
            url,
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            json=body,
        )
        response.raise_for_status()
        return response.content


def audio_to_data_url(content: bytes, mime: str = "audio/mpeg") -> str:
    encoded = base64.b64encode(content).decode("ascii")
    return f"data:{mime};base64,{encoded}"
