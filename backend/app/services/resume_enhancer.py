import json
import logging
import re
from typing import Any, TypedDict

from app.services.llm import (
    RESUME_LLM_TIMEOUT,
    TokenUsage,
    chat_completion_json_with_usage,
    is_llm_available,
)
from app.services.resume_parser import ParsedResume
from app.services.resume_section_utils import preserve_section_lists, raw_text_reference

logger = logging.getLogger(__name__)


class EnhanceResult(TypedDict):
    enhancedSections: dict[str, Any]
    improvements: list[str]
    mode: str
    source: str
    tokenUsage: TokenUsage | None


def rule_based_enhance(
    parsed: ParsedResume,
    mode: str,
    target_job_title: str = "",
    job_description: str = "",
) -> EnhanceResult:
    """当大模型不可用时的基于规则的简历增强兜底逻辑"""
    sections = parsed.get("sections", {})
    new_sections = {
        "contact": sections.get("contact", ""),
        "summary": sections.get("summary", ""),
        "experience": list(sections.get("experience", [])),
        "skills": list(sections.get("skills", [])),
        "education": list(sections.get("education", [])),
        "projects": list(sections.get("projects", [])),
    }
    improvements: list[str] = []

    # 1. 增强个人简介
    if not new_sections["summary"]:
        role = target_job_title or "专业技术人才"
        new_sections["summary"] = (
            f"具备扎实的专业技能与丰富的实战项目落地经验，专注于{role}领域。"
            "拥有良好的系统性思维与解决复杂业务问题的能力，注重团队协作与业务价值交付。"
        )
        improvements.append("根据求职目标自动补齐了专业精炼的个人核心优势简介")

    # 2. 增强工作经历动词与量化指标
    enhanced_exp: list[str] = []
    for exp in new_sections["experience"]:
        item = exp
        # 替换被动动词
        item = re.sub(r"^(负责|参与|协助)", "主导推进并深度参与", item)
        # 如果缺少量化指标，根据规则补充成果维度
        if not re.search(r"\d+%|\d+万|\d+倍|提升|降低", item):
            if "开发" in item or "系统" in item:
                item = f"{item}，通过架构优化与规范重构，使核心模块响应耗时降低约 30%，保障业务高可用运行。"
            elif "运营" in item or "用户" in item or "业务" in item:
                item = f"{item}，驱动关键业务转化率提升 25%，实现周期内业务成果超额达成。"
            else:
                item = f"{item}，显著提升了团队协作交付效率与项目整体完成质量。"
        enhanced_exp.append(item)
    new_sections["experience"] = enhanced_exp
    improvements.append("优化了工作经历中的动词力量感，并注入了业务成效与性能指标")

    # 3. 增强技能标签
    if target_job_title and not any(target_job_title in s for s in new_sections["skills"]):
        new_sections["skills"].append(f"{target_job_title}核心技术与方法论")
        improvements.append(f"针对目标岗位补充了关联技能：{target_job_title}核心技术与方法论")

    merged_sections, preserve_notes = preserve_section_lists(sections, new_sections)
    improvements.extend(preserve_notes)

    if not improvements:
        improvements.append("已对简历排版语言进行了结构化规范与专业化润色")

    return {
        "enhancedSections": merged_sections,
        "improvements": improvements,
        "mode": mode,
        "source": "rule_based",
        "tokenUsage": None,
    }


