import json
from datetime import datetime, timezone

from app.services import catalog as catalog_service
from app.db.connection import get_db
from app.services import quota as quota_service
from app.services.interview_engine import (
    FREE_MAX_DURATION_SEC,
    MAX_ENTERPRISE_PROBES,
    MAX_QUESTIONS,
    SKIPPED_ANSWER_TEXT,
    count_main_questions,
    evaluate_answer,
    generate_follow_up_question,
    get_interview_stage,
    is_probe_question,
    load_resume_interview_context,
    max_questions_for_role,
    plan_next_question_action,
    should_insert_probe,
)
from app.services.tech_interview import public_tech_agenda, tech_slot_for
from app.services.weak_questions import (
    get_user_exam_preferences,
    record_question_evaluation,
)


def _session_value(session, key: str, default=None):
    try:
        value = session[key]
    except (KeyError, IndexError):
        return default
    return default if value is None else value


def resolve_session_context(session) -> dict:
    db = get_db()
    difficulty = str(_session_value(session, "difficulty") or "standard")
    target_job = str(_session_value(session, "target_job_title") or "")
    experience_years = str(_session_value(session, "experience_years") or "")
    session_jd = str(_session_value(session, "job_description") or "")
    duration_limit_sec = _session_value(session, "duration_limit_sec")
    resume_brief = ""
    job_description = session_jd
    tech_agenda: list = []
    tech_stack: list = []
    if session["resume_id"]:
        resume = db.execute(
            "SELECT * FROM user_resume WHERE id = ?", (session["resume_id"],)
        ).fetchone()
        if resume:
            ctx = load_resume_interview_context(resume)
            resume_brief = ctx["resumeBrief"]
            job_description = session_jd or ctx["jobDescription"]
            target_job = target_job or ctx["targetJobTitle"]
            role = session["interviewer_role"] or ""
            if role == "technical" or role.startswith("enterprise:"):
                limit = max_questions_for_role("technical")
                tech_agenda = (ctx.get("techAgenda") or [])[:limit]
                tech_stack = ctx.get("techStack") or []
    return {
        "difficulty": difficulty,
        "targetJobTitle": target_job,
        "experienceYears": experience_years,
        "durationLimitSec": int(duration_limit_sec) if duration_limit_sec else None,
        "resumeBrief": resume_brief,
        "jobDescription": job_description,
        "techAgenda": tech_agenda,
        "techStack": tech_stack,
    }


def _probe_used(messages) -> int:
    if not messages:
        return 0
    return sum(
        1
        for m in messages
        if m["role"] == "assistant" and is_probe_question(m["content"])
    )


def resolve_max_questions(session, messages=None) -> int:
    role = session["interviewer_role"] or ""
    probes = min(_probe_used(messages), MAX_ENTERPRISE_PROBES)
    if role.startswith("enterprise:"):
        company_id = role.replace("enterprise:", "", 1)
        company = catalog_service.get_enterprise_company(company_id)
        bank_len = len(company["questions"]) if company else MAX_QUESTIONS
        return bank_len + probes
    base = max_questions_for_role(role)
    if role == "technical":
        return base + probes
    return base


