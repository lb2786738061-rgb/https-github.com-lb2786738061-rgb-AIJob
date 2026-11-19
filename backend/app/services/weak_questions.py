import json
from datetime import datetime, timezone
from typing import Any

from app.db.connection import get_db
from app.services.interview_engine import evaluate_answer, load_resume_interview_context
from app.utils import row_to_camel

WEAK_SCORE_THRESHOLD = 70


def compute_question_overall_score(evaluation: dict[str, Any]) -> int:
    """根据逻辑、专业、匹配、表达四维得分计算单题综合分"""
    logic = int(evaluation.get("scoreLogic") or 0)
    prof = int(evaluation.get("scoreProfessional") or 0)
    match = int(evaluation.get("scoreMatch") or 0)
    expr = int(evaluation.get("scoreExpression") or 0)
    return round(logic * 0.25 + prof * 0.30 + match * 0.25 + expr * 0.20)


def build_deduction_notes(evaluation: dict[str, Any]) -> str:
    """整理单题扣分说明"""
    missed = [str(x).strip() for x in (evaluation.get("missedPoints") or []) if str(x).strip()]
    feedback = str(evaluation.get("feedback") or "").strip()
    parts: list[str] = []
    if missed:
        parts.append("扣分项：" + "；".join(missed))
    if feedback:
        parts.append("点评：" + feedback)
    return "\n".join(parts) if parts else "表达尚有提升空间"


def record_question_evaluation(
    *,
    user_id: int,
    session_id: int | None,
    resume_id: int | None,
    question: str,
    answer: str,
    evaluation: dict[str, Any],
    interviewer_role: str,
    target_job_title: str = "",
    skipped: bool = False,
) -> dict[str, Any]:
    """将每道题的作答与评分写入错题/复盘记录表，返回记录摘要"""
    db = get_db()
    clean_q = (question or "").strip()
    overall = 25 if skipped else compute_question_overall_score(evaluation)
    is_weak = skipped or overall < WEAK_SCORE_THRESHOLD
    status = "weak" if is_weak else "mastered"
    # 弱题（<70）默认下次再考（1）；正确题（>=70）默认不再考（0），由用户勾选决定
    default_next_exam = 1 if is_weak else 0

    logic = int(evaluation.get("scoreLogic") or 0)
    prof = int(evaluation.get("scoreProfessional") or 0)
    match = int(evaluation.get("scoreMatch") or 0)
    expr = int(evaluation.get("scoreExpression") or 0)
    model_answer = str(evaluation.get("modelAnswer") or "").strip()
    deduction = build_deduction_notes(evaluation)
    score_json_str = json.dumps(evaluation, ensure_ascii=False)
    now = datetime.now(timezone.utc).isoformat()

    try:
        existing = db.execute(
            """SELECT id, status, next_exam_enabled, practice_count
               FROM interview_weak_questions
               WHERE user_id = ? AND question = ?
               ORDER BY id DESC LIMIT 1""",
            (user_id, clean_q),
        ).fetchone()
    except Exception:
        # 兼容部分内存测试未创建该表的情况
        return {
            "weakQuestionId": None,
            "overallScore": overall,
            "status": status,
            "nextExamEnabled": bool(default_next_exam),
            "deductionNotes": deduction,
        }

    if existing:
        item_id = existing["id"]
        # 如果最新答成了弱题，强制开启下次再考；如果答成了已掌握，默认置为0（可由用户勾选）
        next_exam = 1 if is_weak else 0
        db.execute(
            """UPDATE interview_weak_questions
               SET session_id = COALESCE(?, session_id),
                   resume_id = COALESCE(?, resume_id),
                   last_answer = ?,
                   model_answer = ?,
                   interviewer_role = ?,
                   target_job_title = COALESCE(NULLIF(?, ''), target_job_title),
                   score_overall = ?,
                   score_logic = ?,
                   score_professional = ?,
                   score_match = ?,
                   score_expression = ?,
                   deduction_notes = ?,
                   score_json = ?,
                   status = ?,
                   next_exam_enabled = ?,
                   updated_at = ?
               WHERE id = ?""",
            (
                session_id,
                resume_id,
                answer,
                model_answer,
                interviewer_role,
                target_job_title,
                overall,
                logic,
                prof,
                match,
                expr,
                deduction,
                score_json_str,
                status,
                next_exam,
                now,
                item_id,
            ),
        )
    else:
        cursor = db.execute(
            """INSERT INTO interview_weak_questions (
                user_id, session_id, resume_id, question, last_answer, model_answer,
                interviewer_role, target_job_title, score_overall,
                score_logic, score_professional, score_match, score_expression,
                deduction_notes, score_json, status, next_exam_enabled, practice_count,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)""",
            (
                user_id,
                session_id,
                resume_id,
                clean_q,
                answer,
                model_answer,
                interviewer_role,
                target_job_title,
                overall,
                logic,
                prof,
                match,
                expr,
                deduction,
                score_json_str,
                status,
                default_next_exam,
                now,
                now,
            ),
        )
        item_id = cursor.lastrowid
        next_exam = default_next_exam

    db.commit()
    return {
        "weakQuestionId": item_id,
        "overallScore": overall,
        "status": status,
        "nextExamEnabled": bool(next_exam),
        "deductionNotes": deduction,
    }