def _merge_enhanced_sections(
    parsed: ParsedResume,
    llm_sections: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    original_sections = parsed.get("sections", {})
    candidate = {
        "contact": str(llm_sections.get("contact") or original_sections.get("contact") or ""),
        "summary": str(llm_sections.get("summary") or original_sections.get("summary") or ""),
        "experience": list(llm_sections.get("experience") or []),
        "skills": list(llm_sections.get("skills") or []),
        "education": list(llm_sections.get("education") or []),
        "projects": list(llm_sections.get("projects") or []),
    }
    return preserve_section_lists(original_sections, candidate)


async def enhance_resume_content(
    parsed: ParsedResume,
    mode: str = "comprehensive",
    target_job_title: str = "",
    job_description: str = "",
) -> EnhanceResult:
    """使用大模型对简历内容进行深度强化与重塑"""
    if not is_llm_available():
        return rule_based_enhance(parsed, mode, target_job_title, job_description)

    mode_prompts = {
        "quantify": (
            "【强化重点：量化指标与成果驱动】\n"
            "1. 深度挖掘工作经历与项目经历中的业务价值，将原本模糊的“负责日常开发/运营”升级为包含具体数字（如百分比、提升倍数、节省时间、支撑用户量）的硬核成果。\n"
            "2. 使用强动词开篇（如：主导、重构、突破、攻坚、驱动），杜绝被动平淡的流水账。"
        ),
        "jd_tailor": (
            "【强化重点：岗位定向对齐与关键词注入】\n"
            f"目标求职岗位：{target_job_title or '未指定'}\n"
            f"目标岗位描述要求：\n{job_description[:1500] if job_description else '按行业标杆高标准要求'}\n"
            "1. 提炼目标岗位最关注的硬性技能与软性能力，自然无缝地融入到个人简介、技能清单、工作经历中。\n"
            "2. 突出与目标岗位强关联的项目深度与实战经验，大幅提高招聘筛选系统的匹配过筛率。"
        ),
        "comprehensive": (
            "【强化重点：全维度金牌简历重塑】\n"
            "1. 结构化重写个人简介（提炼 3 大核心竞争力）。\n"
            "2. 经历全面采用“情境-任务-行动-结果”（STAR）框架重构，注入量化指标。\n"
            "3. 技能列表按技术领域清晰归类，去除冗余废话，语言极度专业干练。"
        ),
    }

    selected_instruction = mode_prompts.get(mode, mode_prompts["comprehensive"])

    system_prompt = f"""你是世界五百强资深招聘专家与金牌职业顾问。你的任务是根据求职者的现有简历和目标岗位，进行全方位的深度内容强化改写。
请严格以 JSON 格式输出，不要包含任何 markdown 代码标记或其他多余文本：
{{
  "enhancedSections": {{
    "contact": "联系方式文本（保留原有关键联系信息）",
    "summary": "重写后的高说服力个人简介",
    "experience": ["重写后的工作经历条目1", "重写后的工作经历条目2"],
    "skills": ["梳理强化后的技能1", "技能2", "技能3"],
    "education": ["教育背景条目"],
    "projects": ["重构后的高亮项目经历条目"]
  }},
  "improvements": [
    "说明具体做了哪些强化改进（例如：注入了哪些维度的量化成果、提升了哪些动词力量感、补充了哪些目标岗位关键词）"
  ]
}}

硬性约束：
1. experience / projects / education / skills 输出条目数量不得少于输入，禁止删除或合并任何条目。
2. 允许改写每条内容，但必须一一对应保留全部条目。"""

    sections_json_str = json.dumps(parsed.get("sections", {}), ensure_ascii=False, indent=2)
    raw_text_ref = raw_text_reference(parsed.get("rawText", ""))

    user_prompt = f"""请对以下简历进行内容强化：
【强化模式】：{mode}
{selected_instruction}

【原始简历结构化信息（主输入）】：
{sections_json_str}

【原始文本参考（仅用于校对）】：
{raw_text_ref}
"""

    try:
        llm_result = await chat_completion_json_with_usage(
            system_prompt, user_prompt, timeout=RESUME_LLM_TIMEOUT
        )
        data = llm_result["data"]
        if isinstance(data, dict) and "enhancedSections" in data:
            merged_sections, preserve_notes = _merge_enhanced_sections(
                parsed, data.get("enhancedSections", {})
            )
            improvements = data.get("improvements", ["已完成深度专业化强化"])
            if not isinstance(improvements, list):
                improvements = [str(improvements)]
            improvements = [str(item) for item in improvements]
            improvements.extend(preserve_notes)
            return {
                "enhancedSections": merged_sections,
                "improvements": improvements,
                "mode": mode,
                "source": "llm",
                "tokenUsage": llm_result.get("tokenUsage"),
            }
        raise ValueError("大模型返回的数据结构不符合预期")
    except Exception as exc:
        logger.warning("大模型简历强化发生异常 (%s)，降级采用规则增强: %s", type(exc).__name__, exc)
        return rule_based_enhance(parsed, mode, target_job_title, job_description)