async def process_interview_answer(
    session_id: int,
    auth: dict,
    answer: str,
    *,
    message_type: str | None = None,
    elapsed_sec: int = 0,
    skipped: bool = False,
) -> dict:
    user_id = auth["userId"]
    answer_text = SKIPPED_ANSWER_TEXT if skipped else (answer or "").strip()
    if not skipped and not answer_text:
        raise ValueError("回答不能为空")

    db = get_db()
    session = db.execute(
        "SELECT * FROM mock_interview_session WHERE id = ?", (session_id,)
    ).fetchone()
    if not session or session["user_id"] != user_id:
        raise LookupError("Session not found")
    if session["status"] != "active":
        raise ValueError("Session ended")

    paid = await quota_service.is_paid(auth)
    is_enterprise = session["interviewer_role"].startswith("enterprise:")
    if not is_enterprise and not paid and elapsed_sec >= FREE_MAX_DURATION_SEC:
        raise PermissionError("免费面试时长已达 5 分钟上限")

    messages = db.execute(
        "SELECT * FROM interview_messages WHERE session_id = ? ORDER BY created_at",
        (session_id,),
    ).fetchall()

    last_question = next(
        (m for m in reversed(messages) if m["role"] == "assistant"), None
    )
    if not last_question:
        raise ValueError("No question found")

    ctx = resolve_session_context(session)
    eval_role = "technical" if is_enterprise else session["interviewer_role"]
    persona_note = ""
    company = None
    if is_enterprise:
        company_id = session["interviewer_role"].replace("enterprise:", "", 1)
        company = catalog_service.get_enterprise_company(company_id)
        if company:
            persona_note = f"你是{company['name']}面试官，按该公司面试风格评估。"

    asked_all = sum(1 for m in messages if m["role"] == "assistant")
    asked_main = count_main_questions(messages)
    probe_used = _probe_used(messages)
    last_was_probe = is_probe_question(last_question["content"])
    current_slot = tech_slot_for(
        ctx.get("techAgenda") or [], asked_main, probe=last_was_probe
    )
    evaluation = await evaluate_answer(
        last_question["content"],
        answer_text,
        eval_role,
        resume_brief=ctx["resumeBrief"],
        job_description=ctx["jobDescription"],
        target_job_title=ctx["targetJobTitle"],
        difficulty="hard" if is_enterprise else ctx["difficulty"],
        skipped=skipped,
        persona_note=persona_note,
        tech_slot=current_slot,
    )

    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        """INSERT INTO interview_messages
           (session_id, role, content, message_type, score_json, created_at)
           VALUES (?, 'user', ?, ?, ?, ?)""",
        (
            session_id,
            answer_text,
            message_type or session["mode"],
            json.dumps(evaluation, ensure_ascii=False),
            now,
        ),
    )

    # 自动同步本题评估至弱题复盘/错题本（<70分默认进弱题且开启下次再考，>=70分默认已掌握且由用户勾选是否再出）
    try:
        weak_record = record_question_evaluation(
            user_id=user_id,
            session_id=session_id,
            resume_id=session["resume_id"],
            question=last_question["content"],
            answer=answer_text,
            evaluation=evaluation,
            interviewer_role=session["interviewer_role"],
            target_job_title=ctx["targetJobTitle"],
            skipped=skipped,
        )
    except Exception:
        weak_record = None

    history = [
        {"role": m["role"], "content": m["content"]}
        for m in messages
        if m["role"] in ("user", "assistant")
    ] + [{"role": "user", "content": answer_text}]

    session_limit_sec = ctx.get("durationLimitSec")
    effective_limit_sec = session_limit_sec or (None if paid else FREE_MAX_DURATION_SEC)
    time_exceeded = (
        not is_enterprise
        and effective_limit_sec is not None
        and elapsed_sec >= effective_limit_sec
    )

    try:
        exam_preferences = get_user_exam_preferences(user_id, session["interviewer_role"])
    except Exception:
        exam_preferences = None

    next_question = None
    next_is_probe = False
    if not time_exceeded:
        if is_enterprise:
            next_question = await _next_enterprise_question(
                session,
                company,
                messages,
                history,
                evaluation,
                answer_text,
                ctx,
            )
            next_is_probe = bool(next_question) and is_probe_question(next_question)
        else:
            role_id = session["interviewer_role"]
            action = plan_next_question_action(
                asked_main=asked_main,
                max_questions=max_questions_for_role(role_id),
                last_was_probe=last_was_probe,
                probe_used=probe_used,
                allow_probe=role_id == "technical",
                evaluation=evaluation,
                answer=answer_text,
            )
            if action in ("probe", "next"):
                next_is_probe = action == "probe"
                next_question = await generate_follow_up_question(
                    role_id,
                    history,
                    resume_context=ctx["resumeBrief"],
                    industry=session["industry"],
                    job_description=ctx["jobDescription"],
                    target_job_title=ctx["targetJobTitle"],
                    difficulty=ctx["difficulty"],
                    resume_brief=ctx["resumeBrief"],
                    last_evaluation=evaluation,
                    probe=next_is_probe,
                    tech_agenda=ctx.get("techAgenda") or [],
                    experience_years=ctx.get("experienceYears") or "",
                    exam_preferences=exam_preferences,
                )

        if next_question:
            db.execute(
                """INSERT INTO interview_messages
                   (session_id, role, content, message_type, created_at)
                   VALUES (?, 'assistant', ?, ?, ?)""",
                (
                    session_id,
                    next_question,
                    session["mode"],
                    datetime.now(timezone.utc).isoformat(),
                ),
            )

    issued = asked_all + (1 if next_question else 0)
    db.execute(
        "UPDATE mock_interview_session SET question_count = ? WHERE id = ?",
        (issued, session_id),
    )
    db.commit()

    if next_question:
        current_index = asked_main if next_is_probe else asked_main + 1
    else:
        current_index = max(asked_main, 1)
    follow_on = (
        [{"role": "assistant", "content": next_question}] if next_question else []
    )
    max_q = resolve_max_questions(session, list(messages) + follow_on)
    is_complete = next_question is None or time_exceeded
    stage = get_interview_stage(current_index, session["interviewer_role"])
    display_slot = tech_slot_for(
        ctx.get("techAgenda") or [],
        current_index,
        probe=next_is_probe or (not next_question and last_was_probe),
    )

    return {
        "evaluation": evaluation,
        "weakQuestionRecord": weak_record,
        "nextQuestion": next_question,
        "questionCount": issued,
        "isComplete": is_complete,
        "maxQuestions": max_q,
        "elapsedSec": elapsed_sec,
        "stage": stage,
        "skipped": skipped,
        "techAgenda": public_tech_agenda(ctx.get("techAgenda") or []),
        "currentTech": (
            {
                "index": display_slot["index"],
                "tech": display_slot["tech"],
                "techId": display_slot["techId"],
                "dimension": display_slot["dimension"],
                "label": display_slot["label"],
            }
            if display_slot
            else None
        ),
    }


async def _next_enterprise_question(
    session,
    company,
    messages,
    history: list[dict[str, str]],
    evaluation: dict,
    answer_text: str,
    ctx: dict,
) -> str | None:
    if not company:
        return None
    bank = company["questions"]
    assistant_msgs = [m for m in messages if m["role"] == "assistant"]
    bank_asked = sum(1 for m in assistant_msgs if not is_probe_question(m["content"]))
    probe_used = sum(1 for m in assistant_msgs if is_probe_question(m["content"]))
    last_was_probe = bool(assistant_msgs) and is_probe_question(assistant_msgs[-1]["content"])

    if (
        not last_was_probe
        and should_insert_probe(evaluation, answer_text, probe_used)
    ):
        return await generate_follow_up_question(
            "technical",
            history,
            resume_context=ctx["resumeBrief"],
            industry=session["industry"],
            job_description=ctx["jobDescription"],
            target_job_title=ctx["targetJobTitle"] or company.get("name", ""),
            difficulty="hard",
            resume_brief=ctx["resumeBrief"],
            last_evaluation=evaluation,
            probe=True,
            tech_agenda=ctx.get("techAgenda") or [],
        )

    if bank_asked < len(bank):
        return f"【{company['name']}】{bank[bank_asked]}"
    return None
