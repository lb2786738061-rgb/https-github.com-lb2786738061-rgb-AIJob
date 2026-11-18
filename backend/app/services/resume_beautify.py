import json
import logging
from typing import TypedDict

from app.services.llm import (
    RESUME_LLM_TIMEOUT,
    TokenUsage,
    chat_completion_json_with_usage,
    is_llm_available,
)
from app.services.resume_layout import (
    flatten_layout_to_sections,
    layout_from_sections,
    normalize_layout,
    preserve_layout_entries,
    sections_look_sparse,
)
from app.services.resume_parser import ParsedResume
from app.services.resume_section_utils import raw_text_reference

logger = logging.getLogger(__name__)

TEMPLATE_HINTS = {
    "classic": "经典商务：层次清晰，经历与项目分条列出，技能用短标签。",
    "modern": "现代双栏：联系方式精简，技能可分组，条目保持完整。",
    "minimal": "极简：留白充足，每条经历一行标题+要点，不合并条目。",
    "timeline": "时间轴：每条经历保留时间信息，描述完整。",
    "grid": "网格布局：信息密度高，条目仍需拆成机构/职位/时间/要点。",
}


class BeautifyResult(TypedDict):
    parsed: ParsedResume
    improvements: list[str]
    source: str
    tokenUsage: TokenUsage | None


def _resume_title_from_parsed(parsed: ParsedResume) -> str:
    contact = str((parsed.get("sections") or {}).get("contact") or "")
    first = contact.splitlines()[0].strip() if contact else ""
    return first[:30] if first and "@" not in first else ""


def _parsed_with_layout(parsed: ParsedResume, layout: dict, sections: dict) -> ParsedResume:
    new_parsed: ParsedResume = {
        "rawText": parsed.get("rawText", ""),
        "sections": sections,
        "layout": layout,
    }
    return new_parsed


def rule_based_beautify(
    parsed: ParsedResume,
    template_id: str = "classic",
    target_job_title: str = "",
    job_description: str = "",
) -> BeautifyResult:
    original_sections = parsed.get("sections", {})
    layout = layout_from_sections(original_sections, _resume_title_from_parsed(parsed))
    layout, preserve_notes = preserve_layout_entries(original_sections, layout)
    sections = flatten_layout_to_sections(layout)

    improvements = [
        f"已按 {template_id} 模板拆成机构 / 职位 / 时间 / 要点",
        *preserve_notes,
    ]
    if sections_look_sparse(original_sections):
        improvements.append("乱版简历缺少可识别章节，需要大模型才能整理，当前未编造内容")
    if target_job_title:
        improvements.append(f"保留目标岗位信息：{target_job_title}")
    if job_description:
        improvements.append("未改写原文内容，仅整理排版结构")

    return {
        "parsed": _parsed_with_layout(parsed, layout, sections),
        "improvements": improvements,
        "source": "rule_based",
        "tokenUsage": None,
    }


async def beautify_resume_content(
    parsed: ParsedResume,
    template_id: str = "classic",
    target_job_title: str = "",
    job_description: str = "",
) -> BeautifyResult:
    if not is_llm_available():
        return rule_based_beautify(parsed, template_id, target_job_title, job_description)

    template_hint = TEMPLATE_HINTS.get(template_id, TEMPLATE_HINTS["classic"])
    original_sections = parsed.get("sections", {})
    sections_json_str = json.dumps(original_sections, ensure_ascii=False, indent=2)
    raw_text_ref = raw_text_reference(parsed.get("rawText", ""))

    system_prompt = """你是专业简历排版编辑。任务：从任意格式的简历全文抽取字段，输出适合统一 HTML 模板渲染的结构化 JSON。不要还原原件分栏、表格或装饰。

要求：
1. 以【原始全文】为唯一事实来源。禁止虚构经历、公司、数字。
2. 【解析章节】可能错、缺、粘连或把两栏串在一起，只作提示，不可当作权威结构。
3. 乱版常见情况都要拆开：没有「工作经历」标题、两栏左右交错、表格单元格、项目混在工作经历里、标题和职责粘在同一段。
4. 每条经历/项目/教育必须拆成 org（公司/学校/项目名）、role（职位/专业）、date、bullets（职责要点数组）。
5. 禁止把标题和职责粘在同一个字符串里；bullets 里每条只放一条要点。
6. 一家公司做了多个项目时：公司本身一条 experience（isSubLevel=false），每个项目紧跟其后一条 experience（isSubLevel=true）。项目的 org 用项目名，项目时间进 date，该项目职责进它自己的 bullets。禁止把「项目一：…」「1、xxx系统」整段丢进公司 bullets。
7. 原文能识别的经历/项目/教育不得遗漏、合并或概括删除。独立「项目经历」章节仍放在 projects，不要挪走。
8. summary 可适度润色但不得添加不存在的信息。
9. 只输出合法 JSON，不要 markdown 代码块。

输出格式：
{
  "layout": {
    "name": "姓名",
    "contact": [{"text": "电话：138xxxx"}, {"text": "邮箱：a@b.com"}],
    "summary": "个人简介",
    "experience": [
      {
        "org": "ABC科技有限公司",
        "role": "前端开发工程师",
        "date": "2021.06 - 至今",
        "bullets": ["参与组件库建设"],
        "isSubLevel": false
      },
      {
        "org": "智能招聘系统",
        "role": "",
        "date": "2022.01 - 2023.06",
        "bullets": ["负责前端架构"],
        "isSubLevel": true
      },
      {
        "org": "企业官网改版",
        "role": "",
        "date": null,
        "bullets": ["主导响应式重构"],
        "isSubLevel": true
      }
    ],
    "projects": [],
    "education": [],
    "skills": {
      "groups": [{"label": "前端", "items": ["React", "TypeScript"]}]
    }
  },
  "improvements": ["说明做了哪些排版整理"]
}"""

    user_prompt = f"""【目标模板】{template_id}
【模板排版要求】{template_hint}
【目标岗位】{target_job_title or "未指定"}
【职位描述摘要】
{(job_description or "")[:1200]}

【原始全文（主输入，据此抽取字段）】
{raw_text_ref}

【解析章节（仅提示，可能错误或粘连）】
{sections_json_str}
"""

    try:
        llm_result = await chat_completion_json_with_usage(
            system_prompt, user_prompt, timeout=RESUME_LLM_TIMEOUT
        )
        data = llm_result["data"]
        token_usage = llm_result.get("tokenUsage")

        if not isinstance(data, dict):
            raise ValueError("大模型返回的数据结构不符合预期")

        layout_raw = data.get("layout")
        if layout_raw is None and isinstance(data.get("sections"), dict):
            layout_raw = data["sections"]

        layout = normalize_layout(layout_raw, original_sections, _resume_title_from_parsed(parsed))
        layout, preserve_notes = preserve_layout_entries(original_sections, layout)
        sections = flatten_layout_to_sections(layout)

        improvements = data.get("improvements") or ["已完成 AI 结构化排版"]
        if not isinstance(improvements, list):
            improvements = [str(improvements)]
        improvements = [str(item) for item in improvements]
        improvements.extend(preserve_notes)

        return {
            "parsed": _parsed_with_layout(parsed, layout, sections),
            "improvements": improvements,
            "source": "llm",
            "tokenUsage": token_usage,
        }
    except Exception as exc:
        logger.warning(
            "大模型简历美化发生异常 (%s)，降级采用规则美化: %s",
            type(exc).__name__,
            exc,
        )
        return rule_based_beautify(parsed, template_id, target_job_title, job_description)
