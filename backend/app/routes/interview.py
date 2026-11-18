import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.config import UPLOAD_DIR
from app.services import catalog as catalog_service
from app.db.connection import get_db
from app.middleware.auth import get_auth_context
from app.services import quota as quota_service
from app.services.interview_engine import (
    DIFFICULTIES,
    FREE_MAX_DURATION_SEC,
    INTERVIEWER_ROLES,
    build_session_report,
    count_main_questions,
    evaluate_answer,
    generate_answer_hint,
    get_interview_stage,
    get_opening_question,
    is_probe_question,
    load_resume_interview_context,
    max_questions_for_role,
)
from app.services.interview_session import (
    process_interview_answer,
    resolve_max_questions,
    resolve_session_context,
)
from app.services.tech_interview import public_tech_agenda, tech_slot_for
from app.services.transcript import build_transcript_report
from app.utils import row_to_camel, rows_to_camel

router = APIRouter()
recording_dir = Path(UPLOAD_DIR) / "recordings"
recording_dir.mkdir(parents=True, exist_ok=True)


def _public_slot(slot: dict | None) -> dict | None:
    if not slot:
        return None
    return {
        "index": slot["index"],
        "tech": slot["tech"],
        "techId": slot.get("techId"),
        "dimension": slot["dimension"],
        "label": slot["label"],
    }


@router.get("/roles")
async def list_roles():
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "description": r["description"],
            "focus": r.get("focus") or [],
        }
        for r in INTERVIEWER_ROLES.values()
    ]


@router.get("/difficulties")
async def list_difficulties():
    return [
        {
            "id": item["id"],
            "name": item["name"],
            "description": item["description"],
        }
        for item in DIFFICULTIES.values()
    ]


@router.get("/industries")
async def list_industries():
    return catalog_service.list_industries()


@router.get("/enterprise/companies")
async def list_companies():
    return catalog_service.list_enterprise_companies()


@router.get("/sessions")
async def list_sessions(auth: dict = Depends(get_auth_context)):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM mock_interview_session WHERE user_id = ? ORDER BY started_at DESC",
        (auth["userId"],),
    ).fetchall()
    return rows_to_camel(rows)


@router.get("/sessions/{session_id}")
async def get_session(session_id: int, auth: dict = Depends(get_auth_context)):
    db = get_db()
    session = db.execute(
        "SELECT * FROM mock_interview_session WHERE id = ?", (session_id,)
    ).fetchone()
    if not session or session["user_id"] != auth["userId"]:
        raise HTTPException(status_code=404, detail={"error": "Not found"})

    messages = db.execute(
        "SELECT * FROM interview_messages WHERE session_id = ? ORDER BY created_at",
        (session_id,),
    ).fetchall()

    assistant_msgs = [m for m in messages if m["role"] == "assistant"]
    main_count = count_main_questions(messages)
    last_probe = bool(assistant_msgs) and is_probe_question(assistant_msgs[-1]["content"])
    ctx = resolve_session_context(session)
    return {
        "session": row_to_camel(session),
        "messages": rows_to_camel(messages),
        "stage": get_interview_stage(max(main_count, 1), session["interviewer_role"]),
        "maxQuestions": resolve_max_questions(session, messages),
        "techAgenda": public_tech_agenda(ctx.get("techAgenda") or []),
        "currentTech": _public_slot(
            tech_slot_for(ctx.get("techAgenda") or [], max(main_count, 1), probe=last_probe)
        ),
    }


