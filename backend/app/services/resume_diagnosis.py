import logging
import re
from typing import Any, TypedDict

from app.services.llm import RESUME_LLM_TIMEOUT, chat_completion_json, is_llm_available

logger = logging.getLogger(__name__)
from app.services.resume_parser import ParsedResume


class DiagnosisResult(TypedDict):
    scoreOverall: int
    scoreClarity: int
    scoreCompetitiveness: int
    scoreProfessionalism: int
    diagnosisReport: str
    issues: list[str]
    suggestions: list[str]


DIAGNOSIS_SCORE_KEYS = (
    "scoreOverall",
    "scoreClarity",
    "scoreCompetitiveness",
    "scoreProfessionalism",
)


def _pick_value(data: dict, *keys: str) -> Any:
    for key in keys:
        if key in data and data[key] is not None:
            return data[key]
    return None


def _coerce_int_score(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return max(0, min(100, int(round(float(value)))))
    except (TypeError, ValueError):
        return None


def _coerce_str_list(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item) for item in value if item is not None]
    if isinstance(value, str):
        return [value]
    return []


def _normalize_diagnosis_result(raw: Any) -> DiagnosisResult | None:
    if not isinstance(raw, dict):
        return None

    nested = raw.get("scores") or raw.get("score") or raw.get("dimensionScores")
    source = {**raw, **nested} if isinstance(nested, dict) else raw

    score_overall = _coerce_int_score(
        _pick_value(source, "scoreOverall", "score_overall", "overallScore", "overall", "综合评分")
    )
    score_clarity = _coerce_int_score(
        _pick_value(source, "scoreClarity", "score_clarity", "clarityScore", "clarity", "清晰度")
    )
    score_competitiveness = _coerce_int_score(
        _pick_value(
            source,
            "scoreCompetitiveness",
            "score_competitiveness",
            "competitivenessScore",
            "competitiveness",
            "竞争力",
        )
    )
    score_professionalism = _coerce_int_score(
        _pick_value(
            source,
            "scoreProfessionalism",
            "score_professionalism",
            "professionalismScore",
            "professionalism",
            "专业度",
        )
    )
    diagnosis_report = _pick_value(
        source,
        "diagnosisReport",
        "diagnosis_report",
        "report",
        "summary",
        "analysis",
        "诊断报告",
    )

    if score_overall is None and all(
        score is not None
        for score in (score_clarity, score_competitiveness, score_professionalism)
    ):
        score_overall = round(
            (score_clarity + score_competitiveness + score_professionalism) / 3
        )

    issues = _coerce_str_list(
        _pick_value(source, "issues", "problems", "weaknesses", "待优化项", "问题")
    )
    suggestions = _coerce_str_list(
        _pick_value(source, "suggestions", "recommendations", "improvements", "改进建议", "建议")
    )

    required = (
        score_overall,
        score_clarity,
        score_competitiveness,
        score_professionalism,
        diagnosis_report,
    )
    if any(value is None for value in required):
        return None

    return {
        "scoreOverall": score_overall,
        "scoreClarity": score_clarity,
        "scoreCompetitiveness": score_competitiveness,
        "scoreProfessionalism": score_professionalism,
        "diagnosisReport": str(diagnosis_report),
        "issues": issues,
        "suggestions": suggestions,
    }