def _format_weak_row(row) -> dict[str, Any]:
    item = row_to_camel(row)
    item["nextExamEnabled"] = bool(row["next_exam_enabled"])
    if row["score_json"]:
        try:
            item["evaluation"] = json.loads(row["score_json"])
        except Exception:
            item["evaluation"] = None
    else:
        item["evaluation"] = None
    return item


def list_weak_questions(
    user_id: int,
    status_filter: str = "all",
    role_filter: str = "",
) -> dict[str, Any]:
    """查询用户的弱题/已掌握题列表及汇总计数"""
    db = get_db()
    all_rows = db.execute(
        "SELECT * FROM interview_weak_questions WHERE user_id = ? ORDER BY updated_at DESC, id DESC",
        (user_id,),
    ).fetchall()

    total_count = len(all_rows)
    weak_count = sum(1 for r in all_rows if r["status"] == "weak")
    mastered_count = sum(1 for r in all_rows if r["status"] == "mastered")
    next_exam_count = sum(1 for r in all_rows if r["next_exam_enabled"])
    total_practice = sum(int(r["practice_count"] or 0) for r in all_rows)

    filtered = []
    for r in all_rows:
        if status_filter == "weak" and r["status"] != "weak":
            continue
        if status_filter == "mastered" and r["status"] != "mastered":
            continue
        if status_filter == "next_exam" and not r["next_exam_enabled"]:
            continue
        if role_filter and r["interviewer_role"] != role_filter:
            continue
        filtered.append(_format_weak_row(r))

    return {
        "items": filtered,
        "stats": {
            "totalCount": total_count,
            "weakCount": weak_count,
            "masteredCount": mastered_count,
            "nextExamCount": next_exam_count,
            "totalPracticeCount": total_practice,
        },
    }


def update_weak_question_preference(
    user_id: int,
    item_id: int,
    *,
    next_exam_enabled: bool | None = None,
    status: str | None = None,
) -> dict[str, Any]:
    """更新某道题的「下次是否再考」开关或掌握状态"""
    db = get_db()
    row = db.execute(
        "SELECT * FROM interview_weak_questions WHERE id = ? AND user_id = ?",
        (item_id, user_id),
    ).fetchone()
    if not row:
        raise LookupError("记录不存在")

    new_status = status if status in ("weak", "mastered") else row["status"]
    if next_exam_enabled is not None:
        new_next_exam = 1 if next_exam_enabled else 0
    else:
        new_next_exam = row["next_exam_enabled"]

    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        """UPDATE interview_weak_questions
           SET status = ?, next_exam_enabled = ?, updated_at = ?
           WHERE id = ?""",
        (new_status, new_next_exam, now, item_id),
    )
    db.commit()
    updated = db.execute(
        "SELECT * FROM interview_weak_questions WHERE id = ?", (item_id,)
    ).fetchone()
    return _format_weak_row(updated)


def update_preference_by_question_text(
    user_id: int,
    question: str,
    next_exam_enabled: bool,
) -> dict[str, Any] | None:
    """根据题目文本切换下次是否再考（用于报告页或面试当场快捷勾选）"""
    db = get_db()
    row = db.execute(
        """SELECT * FROM interview_weak_questions
           WHERE user_id = ? AND question = ?
           ORDER BY id DESC LIMIT 1""",
        (user_id, (question or "").strip()),
    ).fetchone()
    if not row:
        return None
    return update_weak_question_preference(
        user_id, row["id"], next_exam_enabled=next_exam_enabled
    )