@router.post("/sessions")
async def start_session(body: dict, auth: dict = Depends(get_auth_context)):
    quota_check = await quota_service.check_interview_quota(auth)
    if not quota_check["allowed"]:
        raise HTTPException(
            status_code=403,
            detail={"error": quota_check["message"], "code": "QUOTA_EXCEEDED"},
        )

    role = body.get("interviewerRole")
    if role not in INTERVIEWER_ROLES:
        raise HTTPException(status_code=400, detail={"error": "Invalid interviewer role"})

    difficulty = body.get("difficulty") or "standard"
    if difficulty not in DIFFICULTIES:
        raise HTTPException(status_code=400, detail={"error": "Invalid difficulty"})

    resume_brief = ""
    job_description = ""
    target_job_title = (body.get("targetJobTitle") or "").strip()
    resume_id = body.get("resumeId")
    tech_agenda: list = []
    if resume_id:
        db = get_db()
        resume = db.execute(
            "SELECT * FROM user_resume WHERE id = ?", (resume_id,)
        ).fetchone()
        if resume:
            ctx = load_resume_interview_context(resume)
            resume_brief = ctx["resumeBrief"]
            job_description = ctx["jobDescription"]
            target_job_title = target_job_title or ctx["targetJobTitle"]
            if role == "technical":
                tech_agenda = (ctx.get("techAgenda") or [])[: max_questions_for_role(role)]

    opening_question = await get_opening_question(
        role,
        resume_context=resume_brief,
        industry=body.get("industry"),
        job_description=job_description,
        target_job_title=target_job_title,
        difficulty=difficulty,
        resume_brief=resume_brief,
        tech_agenda=tech_agenda,
    )

    now = datetime.now(timezone.utc).isoformat()
    mode = body.get("mode", "text")
    db = get_db()
    cursor = db.execute(
        """INSERT INTO mock_interview_session (
            user_id, resume_id, interviewer_role, industry, mode,
            status, question_count, started_at, difficulty, target_job_title
        ) VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?, ?)""",
        (
            auth["userId"],
            resume_id,
            role,
            body.get("industry"),
            mode,
            now,
            difficulty,
            target_job_title or None,
        ),
    )
    session_id = cursor.lastrowid

    db.execute(
        """INSERT INTO interview_messages (session_id, role, content, message_type, created_at)
           VALUES (?, 'assistant', ?, ?, ?)""",
        (session_id, opening_question, "voice" if mode == "voice" else "text", now),
    )
    db.commit()

    session = db.execute(
        "SELECT * FROM mock_interview_session WHERE id = ?", (session_id,)
    ).fetchone()

    paid = await quota_service.is_paid(auth)

    return {
        "session": row_to_camel(session),
        "openingQuestion": opening_question,
        "maxQuestions": max_questions_for_role(role),
        "maxDurationSec": None if paid else FREE_MAX_DURATION_SEC,
        "stage": get_interview_stage(1, role),
        "difficulty": difficulty,
        "targetJobTitle": target_job_title,
        "techAgenda": public_tech_agenda(tech_agenda),
        "currentTech": _public_slot(tech_slot_for(tech_agenda, 1)),
    }


@router.post("/enterprise/sessions")
async def start_enterprise_session(body: dict, auth: dict = Depends(get_auth_context)):
    quota_check = await quota_service.check_enterprise_quota(auth)
    if not quota_check["allowed"]:
        raise HTTPException(
            status_code=403,
            detail={"error": quota_check["message"], "code": "QUOTA_EXCEEDED"},
        )

    company = catalog_service.get_enterprise_company(body.get("companyId", ""))
    if not company:
        raise HTTPException(status_code=404, detail={"error": "Company not found"})

    resume_id = body.get("resumeId")
    target_job_title = company["name"]
    if resume_id:
        db = get_db()
        resume = db.execute(
            "SELECT * FROM user_resume WHERE id = ?", (resume_id,)
        ).fetchone()
        if resume:
            ctx = load_resume_interview_context(resume)
            target_job_title = ctx["targetJobTitle"] or company["name"]

    opening_question = company["questions"][0]
    now = datetime.now(timezone.utc).isoformat()
    db = get_db()
    cursor = db.execute(
        """INSERT INTO mock_interview_session (
            user_id, resume_id, interviewer_role, industry, mode,
            status, question_count, started_at, difficulty, target_job_title
        ) VALUES (?, ?, ?, ?, 'text', 'active', 1, ?, 'hard', ?)""",
        (
            auth["userId"],
            resume_id,
            f"enterprise:{company['id']}",
            company["industry"],
            now,
            target_job_title,
        ),
    )
    session_id = cursor.lastrowid

    db.execute(
        """INSERT INTO interview_messages (session_id, role, content, message_type, created_at)
           VALUES (?, 'assistant', ?, 'text', ?)""",
        (session_id, f"【{company['name']}名企冲刺】{opening_question}", now),
    )
    db.commit()

    session = db.execute(
        "SELECT * FROM mock_interview_session WHERE id = ?", (session_id,)
    ).fetchone()
    await quota_service.consume_enterprise_session(auth, session_id)

    return {
        "session": row_to_camel(session),
        "company": {"id": company["id"], "name": company["name"]},
        "openingQuestion": opening_question,
        "totalQuestions": len(company["questions"]),
        "maxQuestions": len(company["questions"]),
        "stage": get_interview_stage(1, session["interviewer_role"]),
    }


@router.post("/sessions/{session_id}/answer")
async def submit_answer(
    session_id: int, body: dict, auth: dict = Depends(get_auth_context)
):
    try:
        return await process_interview_answer(
            session_id,
            auth,
            body.get("answer", ""),
            message_type=body.get("messageType"),
            elapsed_sec=body.get("elapsedSec", 0),
            skipped=bool(body.get("skipped")),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
    except LookupError:
        raise HTTPException(status_code=404, detail={"error": "Not found"}) from None
    except PermissionError as exc:
        raise HTTPException(
            status_code=403,
            detail={"error": str(exc), "code": "TIME_LIMIT"},
        ) from exc


@router.post("/sessions/{session_id}/hint")
async def session_hint(session_id: int, auth: dict = Depends(get_auth_context)):
    db = get_db()
    session = db.execute(
        "SELECT * FROM mock_interview_session WHERE id = ?", (session_id,)
    ).fetchone()
    if not session or session["user_id"] != auth["userId"]:
        raise HTTPException(status_code=404, detail={"error": "Not found"})
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail={"error": "Session ended"})

    last_question = db.execute(
        """SELECT content FROM interview_messages
           WHERE session_id = ? AND role = 'assistant'
           ORDER BY created_at DESC LIMIT 1""",
        (session_id,),
    ).fetchone()
    if not last_question:
        raise HTTPException(status_code=400, detail={"error": "No question found"})

    ctx = resolve_session_context(session)
    role = session["interviewer_role"]
    if role.startswith("enterprise:"):
        role = "technical"
    return await generate_answer_hint(
        last_question["content"],
        role,
        resume_brief=ctx["resumeBrief"],
        difficulty=ctx["difficulty"],
    )