def _is_complete_diagnosis(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    for key in (*DIAGNOSIS_SCORE_KEYS, "diagnosisReport"):
        if key not in value or value[key] is None:
            return False
    return True


def ensure_diagnosis_result(parsed: ParsedResume, diagnosis: Any) -> DiagnosisResult:
    """Return a complete diagnosis payload, falling back when LLM output is partial."""
    if _is_complete_diagnosis(diagnosis):
        return diagnosis  # type: ignore[return-value]

    normalized = (
        _normalize_diagnosis_result(diagnosis) if isinstance(diagnosis, dict) else None
    )
    if normalized is not None:
        return normalized

    return rule_based_diagnosis(parsed)


def diagnosis_db_fields(diagnosis: DiagnosisResult) -> tuple[int, int, int, int, str]:
    return (
        int(diagnosis["scoreOverall"]),
        int(diagnosis["scoreClarity"]),
        int(diagnosis["scoreCompetitiveness"]),
        int(diagnosis["scoreProfessionalism"]),
        str(diagnosis["diagnosisReport"]),
    )


def _count_quantified(text: str) -> int:
    return len(re.findall(r"\d+%|\d+万|\d+倍|提升|增长|降低|节省", text))


def rule_based_diagnosis(parsed: ParsedResume) -> DiagnosisResult:
    text = parsed["rawText"]
    word_count = len(text)
    quant_count = _count_quantified(text)
    sections = parsed["sections"]
    has_experience = len(sections.get("experience") or []) > 0
    has_skills = len(sections.get("skills") or []) > 0
    has_education = len(sections.get("education") or []) > 0

    score_clarity = min(
        100, 50 + (20 if word_count > 200 else 0) + (15 if has_experience else 0) + (15 if has_education else 0)
    )
    score_competitiveness = min(
        100, 30 + quant_count * 12 + (20 if has_experience else 0)
    )
    score_professionalism = min(
        100,
        40
        + (25 if has_skills else 0)
        + (25 if quant_count > 2 else quant_count * 8),
    )
    score_overall = round(
        (score_clarity + score_competitiveness + score_professionalism) / 3
    )

    issues: list[str] = []
    suggestions: list[str] = []

    if quant_count < 2:
        issues.append("量化成果不足：工作经历中缺少具体数字与业绩指标")
        suggestions.append(
            "为每条工作经历补充可量化的结果，如「提升转化率 30%」「节省成本 50 万」"
        )
    if not has_skills:
        issues.append("技能板块缺失或不清晰")
        suggestions.append("增加技能关键词板块，按「编程语言 / 框架 / 工具」分类列出")
    for exp in sections.get("experience") or []:
        if re.search(r"负责|参与", exp) and not re.search(r"\d", exp):
            issues.append("部分经历描述过于被动，动词力量感不足")
            suggestions.append(
                "将「负责日常运营」改为「主导 XX 项目，达成 XX 成果」的 STAR 表述"
            )
            break
    if word_count < 150:
        issues.append("简历内容偏少，信息密度不足")
        suggestions.append("补充项目细节、核心职责与业务成果")

    diagnosis_report = "\n".join(
        [
            f"综合评分：{score_overall}/100",
            "",
            "【维度评分】",
            f"- 清晰度：{score_clarity}/100",
            f"- 竞争力：{score_competitiveness}/100",
            f"- 专业度：{score_professionalism}/100",
            "",
            "【待优化项】",
            *[f"• {i}" for i in issues],
            "",
            "【改进建议】",
            *[f"• {s}" for s in suggestions],
        ]
    )

    return {
        "scoreOverall": score_overall,
        "scoreClarity": score_clarity,
        "scoreCompetitiveness": score_competitiveness,
        "scoreProfessionalism": score_professionalism,
        "diagnosisReport": diagnosis_report,
        "issues": issues,
        "suggestions": suggestions,
    }


async def diagnose_resume(parsed: ParsedResume) -> tuple[DiagnosisResult, bool]:
    if not is_llm_available():
        return rule_based_diagnosis(parsed), False

    try:
        system_prompt = """你是资深 HR 与简历优化专家。分析简历并返回 JSON：
{
  "scoreOverall": 0-100,
  "scoreClarity": 0-100,
  "scoreCompetitiveness": 0-100,
  "scoreProfessionalism": 0-100,
  "issues": ["问题1"],
  "suggestions": ["建议1"],
  "diagnosisReport": "详细诊断报告文本"
}"""
        user_prompt = f"请分析以下简历：\n\n{parsed['rawText'][:6000]}"
        result = await chat_completion_json(
            system_prompt, user_prompt, timeout=RESUME_LLM_TIMEOUT
        )
        normalized = _normalize_diagnosis_result(result)
        if normalized is None:
            raise ValueError(
                f"LLM diagnosis response missing required fields: {list(result.keys()) if isinstance(result, dict) else type(result)}"
            )
        return normalized, True
    except Exception as exc:
        logger.warning(
            "Resume diagnosis LLM failed (%s), using rule fallback: %s",
            type(exc).__name__,
            exc or "timeout or empty response",
        )
        return rule_based_diagnosis(parsed), False
