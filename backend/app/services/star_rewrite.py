import logging
import re
from typing import Any, TypedDict

from app.services.llm import RESUME_LLM_TIMEOUT, chat_completion_json, is_llm_available

logger = logging.getLogger(__name__)
from app.services.resume_parser import ParsedResume


class StarSuggestion(TypedDict):
    original: str
    situation: str
    task: str
    action: str
    result: str
    rewritten: str


class StarRewriteResult(TypedDict):
    suggestions: list[StarSuggestion]
    summary: str


def _pick_value(data: dict, *keys: str) -> Any:
    for key in keys:
        if key in data and data[key] is not None:
            return data[key]
    return None


def _normalize_star_rewrite_result(raw: Any) -> StarRewriteResult | None:
    if not isinstance(raw, dict):
        return None

    summary = _pick_value(raw, "summary", "overview", "总结")
    suggestions_raw = _pick_value(raw, "suggestions", "items", "rewrites", "建议")
    if summary is None or suggestions_raw is None:
        return None
    if not isinstance(suggestions_raw, list):
        return None

    suggestions: list[StarSuggestion] = []
    for item in suggestions_raw:
        if not isinstance(item, dict):
            continue
        original = _pick_value(item, "original", "source", "原句")
        rewritten = _pick_value(item, "rewritten", "rewrite", "重写句")
        if original is None or rewritten is None:
            continue
        suggestions.append(
            {
                "original": str(original),
                "situation": str(_pick_value(item, "situation", "背景") or ""),
                "task": str(_pick_value(item, "task", "任务") or ""),
                "action": str(_pick_value(item, "action", "行动") or ""),
                "result": str(_pick_value(item, "result", "结果") or ""),
                "rewritten": str(rewritten),
            }
        )

    return {
        "suggestions": suggestions,
        "summary": str(summary),
    }


def rule_based_star_rewrite(parsed: ParsedResume) -> StarRewriteResult:
    experience = parsed["sections"].get("experience") or []
    weak_lines = [
        e
        for e in experience
        if re.search(r"负责|参与|协助|日常", e) and not re.search(r"\d+%|\d+万", e)
    ]

    suggestions: list[StarSuggestion] = [
        {
            "original": line,
            "situation": "【请补充】描述项目/业务背景，如「公司 XX 业务面临转化率下滑」",
            "task": "【请补充】你的具体职责目标，如「需在 Q2 内将转化率提升 20%」",
            "action": "【建议】将「负责」改为具体行动：分析数据 → 制定方案 → 推动落地",
            "result": "【请补充】量化结果，如「最终实现转化率提升 25%，GMV 增长 300 万」",
            "rewritten": "【STAR 重构示例】在 [背景] 下，承担 [任务]。通过 [具体行动1、行动2]，最终达成 [量化结果]。",
        }
        for line in weak_lines[:3]
    ]

    if not suggestions and experience:
        line = experience[0]
        suggestions.append(
            {
                "original": line,
                "situation": "业务/项目背景（用户可编辑补充）",
                "task": "你的核心职责与目标",
                "action": "采取的关键行动与方法论",
                "result": "可量化的业务成果",
                "rewritten": line
                if ("提升" in line or "%" in line)
                else f"{line} → 建议补充量化结果与业务影响",
            }
        )

    return {
        "suggestions": suggestions,
        "summary": (
            f"发现 {len(suggestions)} 条经历可升级为 STAR 量化表述"
            if suggestions
            else "简历经历表述较好，可进一步细化量化指标"
        ),
    }


def rewrite_from_star_fields(fields: dict) -> str:
    situation, task, action, result = (
        fields.get("situation", ""),
        fields.get("task", ""),
        fields.get("action", ""),
        fields.get("result", ""),
    )
    if all("请补充" in s or "【请补充】" in s for s in [situation, task, action, result]):
        return fields.get("original", "")
    return f"在{situation}的背景下，承担{task}。通过{action}，最终达成{result}。"


async def generate_star_rewrite(
    parsed: ParsedResume, jd: str | None = None
) -> tuple[StarRewriteResult, bool]:
    if not is_llm_available():
        return rule_based_star_rewrite(parsed), False

    try:
        system_prompt = """你是简历 STAR 法则优化专家。返回 JSON：
{
  "suggestions": [{
    "original": "原句",
    "situation": "背景",
    "task": "任务",
    "action": "行动",
    "result": "结果",
    "rewritten": "完整 STAR 重写句"
  }],
  "summary": "总结"
}"""
        jd_part = f"\n\n目标岗位 JD：\n{jd[:1500]}" if jd else ""
        user_prompt = (
            f"请对以下简历经历进行 STAR 重构：\n{parsed['rawText'][:4000]}{jd_part}"
        )
        result = await chat_completion_json(
            system_prompt, user_prompt, timeout=RESUME_LLM_TIMEOUT
        )
        normalized = _normalize_star_rewrite_result(result)
        if normalized is None:
            raise ValueError(
                f"LLM STAR rewrite response missing required fields: {list(result.keys()) if isinstance(result, dict) else type(result)}"
            )
        return normalized, True
    except Exception as exc:
        logger.warning(
            "STAR rewrite LLM failed (%s), using rule fallback: %s",
            type(exc).__name__,
            exc or "timeout or empty response",
        )
        return rule_based_star_rewrite(parsed), False
