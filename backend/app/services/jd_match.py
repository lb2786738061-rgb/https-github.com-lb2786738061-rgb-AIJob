import logging
import re
from typing import Any, TypedDict

from app.services.llm import RESUME_LLM_TIMEOUT, chat_completion_json, is_llm_available

logger = logging.getLogger(__name__)
from app.services.resume_parser import ParsedResume


class JdMatchResult(TypedDict):
    matchPercentage: int
    scoreMatch: int
    matchedKeywords: list[str]
    missingKeywords: list[str]
    experienceGaps: list[str]
    report: str


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


def _normalize_jd_match_result(raw: Any) -> JdMatchResult | None:
    if not isinstance(raw, dict):
        return None

    match_percentage = _coerce_int_score(
        _pick_value(raw, "matchPercentage", "match_percentage", "matchRate", "匹配度")
    )
    score_match = _coerce_int_score(
        _pick_value(raw, "scoreMatch", "score_match", "matchScore")
    )
    if score_match is None:
        score_match = match_percentage
    if match_percentage is None:
        match_percentage = score_match

    report = _pick_value(raw, "report", "matchReport", "summary", "匹配报告")
    if match_percentage is None or report is None:
        return None

    return {
        "matchPercentage": match_percentage,
        "scoreMatch": score_match,
        "matchedKeywords": _coerce_str_list(
            _pick_value(raw, "matchedKeywords", "matched_keywords", "matched", "已匹配关键词")
        ),
        "missingKeywords": _coerce_str_list(
            _pick_value(raw, "missingKeywords", "missing_keywords", "missing", "缺失关键词")
        ),
        "experienceGaps": _coerce_str_list(
            _pick_value(raw, "experienceGaps", "experience_gaps", "gaps", "经验盲区")
        ),
        "report": str(report),
    }


COMMON_KEYWORDS = [
    "Java", "Python", "JavaScript", "TypeScript", "React", "Vue", "Node",
    "SQL", "MySQL", "Redis", "Docker", "Kubernetes", "AWS", "Git",
    "产品", "运营", "市场", "销售", "财务", "设计", "UI", "UX",
    "沟通", "团队", "项目管理", "数据分析", "机器学习", "AI",
    "本科", "硕士", "3年", "5年", "经验",
]


def _extract_jd_keywords(jd: str) -> list[str]:
    jd_lower = jd.lower()
    found = [k for k in COMMON_KEYWORDS if k.lower() in jd_lower]
    extra = re.findall(r"[\u4e00-\u9fa5]{2,6}|[A-Za-z+#]{2,20}", jd)
    extra = [w for w in extra if 2 <= len(w) <= 15]
    return list(dict.fromkeys([*found, *extra[:30]]))


def rule_based_match(parsed: ParsedResume, jd: str) -> JdMatchResult:
    resume_text = parsed["rawText"].lower()
    keywords = _extract_jd_keywords(jd)
    matched = [k for k in keywords if k.lower() in resume_text]
    missing = [k for k in keywords if k.lower() not in resume_text]

    match_percentage = (
        round(len(matched) / len(keywords) * 100) if keywords else 50
    )

    experience_gaps: list[str] = []
    if re.search(r"\d+年", jd) and not re.search(r"\d+年", parsed["rawText"]):
        experience_gaps.append("JD 要求特定工作年限，简历中未明确体现")
    if len(missing) > 5:
        experience_gaps.append(f"缺失 {len(missing)} 个关键技能词，匹配度偏低")

    report = "\n".join(
        [
            f"岗位匹配度：{match_percentage}%",
            "",
            "【已匹配关键词】",
            "\n".join(f"✓ {k}" for k in matched) if matched else "（较少）",
            "",
            "【缺失关键词】",
            "\n".join(f"✗ {k}" for k in missing) if missing else "（无显著缺失）",
            "",
            "【经验盲区】",
            *[f"• {g}" for g in experience_gaps],
        ]
    )

    return {
        "matchPercentage": match_percentage,
        "scoreMatch": match_percentage,
        "matchedKeywords": matched,
        "missingKeywords": missing,
        "experienceGaps": experience_gaps,
        "report": report,
    }


async def match_job_description(parsed: ParsedResume, jd: str) -> tuple[JdMatchResult, bool]:
    if not jd.strip():
        empty: JdMatchResult = {
            "matchPercentage": 0,
            "scoreMatch": 0,
            "matchedKeywords": [],
            "missingKeywords": [],
            "experienceGaps": ["未提供职位描述"],
            "report": "请先粘贴目标岗位的 JD 以进行匹配度分析。",
        }
        return empty, False

    if not is_llm_available():
        return rule_based_match(parsed, jd), False

    try:
        system_prompt = """你是招聘匹配专家。对比简历与 JD，返回 JSON：
{
  "matchPercentage": 0-100,
  "scoreMatch": 0-100,
  "matchedKeywords": [],
  "missingKeywords": [],
  "experienceGaps": [],
  "report": "详细匹配报告"
}"""
        user_prompt = (
            f"【简历】\n{parsed['rawText'][:4000]}\n\n【JD】\n{jd[:3000]}"
        )
        result = await chat_completion_json(
            system_prompt, user_prompt, timeout=RESUME_LLM_TIMEOUT
        )
        normalized = _normalize_jd_match_result(result)
        if normalized is None:
            raise ValueError(
                f"LLM JD match response missing required fields: {list(result.keys()) if isinstance(result, dict) else type(result)}"
            )
        return normalized, True
    except Exception as exc:
        logger.warning(
            "JD match LLM failed (%s), using rule fallback: %s",
            type(exc).__name__,
            exc or "timeout or empty response",
        )
        return rule_based_match(parsed, jd), False
