import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
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
    generate_replacement_question,
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
from app.services.weak_questions import (
    delete_weak_question,
    get_user_exam_preferences,
    list_weak_questions,
    practice_weak_question,
    record_question_evaluation,
    update_preference_by_question_text,
    update_weak_question_preference,
)
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
        raise HTTPException(status_code=400, detail={"error": "请选择有效的面试官角色"})

    difficulty = body.get("difficulty") or "standard"
    if difficulty not in DIFFICULTIES:
        raise HTTPException(status_code=400, detail={"error": "请选择有效的面试难度"})

    # I-01：创建面试必须关联一份简历（无简历不可开场）
    resume_id = body.get("resumeId")
    if not resume_id:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "创建模拟面试必须关联一份简历，请先上传或选择一份简历",
                "code": "RESUME_REQUIRED",
            },
        )

    db = get_db()
    resume = db.execute(
        "SELECT * FROM user_resume WHERE id = ? AND user_id = ?",
        (resume_id, auth["userId"]),
    ).fetchone()
    if not resume:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "所选简历不存在或无权访问，请重新选择简历",
                "code": "RESUME_REQUIRED",
            },
        )

    ctx = load_resume_interview_context(resume)
    resume_brief = ctx["resumeBrief"]
    custom_jd = (body.get("jobDescription") or "").strip()
    job_description = custom_jd or ctx["jobDescription"]
    target_job_title = (body.get("targetJobTitle") or "").strip() or ctx["targetJobTitle"]
    experience_years = (body.get("experienceYears") or "").strip()

    # I-02：支持时长配置（5 / 15 / 30 分钟）
    duration_minutes = body.get("durationMinutes")
    try:
        dur_min = int(duration_minutes) if duration_minutes else 15
    except (TypeError, ValueError):
        dur_min = 15
    if dur_min not in (5, 15, 30):
        dur_min = 15
    duration_limit_sec = dur_min * 60

    tech_agenda: list = []
    if role == "technical":
        tech_agenda = (ctx.get("techAgenda") or [])[: max_questions_for_role(role)]

    exam_preferences = get_user_exam_preferences(auth["userId"], role)

    opening_question = await get_opening_question(
        role,
        resume_context=resume_brief,
        industry=body.get("industry"),
        job_description=job_description,
        target_job_title=target_job_title,
        difficulty=difficulty,
        resume_brief=resume_brief,
        tech_agenda=tech_agenda,
        experience_years=experience_years,
        exam_preferences=exam_preferences,
    )

    now = datetime.now(timezone.utc).isoformat()
    mode = body.get("mode", "text")
    cursor = db.execute(
        """INSERT INTO mock_interview_session (
            user_id, resume_id, interviewer_role, industry, mode,
            status, question_count, started_at, difficulty, target_job_title,
            experience_years, job_description, duration_limit_sec
        ) VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?, ?, ?, ?, ?)""",
        (
            auth["userId"],
            resume_id,
            role,
            body.get("industry"),
            mode,
            now,
            difficulty,
            target_job_title or None,
            experience_years or None,
            job_description or None,
            duration_limit_sec,
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

    return {
        "session": row_to_camel(session),
        "openingQuestion": opening_question,
        "maxQuestions": max_questions_for_role(role),
        "maxDurationSec": duration_limit_sec,
        "stage": get_interview_stage(1, role),
        "difficulty": difficulty,
        "targetJobTitle": target_job_title,
        "experienceYears": experience_years,
        "durationMinutes": dur_min,
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


@router.post("/sessions/{session_id}/swap-question")
async def swap_question(
    session_id: int,
    body: dict | None = None,
    auth: dict = Depends(get_auth_context),
):
    """当前未答题支持「换一题」，已答题不受影响（I-05）"""
    db = get_db()
    session = db.execute(
        "SELECT * FROM mock_interview_session WHERE id = ?", (session_id,)
    ).fetchone()
    if not session or session["user_id"] != auth["userId"]:
        raise HTTPException(status_code=404, detail={"error": "Not found"})
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail={"error": "面试已结束，无法换题"})

    messages = db.execute(
        "SELECT * FROM interview_messages WHERE session_id = ? ORDER BY id ASC",
        (session_id,),
    ).fetchall()
    if not messages or messages[-1]["role"] != "assistant":
        raise HTTPException(
            status_code=400,
            detail={"error": "当前题目已作答或无可替换题目，仅未答题可换一题"},
        )

    last_msg = messages[-1]
    current_question = last_msg["content"]
    asked_questions = [m["content"] for m in messages if m["role"] == "assistant"]
    client_excluded = (body or {}).get("excludedQuestions") or []
    if isinstance(client_excluded, list):
        asked_questions.extend(str(q) for q in client_excluded if q)

    ctx = resolve_session_context(session)
    main_count = max(1, count_main_questions(messages))
    new_question = await generate_replacement_question(
        session["interviewer_role"],
        current_question,
        asked_questions,
        question_index=main_count,
        resume_brief=ctx["resumeBrief"],
        industry=session["industry"],
        job_description=ctx["jobDescription"],
        target_job_title=ctx["targetJobTitle"],
        difficulty=ctx["difficulty"],
        tech_agenda=ctx.get("techAgenda") or [],
        experience_years=ctx.get("experienceYears") or "",
    )

    db.execute(
        "UPDATE interview_messages SET content = ? WHERE id = ?",
        (new_question, last_msg["id"]),
    )
    db.commit()

    return {
        "question": new_question,
        "messageId": last_msg["id"],
        "questionCount": session["question_count"] or main_count,
        "stage": get_interview_stage(main_count, session["interviewer_role"]),
    }


@router.get("/weak-questions")
async def get_weak_questions(
    status: str = Query("all"),
    role: str = Query(""),
    auth: dict = Depends(get_auth_context),
):
    """查询弱题复盘列表及统计（P-01：筛选错题 / 全部 / 已掌握）"""
    return list_weak_questions(auth["userId"], status_filter=status, role_filter=role)


@router.patch("/weak-questions/{item_id}")
async def patch_weak_question(
    item_id: int,
    body: dict,
    auth: dict = Depends(get_auth_context),
):
    """控制「下次是否再考」或手动切换掌握状态（A-03 / I-08）"""
    try:
        updated = update_weak_question_preference(
            auth["userId"],
            item_id,
            next_exam_enabled=body.get("nextExamEnabled"),
            status=body.get("status"),
        )
        return {"item": updated}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from None


@router.post("/weak-questions/by-question/preference")
async def set_preference_by_question(
    body: dict,
    auth: dict = Depends(get_auth_context),
):
    """在面试中或报告页按题目文本快捷切换「下次再出」开关"""
    question = str(body.get("question") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail={"error": "题目不能为空"})
    next_exam = bool(body.get("nextExamEnabled"))
    updated = update_preference_by_question_text(auth["userId"], question, next_exam)
    if not updated:
        raise HTTPException(status_code=404, detail={"error": "未找到对应的答题记录"})
    return {"item": updated}


@router.post("/weak-questions/{item_id}/practice")
async def practice_weak_question_route(
    item_id: int,
    body: dict,
    auth: dict = Depends(get_auth_context),
):
    """弱题复盘页：对照练习并再次评估，达标自动回写掌握状态（P-02）"""
    try:
        return await practice_weak_question(
            auth["userId"],
            item_id,
            str(body.get("answer") or ""),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from None


@router.delete("/weak-questions/{item_id}")
async def remove_weak_question(
    item_id: int,
    auth: dict = Depends(get_auth_context),
):
    delete_weak_question(auth["userId"], item_id)
    return {"ok": True}


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
            q_text = messages[i]["content"]
            a_text = messages[i + 1]["content"]
            eval_json = messages[i + 1]["score_json"]
            if eval_json:
                evaluation = json.loads(eval_json)
            else:
                evaluation = await evaluate_answer(
                    q_text,
                    a_text,
                    eval_role,
                    resume_brief=ctx["resumeBrief"],
                    job_description=ctx["jobDescription"],
                    target_job_title=ctx["targetJobTitle"],
                    difficulty=ctx["difficulty"],
                )
            # 查询或补录该题在错题本中的最新偏好与状态
            existing_weak = db.execute(
                """SELECT id, status, next_exam_enabled, score_overall
                   FROM interview_weak_questions
                   WHERE user_id = ? AND question = ?
                   ORDER BY id DESC LIMIT 1""",
                (auth["userId"], q_text.strip()),
            ).fetchone()
            if existing_weak:
                weak_meta = {
                    "weakQuestionId": existing_weak["id"],
                    "status": existing_weak["status"],
                    "nextExamEnabled": bool(existing_weak["next_exam_enabled"]),
                    "overallScore": existing_weak["score_overall"],
                }
            else:
                weak_meta = record_question_evaluation(
                    user_id=auth["userId"],
                    session_id=session_id,
                    resume_id=session["resume_id"],
                    question=q_text,
                    answer=a_text,
                    evaluation=evaluation,
                    interviewer_role=session["interviewer_role"],
                    target_job_title=ctx["targetJobTitle"],
                )
            qa_pairs.append(
                {
                    "question": q_text,
                    "answer": a_text,
                    "evaluation": evaluation,
                    "weakMeta": weak_meta,
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


@router.get("/stats/trend")
async def get_interview_trend(auth: dict = Depends(get_auth_context)):
    db = get_db()
    rows = db.execute(
        """SELECT id, interviewer_role, target_job_title,
                  score_logic, score_professional, score_expression, score_match, score_confidence,
                  total_duration_sec, started_at, ended_at
           FROM mock_interview_session
           WHERE user_id = ? AND status = 'completed'
           ORDER BY started_at ASC
           LIMIT 15""",
        (auth["userId"],),
    ).fetchall()

    trends = rows_to_camel(rows)
    for item in trends:
        scores = [
            item.get("scoreLogic") or 0,
            item.get("scoreProfessional") or 0,
            item.get("scoreExpression") or 0,
            item.get("scoreMatch") or 0,
        ]
        valid = [s for s in scores if s > 0]
        item["scoreOverall"] = round(sum(valid) / len(valid)) if valid else 0

    avg_score = 0
    improvement = 0
    if trends:
        scores = [t["scoreOverall"] for t in trends]
        avg_score = round(sum(scores) / len(scores), 1)
        if len(scores) >= 2:
            improvement = scores[-1] - scores[0]

    return {
        "trends": trends,
        "totalCompleted": len(trends),
        "averageScore": avg_score,
        "improvement": improvement,
    }