@router.post("/sessions/{session_id}/recording")
async def upload_recording(
    session_id: int,
    recording: UploadFile = File(...),
    auth: dict = Depends(get_auth_context),
):
    db = get_db()
    session = db.execute(
        "SELECT * FROM mock_interview_session WHERE id = ?", (session_id,)
    ).fetchone()
    if not session or session["user_id"] != auth["userId"]:
        raise HTTPException(status_code=404, detail={"error": "Not found"})

    content = await recording.read()
    file_name = f"{uuid.uuid4()}.webm"
    file_path = recording_dir / file_name
    file_path.write_bytes(content)

    db.execute(
        "UPDATE mock_interview_session SET recording_path = ? WHERE id = ?",
        (str(file_path), session_id),
    )
    db.commit()

    return {
        "recordingUrl": f"/api/v1/interviews/sessions/{session_id}/recording"
    }


@router.get("/sessions/{session_id}/recording")
async def get_recording(session_id: int, auth: dict = Depends(get_auth_context)):
    db = get_db()
    session = db.execute(
        "SELECT * FROM mock_interview_session WHERE id = ?", (session_id,)
    ).fetchone()
    if not session or session["user_id"] != auth["userId"]:
        raise HTTPException(status_code=404, detail={"error": "Not found"})
    if not session["recording_path"]:
        raise HTTPException(status_code=404, detail={"error": "No recording"})

    return FileResponse(session["recording_path"], media_type="audio/webm")


@router.post("/sessions/{session_id}/end")
async def end_session(
    session_id: int, body: dict, auth: dict = Depends(get_auth_context)
):
    db = get_db()
    session = db.execute(
        "SELECT * FROM mock_interview_session WHERE id = ?", (session_id,)
    ).fetchone()
    if not session or session["user_id"] != auth["userId"]:
        raise HTTPException(status_code=404, detail={"error": "Not found"})

    if session["status"] == "completed":
        report = json.loads(session["report_json"]) if session["report_json"] else None
        return {"session": row_to_camel(session), "report": report}

    is_enterprise = session["interviewer_role"].startswith("enterprise:")
    messages = db.execute(
        "SELECT * FROM interview_messages WHERE session_id = ? ORDER BY created_at",
        (session_id,),
    ).fetchall()
    ctx = resolve_session_context(session)
    eval_role = "technical" if is_enterprise else session["interviewer_role"]

    qa_pairs = []
    for i in range(len(messages) - 1):
        if messages[i]["role"] == "assistant" and messages[i + 1]["role"] == "user":
            eval_json = messages[i + 1]["score_json"]
            if eval_json:
                evaluation = json.loads(eval_json)
            else:
                evaluation = await evaluate_answer(
                    messages[i]["content"],
                    messages[i + 1]["content"],
                    eval_role,
                    resume_brief=ctx["resumeBrief"],
                    job_description=ctx["jobDescription"],
                    target_job_title=ctx["targetJobTitle"],
                    difficulty=ctx["difficulty"],
                )
            qa_pairs.append(
                {
                    "question": messages[i]["content"],
                    "answer": messages[i + 1]["content"],
                    "evaluation": evaluation,
                }
            )

    transcript = build_transcript_report(qa_pairs)
    recording_url = (
        f"/api/v1/interviews/sessions/{session_id}/recording"
        if session["recording_path"]
        else None
    )
    report = build_session_report(qa_pairs, transcript, recording_url)
    now = datetime.now(timezone.utc).isoformat()

    db.execute(
        """UPDATE mock_interview_session SET
            status = 'completed', total_duration_sec = ?,
            score_logic = ?, score_professional = ?, score_expression = ?,
            score_match = ?, score_confidence = ?,
            feedback_summary = ?, report_json = ?, ended_at = ?
        WHERE id = ?""",
        (
            body.get("durationSec") or session["total_duration_sec"] or 0,
            report["scoreLogic"],
            report["scoreProfessional"],
            report["scoreExpression"],
            report["scoreMatch"],
            report["scoreConfidence"],
            report["feedbackSummary"],
            json.dumps(report, ensure_ascii=False),
            now,
            session_id,
        ),
    )
    db.commit()

    if not is_enterprise:
        await quota_service.consume_interview_session(auth, session_id)

    updated = db.execute(
        "SELECT * FROM mock_interview_session WHERE id = ?", (session_id,)
    ).fetchone()

    return {"session": row_to_camel(updated), "report": report}