async def practice_weak_question(
    user_id: int,
    item_id: int,
    answer_text: str,
) -> dict[str, Any]:
    """在弱题复盘页针对单题进行对照重练与再次评估，并自动回写掌握状态"""
    cleaned_answer = (answer_text or "").strip()
    if not cleaned_answer:
        raise ValueError("练习回答不能为空")

    db = get_db()
    row = db.execute(
        "SELECT * FROM interview_weak_questions WHERE id = ? AND user_id = ?",
        (item_id, user_id),
    ).fetchone()
    if not row:
        raise LookupError("题目记录不存在")

    resume_brief = ""
    job_description = ""
    target_job_title = row["target_job_title"] or ""
    if row["resume_id"]:
        resume = db.execute(
            "SELECT * FROM user_resume WHERE id = ?", (row["resume_id"],)
        ).fetchone()
        if resume:
            ctx = load_resume_interview_context(resume)
            resume_brief = ctx["resumeBrief"]
            job_description = ctx["jobDescription"]
            target_job_title = target_job_title or ctx["targetJobTitle"]

    role = row["interviewer_role"] or "technical"
    if role.startswith("enterprise:"):
        role = "technical"

    previous_score = int(row["score_overall"] or 0)
    evaluation = await evaluate_answer(
        row["question"],
        cleaned_answer,
        role,
        resume_brief=resume_brief,
        job_description=job_description,
        target_job_title=target_job_title,
        difficulty="standard",
    )

    overall = compute_question_overall_score(evaluation)
    logic = int(evaluation.get("scoreLogic") or 0)
    prof = int(evaluation.get("scoreProfessional") or 0)
    match = int(evaluation.get("scoreMatch") or 0)
    expr = int(evaluation.get("scoreExpression") or 0)
    model_answer = str(evaluation.get("modelAnswer") or row["model_answer"] or "").strip()
    deduction = build_deduction_notes(evaluation)
    score_json_str = json.dumps(evaluation, ensure_ascii=False)

    # 达标（>=70）则回写为已掌握（mastered），未达标仍为弱题（weak）
    new_status = "mastered" if overall >= WEAK_SCORE_THRESHOLD else "weak"
    # 若从弱题首次攻克为已掌握，默认将下次再考置为 0（用户可按需勾选「下次再出」）
    new_next_exam = 0 if new_status == "mastered" else 1
    practice_count = int(row["practice_count"] or 0) + 1
    now = datetime.now(timezone.utc).isoformat()

    db.execute(
        """UPDATE interview_weak_questions
           SET last_answer = ?,
               model_answer = ?,
               score_overall = ?,
               score_logic = ?,
               score_professional = ?,
               score_match = ?,
               score_expression = ?,
               deduction_notes = ?,
               score_json = ?,
               status = ?,
               next_exam_enabled = ?,
               practice_count = ?,
               updated_at = ?
           WHERE id = ?""",
        (
            cleaned_answer,
            model_answer,
            overall,
            logic,
            prof,
            match,
            expr,
            deduction,
            score_json_str,
            new_status,
            new_next_exam,
            practice_count,
            now,
            item_id,
        ),
    )
    db.commit()

    updated = db.execute(
        "SELECT * FROM interview_weak_questions WHERE id = ?", (item_id,)
    ).fetchone()
    return {
        "item": _format_weak_row(updated),
        "evaluation": evaluation,
        "previousScore": previous_score,
        "newScore": overall,
        "scoreDelta": overall - previous_score,
        "masteredNow": new_status == "mastered",
    }


def delete_weak_question(user_id: int, item_id: int) -> None:
    db = get_db()
    db.execute(
        "DELETE FROM interview_weak_questions WHERE id = ? AND user_id = ?",
        (item_id, user_id),
    )
    db.commit()


def get_user_exam_preferences(user_id: int, role_id: str | None = None) -> dict[str, list[str]]:
    """获取用户在下次面试时的出题偏好：
    - weak_retry: 尚未掌握且开启下次再考的弱题（优先考察核心短板）
    - mastered_rephrase: 已掌握但用户主动勾选「下次再出」的题（必须换不同问法再现）
    - mastered_skip: 已掌握且未勾选下次再出的题（禁止原样重复考察）
    """
    db = get_db()
    try:
        rows = db.execute(
            """SELECT question, status, next_exam_enabled, interviewer_role
               FROM interview_weak_questions
               WHERE user_id = ?
               ORDER BY updated_at DESC LIMIT 30""",
            (user_id,),
        ).fetchall()
    except Exception:
        return {"weakRetry": [], "masteredRephrase": [], "masteredSkip": []}

    weak_retry: list[str] = []
    mastered_rephrase: list[str] = []
    mastered_skip: list[str] = []

    for r in rows:
        q = (r["question"] or "").strip()
        if not q:
            continue
        if r["status"] == "weak" and r["next_exam_enabled"]:
            weak_retry.append(q)
        elif r["status"] == "mastered" and r["next_exam_enabled"]:
            mastered_rephrase.append(q)
        elif r["status"] == "mastered" and not r["next_exam_enabled"]:
            mastered_skip.append(q)

    return {
        "weakRetry": weak_retry[:5],
        "masteredRephrase": mastered_rephrase[:5],
        "masteredSkip": mastered_skip[:10],
    }
