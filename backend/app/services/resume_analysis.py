import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Literal, TypedDict

from app.db.connection import get_db
from app.services.jd_match import JdMatchResult, match_job_description
from app.services.resume_beautify import BeautifyResult, beautify_resume_content
from app.services.resume_diagnosis import (
    DiagnosisResult,
    diagnose_resume,
    diagnosis_db_fields,
    ensure_diagnosis_result,
)
from app.services.resume_grammar import check_grammar_spelling, merge_grammar_into_diagnosis
from app.services.resume_parser import ParsedResume
from app.services.star_rewrite import StarRewriteResult, generate_star_rewrite

logger = logging.getLogger(__name__)

AnalysisSource = Literal["llm", "rule_based"]


class AnalysisBundle(TypedDict, total=False):
    diagnosis: DiagnosisResult
    jd_match: JdMatchResult | None
    star_result: StarRewriteResult
    analysis_source: AnalysisSource
    grammar_check: dict
    parsed: ParsedResume


async def _safe_beautify(
    parsed: ParsedResume,
    jd: str = "",
    target_job_title: str = "",
) -> BeautifyResult | None:
    try:
        return await beautify_resume_content(parsed, "classic", target_job_title, jd)
    except Exception:
        logger.exception("上传并行结构化失败，保留解析结果")
        return None


async def run_full_analysis(
    parsed: ParsedResume,
    jd: str = "",
    target_job_title: str = "",
) -> AnalysisBundle:
    jd_stripped = jd.strip()

    task_names: list[str] = ["diagnosis", "star_result", "beautify"]
    tasks = [
        diagnose_resume(parsed),
        generate_star_rewrite(parsed, jd_stripped or None),
        _safe_beautify(parsed, jd_stripped, target_job_title),
    ]
    if jd_stripped:
        task_names.append("jd_match")
        tasks.append(match_job_description(parsed, jd_stripped))

    results = await asyncio.gather(*tasks)

    values: dict[str, object] = {}
    llm_flags: list[bool] = []
    beautify_result: BeautifyResult | None = None
    for name, result in zip(task_names, results):
        if name == "beautify":
            beautify_result = result  # type: ignore[assignment]
            continue
        payload, used_llm = result  # type: ignore[misc]
        values[name] = payload
        llm_flags.append(used_llm)

    analysis_source: AnalysisSource = (
        "llm" if llm_flags and all(llm_flags) else "rule_based"
    )

    diagnosis = ensure_diagnosis_result(parsed, values["diagnosis"])  # type: ignore[arg-type]
    grammar = check_grammar_spelling(parsed)
    diagnosis = merge_grammar_into_diagnosis(diagnosis, grammar)  # type: ignore[arg-type]

    structured = parsed
    if beautify_result and beautify_result.get("parsed"):
        structured = beautify_result["parsed"]

    return {
        "diagnosis": diagnosis,
        "jd_match": values.get("jd_match"),  # type: ignore[typeddict-item]
        "star_result": values["star_result"],  # type: ignore[typeddict-item]
        "analysis_source": analysis_source,
        "grammar_check": grammar,
        "parsed": structured,
    }


def persist_analysis(
    resume_id: int,
    analysis: AnalysisBundle,
    *,
    analysis_status: str = "complete",
    target_job_title: str | None = None,
    job_description: str | None = None,
) -> None:
    diagnosis = analysis["diagnosis"]
    jd_match = analysis["jd_match"]
    star_result = analysis["star_result"]
    now = datetime.now(timezone.utc).isoformat()
    (
        score_overall,
        score_clarity,
        score_competitiveness,
        score_professionalism,
        diagnosis_report,
    ) = diagnosis_db_fields(diagnosis)

    db = get_db()
    parsed_json = (
        json.dumps(analysis.get("parsed"), ensure_ascii=False)
        if analysis.get("parsed")
        else None
    )
    db.execute(
        """UPDATE user_resume SET
            target_job_title = COALESCE(?, target_job_title),
            job_description = COALESCE(?, job_description),
            parsed_json = COALESCE(?, parsed_json),
            score_overall = ?, score_clarity = ?, score_competitiveness = ?,
            score_match = ?, score_professionalism = ?,
            match_percentage = ?, missing_keywords = ?, jd_match_report = ?,
            diagnosis_report = ?, star_suggestions = ?,
            analysis_status = ?, updated_at = ?
        WHERE id = ?""",
        (
            target_job_title,
            job_description,
            parsed_json,
            score_overall,
            score_clarity,
            score_competitiveness,
            jd_match["scoreMatch"] if jd_match else None,
            score_professionalism,
            jd_match["matchPercentage"] if jd_match else None,
            json.dumps(jd_match["missingKeywords"], ensure_ascii=False) if jd_match else None,
            jd_match["report"] if jd_match else None,
            diagnosis_report,
            json.dumps(star_result, ensure_ascii=False),
            analysis_status,
            now,
            resume_id,
        ),
    )
    db.commit()
