import json
import re
from typing import Any, Literal

from app.constants.industries import get_industry_name
from app.services.llm import chat_completion, chat_with_history, is_llm_available, parse_llm_json
from app.services.tech_interview import (
    build_tech_agenda,
    extract_resume_techs,
    format_tech_agenda_prompt,
    format_tech_stack_line,
    tech_slot_for,
)

InterviewerRoleId = Literal["hr", "technical", "pressure", "english"]
DifficultyId = Literal["easy", "standard", "hard"]

INTERVIEWER_ROLES = {
    "hr": {
        "id": "hr",
        "name": "HR 初试官",
        "description": "考察动机、稳定性、协作与职业规划，追问空泛表述",
        "focus": ["求职动机", "稳定性", "协作沟通", "职业规划"],
        "systemPrompt": (
            "你是一位有 10 年经验的人力资源面试官，正在进行初试。"
            "风格专业、克制、友好，但绝不接受空话。"
            "重点考察：求职动机是否具体、职业规划是否自洽、协作冲突如何处理、稳定性风险。"
            "候选人只说「热爱/成长/挑战」时，必须追问到具体事件、选择理由和个人贡献。"
            "每次只问一个问题；先承接对方原话，再追问。"
        ),
    },
    "technical": {
        "id": "technical",
        "name": "技术主管深挖官",
        "description": "对照简历项目刨根问底，考察深度、权衡与故障处理",
        "focus": ["简历技术栈", "原理覆盖", "故障与一致性", "选型对比"],
        "systemPrompt": (
            "你是一位资深技术主管，正在做技术深挖面试。"
            "出题必须紧扣候选人简历里出现的技术（如 Redis、Docker、RabbitMQ、数据库），"
            "按技术点检清单逐项覆盖，而不是只聊项目故事。"
            "每一题只打一个考点，但该考点要问到原理、边界和项目落地，禁止「你用过 Redis 吗」这种浅问。"
            "默认假设候选人可能只把技术写在技能栏：要能区分「真操过」和「背过名词」。"
            "对「我们做了」立即拆成「你做了哪一层」。每次只问一个问题。"
        ),
    },
    "pressure": {
        "id": "pressure",
        "name": "业务总监压力面官",
        "description": "高压质疑业务判断、优先级与抗压表达",
        "focus": ["业务判断", "优先级", "抗压", "决策取舍"],
        "systemPrompt": (
            "你是一位业务总监，进行压力面试。语气直接、有压迫感，但保持专业，不人身攻击。"
            "对含糊、甩锅、没有数据的回答当场质疑，要求候选人在冲突目标中做取舍并解释代价。"
            "可适度反驳，但下一问必须仍基于对方刚刚的表述。每次只问一个问题。"
        ),
    },
    "english": {
        "id": "english",
        "name": "外企英文面试官",
        "description": "全英文面试，考察表达、结构化与专业故事",
        "focus": ["English fluency", "structure", "impact", "collaboration"],
        "systemPrompt": (
            "You are a hiring manager at a multinational company. Conduct the interview entirely in English. "
            "Ask one question at a time. Probe for STAR stories, quantified impact, and the candidate's own contribution. "
            "If the answer is vague, challenge it politely and ask for specifics."
        ),
    },
}

DIFFICULTIES: dict[str, dict[str, str]] = {
    "easy": {
        "id": "easy",
        "name": "热身",
        "description": "友好引导，适合第一次开口",
        "instruction": (
            "难度：热身。允许给台阶，追问只挖一层。"
            "回答结构不完整时先提示补全，而不是直接否定。"
        ),
    },
    "standard": {
        "id": "standard",
        "name": "标准",
        "description": "按一线面试官真实标准",
        "instruction": (
            "难度：标准一线面试。回答空泛必须追问量化结果与个人贡献；"
            "不要一次抛两个问题。"
        ),
    },
    "hard": {
        "id": "hard",
        "name": "大厂终面",
        "description": "高压质疑，对含糊表述零容忍",
        "instruction": (
            "难度：一线大厂终面。对含糊、甩锅、没有数据的回答直接质疑；"
            "追问边界条件、失败案例与取舍代价。"
        ),
    },
}

INTERVIEW_STAGES = [
    {"id": "opening", "name": "开场破冰", "fromQ": 1, "toQ": 1,
     "goal": "用简历/目标岗位做个性化开场，确认背景与求职方向。"},
    {"id": "core", "name": "核心深挖", "fromQ": 2, "toQ": 5,
     "goal": "围绕一段真实经历做 STAR 深挖，问清个人贡献、决策与结果。"},
    {"id": "pressure", "name": "压力追问", "fromQ": 6, "toQ": 7,
     "goal": "针对上一轮缺口或风险点施压，检验临场判断。"},
    {"id": "close", "name": "收尾确认", "fromQ": 8, "toQ": 8,
     "goal": "收口匹配度、预期或反问，给出可执行的结束提问。"},
]

TECH_INTERVIEW_STAGES = [
    {"id": "opening", "name": "技术落地", "fromQ": 1, "toQ": 1,
     "goal": "用简历里权重最高的技术确认真实落地，而不是背名词。"},
    {"id": "core", "name": "原理深挖", "fromQ": 2, "toQ": 8,
     "goal": "按 Redis / 消息队列 / 容器 等清单，逐项覆盖原理、一致性和故障。"},
    {"id": "pressure", "name": "故障极限", "fromQ": 9, "toQ": 9,
     "goal": "用生产故障和流量放大压测是否真操过。"},
    {"id": "close", "name": "收尾确认", "fromQ": 10, "toQ": 10,
     "goal": "收口最熟与最虚的技术，明确补强方向。"},
]

MAX_QUESTIONS = 8
TECH_MAX_QUESTIONS = 10
FREE_MAX_DURATION_SEC = 300
PROBE_PREFIX = "【追问】"
SKIPPED_ANSWER_TEXT = "（本题跳过）"
MAX_ENTERPRISE_PROBES = 2

FALLBACK_QUESTIONS: dict[str, list[str]] = {
    "hr": [
        "请结合你最近一份经历，用 90 秒做自我介绍，重点说你解决过的问题和可量化结果。",
        "你为什么现在看这个方向？如果还有另一个 offer，你会怎么比？",
        "请讲一次你和同事目标冲突的经历：分歧是什么、你做了什么、最后结果如何？",
        "过去一年你成长最快的一点是什么？用一个具体项目说明。",
        "你期望的团队管理风格是怎样的？举一个你适应或冲突过的例子。",
        "如果入职 3 个月发现岗位和预期不符，你会怎么处理？",
        "你的职业规划里，下一步必须拿到的能力是什么？你现在缺哪一块？",
        "今天这场面试，你最希望我记住你的哪一点？为什么？",
    ],
    "technical": [
        "请选简历里你最有技术含量的一个项目，讲清背景、你的职责，以及最难的技术点。",
        "这个方案当时还有哪些备选？你为什么选这个，放弃了什么？",
        "上线后你怎么证明它有效？有哪些指标、基线和对照？",
        "请讲一次线上故障：怎么发现、你怎么定位、如何止损和复盘？",
        "如果把流量或数据量乘以 10，当前架构会先在哪里崩？你会怎么改？",
        "这段代码/系统的质量你怎么保证？举一个你推动的具体机制。",
        "如果让你现在重做，你会砍掉什么、加强什么？为什么？",
        "以你应聘的岗位来看，你认为自己技术上最大的缺口是什么？打算怎么补？",
        "生产上一次和缓存或消息队列相关的事故，你怎么定位和复盘？",
        "如果现在让你给自己的技术深度打分，为什么不是更高的一档？缺的那一层怎么补？",
    ],
    "pressure": [
        "如果你的方案被老板当场否定，你接下来 24 小时具体做什么？",
        "业务要速度、你要质量，deadline 就在这周五，你怎么取舍？会牺牲什么？",
        "讲一次你明确判断错了的决策。当时为什么错，后来怎么收场？",
        "资源只有现在的一半，核心目标还必须交付，你砍哪些、保哪些？",
        "有人说你上次的结果是团队的，不是你的。你怎么证明个人贡献？",
        "用户体验和短期收入冲突时，你站哪边？请用一个真实案例说明。",
        "如果你的直接上级不靠谱，项目又必须推进，你怎么做且不把关系做死？",
        "现在让你给自己打分，为什么不是更高的那一档？",
    ],
    "english": [
        "Walk me through your most relevant experience for this role, including one quantified result.",
        "Why this role now, and why us rather than a similar team?",
        "Describe a project where you had to make a technical or business trade-off. What did you give up?",
        "Tell me about a production issue or failed launch. What was your part in the recovery?",
        "How do you handle disagreement with a stakeholder who outranks you?",
        "If we doubled the scope with the same timeline, what would you cut first?",
        "What is the weakest part of your profile for this job, and how are you closing the gap?",
        "What should I remember about you after this interview?",
    ],
}

_STAR_PATTERNS = {
    "situation": re.compile(
        r"当时|背景|项目|公司|团队|在.{0,12}(负责|参与)|when I|at the time|the project",
        re.I,
    ),
    "task": re.compile(
        r"目标|任务|指标|要求|需要|负责|deadline|goal|task|owned",
        re.I,
    ),
    "action": re.compile(
        r"我(就)?(先|立刻|立即)?|采取|推动|设计|实现|协调|拆分|落地|排查|I (led|built|designed|implemented|fixed)",
        re.I,
    ),
    "result": re.compile(
        r"\d+\s*%|\d+\s*倍|提升|下降|增长|节省|降低|结果|达成|上线|收入|耗时|increased|reduced|improved|saved",
        re.I,
    ),
}


def max_questions_for_role(role_id: str | None) -> int:
    if (role_id or "").startswith("enterprise:"):
        return MAX_QUESTIONS
    if role_id == "technical":
        return TECH_MAX_QUESTIONS
    return MAX_QUESTIONS


def stage_role_id(role_id: str | None) -> str | None:
    if (role_id or "").startswith("enterprise:"):
        return "technical"
    return role_id


def count_main_questions(messages) -> int:
    return sum(
        1
        for m in messages
        if m["role"] == "assistant" and not is_probe_question(m["content"])
    )


def plan_next_question_action(
    *,
    asked_main: int,
    max_questions: int,
    last_was_probe: bool,
    probe_used: int,
    allow_probe: bool,
    evaluation: dict,
    answer: str,
) -> str:
    """Return probe | next | complete. asked_main is non-probe questions already asked."""
    if (
        allow_probe
        and not last_was_probe
        and should_insert_probe(evaluation, answer, probe_used)
    ):
        return "probe"
    if asked_main < max_questions:
        return "next"
    return "complete"


def get_interview_stage(question_index: int, role_id: str | None = None) -> dict[str, Any]:
    idx = max(1, int(question_index or 1))
    resolved = stage_role_id(role_id)
    stages = TECH_INTERVIEW_STAGES if resolved == "technical" else INTERVIEW_STAGES
    total = max_questions_for_role(role_id)
    for stage in stages:
        if stage["fromQ"] <= idx <= stage["toQ"]:
            return {
                "id": stage["id"],
                "name": stage["name"],
                "goal": stage["goal"],
                "fromQ": stage["fromQ"],
                "toQ": stage["toQ"],
                "index": idx,
                "total": total,
            }
    last = stages[-1]
    return {
        "id": last["id"],
        "name": last["name"],
        "goal": last["goal"],
        "fromQ": last["fromQ"],
        "toQ": last["toQ"],
        "index": idx,
        "total": total,
    }


def is_probe_question(text: str | None) -> bool:
    return bool(text) and str(text).lstrip().startswith(PROBE_PREFIX)


def _clip(text: str, limit: int) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _join_section(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            if isinstance(item, str) and item.strip():
                parts.append(item.strip())
            elif isinstance(item, dict):
                org = str(item.get("org") or item.get("name") or "").strip()
                role = str(item.get("role") or item.get("title") or "").strip()
                bullets = item.get("bullets") or []
                head = " / ".join(p for p in (org, role) if p)
                body = "；".join(str(b).strip() for b in bullets[:3] if str(b).strip())
                chunk = "：".join(p for p in (head, body) if p)
                if chunk:
                    parts.append(chunk)
        return "\n".join(parts)
    return str(value).strip()


def build_resume_brief(
    parsed: dict | None = None,
    *,
    resume_title: str = "",
    target_job_title: str = "",
    job_description: str = "",
) -> str:
    parsed = parsed or {}
    layout = parsed.get("layout") if isinstance(parsed.get("layout"), dict) else {}
    sections = parsed.get("sections") if isinstance(parsed.get("sections"), dict) else {}

    name = str(layout.get("name") or "").strip() or resume_title
    lines: list[str] = []
    if name:
        lines.append(f"候选人：{name}")
    if target_job_title:
        lines.append(f"目标岗位：{target_job_title}")

    summary = str(layout.get("summary") or sections.get("summary") or "").strip()
    if summary:
        lines.append("简介：" + _clip(_join_section(summary), 280))

    experience = layout.get("experience") or sections.get("experience") or []
    exp_text = _join_section(experience)
    if exp_text:
        lines.append("经历：\n" + _clip(exp_text, 500))

    projects = layout.get("projects") or sections.get("projects") or []
    proj_text = _join_section(projects)
    if proj_text:
        lines.append("项目：\n" + _clip(proj_text, 420))

    skills = layout.get("skills") or sections.get("skills") or []
    if isinstance(skills, dict):
        groups = skills.get("groups") or []
        skill_bits = []
        for group in groups:
            items = group.get("items") if isinstance(group, dict) else []
            skill_bits.extend(str(x) for x in items[:8])
        skill_text = "、".join(skill_bits)
    else:
        skill_text = _join_section(skills)
    if skill_text:
        lines.append("技能：" + _clip(skill_text.replace("\n", "、"), 400))

    techs = extract_resume_techs(parsed)
    stack_line = format_tech_stack_line(techs)
    if stack_line:
        lines.append(stack_line)

    if job_description:
        lines.append("目标 JD 摘要：" + _clip(job_description, 360))

    if not lines:
        raw = str(parsed.get("rawText") or "").strip()
        if raw:
            return "候选人简历摘要：\n" + _clip(raw, 1200)
        return ""
    return "\n".join(lines)


def load_resume_interview_context(resume_row) -> dict[str, str]:
    parsed: dict = {}
    if resume_row and resume_row["parsed_json"]:
        try:
            loaded = json.loads(resume_row["parsed_json"])
            if isinstance(loaded, dict):
                parsed = loaded
        except (TypeError, json.JSONDecodeError):
            parsed = {}
    target = ""
    job_description = ""
    title = ""
    if resume_row:
        target = (resume_row["target_job_title"] or "").strip()
        job_description = (resume_row["job_description"] or "").strip()
        title = (resume_row["resume_title"] or "").strip()
    brief = build_resume_brief(
        parsed,
        resume_title=title,
        target_job_title=target,
        job_description=job_description,
    )
    if not brief and parsed.get("rawText"):
        brief = "候选人简历摘要：\n" + _clip(str(parsed.get("rawText")), 1200)
    techs = extract_resume_techs(parsed)
    return {
        "resumeBrief": brief,
        "jobDescription": job_description,
        "targetJobTitle": target,
        "rawText": str(parsed.get("rawText") or ""),
        "techStack": [{"id": item["id"], "name": item["name"]} for item in techs],
        "techAgenda": build_tech_agenda(techs, TECH_MAX_QUESTIONS),
    }


def _build_context_prompt(
    resume_brief: str = "",
    industry: str | None = None,
    job_description: str = "",
    target_job_title: str = "",
    difficulty: str = "standard",
    question_index: int = 1,
    last_evaluation: dict | None = None,
    *,
    role_id: str | None = None,
    tech_agenda: list[dict] | None = None,
    probe: bool = False,
) -> str:
    parts: list[str] = []
    industry_name = get_industry_name(industry)
    if industry_name:
        parts.append(f"目标行业：{industry_name}")
    if target_job_title:
        parts.append(f"目标岗位：{target_job_title}")
    if job_description:
        parts.append(f"目标岗位 JD：\n{_clip(job_description, 800)}")
    if resume_brief:
        parts.append(resume_brief)
    diff = DIFFICULTIES.get(difficulty) or DIFFICULTIES["standard"]
    parts.append(diff["instruction"])
    stage = get_interview_stage(question_index, role_id)
    parts.append(
        f"当前阶段：{stage['name']}（第 {stage['index']}/{stage['total']} 题）。阶段目标：{stage['goal']}"
    )
    current_slot = tech_slot_for(tech_agenda or [], question_index, probe=probe)
    agenda_prompt = format_tech_agenda_prompt(tech_agenda or [], current_slot)
    if agenda_prompt:
        parts.append(agenda_prompt)
    if last_evaluation:
        gaps = last_evaluation.get("missedPoints") or []
        gap_text = "；".join(str(g) for g in gaps[:3] if g)
        parts.append(
            "上一题评分："
            f"逻辑 {last_evaluation.get('scoreLogic', '-')}，"
            f"专业 {last_evaluation.get('scoreProfessional', '-')}，"
            f"表达 {last_evaluation.get('scoreExpression', '-')}。"
            + (f"缺口：{gap_text}" if gap_text else "")
        )
    return "\n\n".join(parts)


def clean_interviewer_question(text: str) -> str:
    cleaned = (text or "").strip()
    cleaned = re.sub(r"^```(?:text|markdown)?\s*|\s*```$", "", cleaned).strip()
    cleaned = cleaned.strip("\"“”'")
    cleaned = re.sub(r"^(面试官|Interviewer|Question)\s*[:：]\s*", "", cleaned, flags=re.I)
    cleaned = re.sub(r"^第\s*\d+\s*题[:：]\s*", "", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def _fallback_question(
    role_id: str,
    question_index: int,
    resume_brief: str = "",
    tech_agenda: list[dict] | None = None,
    *,
    probe: bool = False,
) -> str:
    slot = tech_slot_for(tech_agenda or [], question_index, probe=probe)
    if slot and (role_id == "technical" or tech_agenda):
        return slot["ask"]
    pool = FALLBACK_QUESTIONS.get(role_id) or FALLBACK_QUESTIONS["hr"]
    idx = min(max(question_index, 1), len(pool)) - 1
    question = pool[idx]
    if resume_brief and question_index == 1:
        if role_id == "english":
            return "I've reviewed your background. " + question
        return "我已对照你的简历。" + question
    return question


async def get_opening_question(
    role_id: str,
    resume_context: str = "",
    industry: str | None = None,
    job_description: str = "",
    *,
    target_job_title: str = "",
    difficulty: str = "standard",
    resume_brief: str = "",
    tech_agenda: list[dict] | None = None,
) -> str:
    role = INTERVIEWER_ROLES[role_id]
    brief = resume_brief or resume_context
    context_part = _build_context_prompt(
        brief,
        industry,
        job_description,
        target_job_title,
        difficulty,
        1,
        role_id=role_id,
        tech_agenda=tech_agenda,
    )

    if is_llm_available():
        try:
            extra = ""
            if tech_agenda:
                extra = (
                    "第一题必须围绕清单第 1 项技术的项目落地来问，"
                    "禁止只问自我介绍，禁止跳过简历里的 Redis/消息队列/容器等中间件。"
                )
            system_prompt = (
                role["systemPrompt"]
                + "\n\n"
                + context_part
                + "\n\n请生成第一个开场面试问题。必须结合已知背景（简历/岗位/行业），"
                "禁止只问「请做自我介绍」这种没有锚点的问题。"
                + extra
                + "只输出问题本身，不要编号、引号或解释。"
            )
            result = await chat_completion(system_prompt, "请生成开场问题。", json_mode=False)
            cleaned = clean_interviewer_question(result)
            if cleaned:
                return cleaned
        except Exception:
            pass

    return _fallback_question(role_id, 1, brief, tech_agenda)


async def generate_follow_up_question(
    role_id: str,
    history: list[dict[str, str]],
    resume_context: str = "",
    industry: str | None = None,
    job_description: str = "",
    *,
    target_job_title: str = "",
    difficulty: str = "standard",
    resume_brief: str = "",
    last_evaluation: dict | None = None,
    probe: bool = False,
    tech_agenda: list[dict] | None = None,
) -> str:
    role = INTERVIEWER_ROLES.get(role_id) or INTERVIEWER_ROLES["technical"]
    main_asked = sum(
        1
        for m in history
        if m["role"] == "assistant" and not is_probe_question(m["content"])
    )
    next_index = main_asked if probe else main_asked + 1
    brief = resume_brief or resume_context
    context_part = _build_context_prompt(
        brief,
        industry,
        job_description,
        target_job_title,
        difficulty,
        next_index,
        last_evaluation,
        role_id=role_id,
        tech_agenda=tech_agenda,
        probe=probe,
    )

    if not is_llm_available():
        question = _fallback_question(
            role_id if role_id in FALLBACK_QUESTIONS else "technical",
            next_index,
            brief,
            tech_agenda,
            probe=probe,
        )
        return f"{PROBE_PREFIX}{question}" if probe else question

    try:
        probe_rule = (
            "上一题回答偏浅，请针对对方刚刚说过的原话、就当前同一个技术考点再挖一层，不要换新技术。"
            if probe
            else (
                "若上一题该考点已答到原理层，立即进入清单中的下一个技术维度；"
                "若只是空话，先就同一技术补问原理/故障，仍不要跳题。"
            )
        )
        system_prompt = (
            role["systemPrompt"]
            + "\n\n"
            + context_part
            + f"\n\n已进行 {main_asked} 轮主问题。{probe_rule}"
            "每次只问一个问题。技术面不要改成纯行为面试。"
            "只输出问题本身，不要点评、不要示范答案、不要 markdown。"
        )
        result = await chat_with_history(system_prompt, history)
        cleaned = clean_interviewer_question(result)
        if cleaned:
            return f"{PROBE_PREFIX}{cleaned}" if probe and not is_probe_question(cleaned) else cleaned
    except Exception:
        pass

    question = _fallback_question(
        role_id if role_id in FALLBACK_QUESTIONS else "technical",
        next_index,
        brief,
        tech_agenda,
        probe=probe,
    )
    return f"{PROBE_PREFIX}{question}" if probe else question


def _star_coverage(answer: str) -> dict[str, bool]:
    return {key: bool(pattern.search(answer)) for key, pattern in _STAR_PATTERNS.items()}


def _clamp_score(value: Any, default: int = 60) -> int:
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):
        number = default
    return max(0, min(100, number))


def should_insert_probe(evaluation: dict, answer: str, probe_used: int, max_probes: int = MAX_ENTERPRISE_PROBES) -> bool:
    if probe_used >= max_probes:
        return False
    text = (answer or "").strip()
    if text == SKIPPED_ANSWER_TEXT or len(text) < 40:
        return True
    logic = int(evaluation.get("scoreLogic") or 0)
    professional = int(evaluation.get("scoreProfessional") or 0)
    star = evaluation.get("starCoverage") or {}
    missing_result = not star.get("result")
    return logic < 68 or professional < 68 or missing_result


def rule_based_evaluate(question: str, answer: str, *, difficulty: str = "standard", skipped: bool = False) -> dict:
    if skipped or not answer.strip() or answer.strip() == SKIPPED_ANSWER_TEXT:
        return {
            "scoreLogic": 25,
            "scoreProfessional": 25,
            "scoreExpression": 30,
            "scoreMatch": 25,
            "scoreConfidence": 30,
            "feedback": "本题被跳过或几乎没有作答，面试官会记为缺口。下次请至少用 STAR 讲清背景、行动和结果。",
            "modelAnswer": (
                f"针对「{_clip(question, 40)}」的高分回答应包含："
                "1) 简明背景 2) 你的具体行动 3) 可量化结果 4) 反思与收获。"
            ),
            "starCoverage": {key: False for key in _STAR_PATTERNS},
            "missedPoints": ["未作答", "缺少个人贡献", "没有量化结果"],
            "strengths": [],
            "followUpHint": "下一问会要求你立刻补一段完整 STAR 经历。",
            "keywordsHit": [],
        }

    length = len(answer.strip())
    star = _star_coverage(answer)
    has_structure = bool(re.search(r"首先|其次|最后|第一|第二|因为|所以|例如|first|then|finally", answer, re.I))
    has_example = bool(re.search(r"项目|经历|案例|比如|project|example", answer, re.I))
    filler_count = len(re.findall(r"嗯|啊|那个|就是|呃|um+|uh+|like,", answer, re.I))
    has_number = bool(re.search(r"\d+", answer))
    first_person = bool(re.search(r"我|I\b", answer))

    star_hits = sum(1 for ok in star.values() if ok)
    logic = 38 + star_hits * 10 + (12 if has_structure else 0) + min(20, length // 12)
    professional = 32 + (20 if has_example else 0) + (16 if has_number else 0) + (12 if first_person else 0)
    expression = 48 + (18 if length > 80 else length // 6) + (10 if has_structure else 0) - filler_count * 6
    confidence = 62 - filler_count * 8 + (10 if length > 90 else 0) + (8 if first_person else 0)
    if difficulty == "easy":
        logic += 8
        professional += 6
        expression += 4
    elif difficulty == "hard":
        if not star["result"]:
            logic -= 10
            professional -= 8
        if not first_person:
            professional -= 10

    score_logic = _clamp_score(logic)
    score_professional = _clamp_score(professional)
    score_expression = _clamp_score(expression)
    score_confidence = _clamp_score(confidence)
    score_match = _clamp_score((score_logic + score_professional) / 2)

    missed: list[str] = []
    if not star["situation"]:
        missed.append("缺少情境/背景")
    if not star["task"]:
        missed.append("没有讲清任务或目标")
    if not star["action"]:
        missed.append("个人行动不够具体")
    if not star["result"]:
        missed.append("缺少量化结果")
    if length < 80:
        missed.append("信息量偏少，展开不够")
    if filler_count > 2:
        missed.append("口头禅偏多，影响专业感")

    strengths: list[str] = []
    if star["result"] and has_number:
        strengths.append("有量化结果")
    if first_person and star["action"]:
        strengths.append("个人贡献较清楚")
    if has_structure:
        strengths.append("表达有层次")

    if length < 50:
        feedback = "回答过短。先用两句交代背景，再用「我做了什么」带出至少一个数字结果。"
    elif not star["result"]:
        feedback = "故事有了，但缺 Result。补上基线、结果和你在其中的占比，分数会立刻上去。"
    elif not first_person:
        feedback = "听起来像团队总结。请改成「我负责哪一层、我做了哪个决策」。"
    elif filler_count > 2:
        feedback = "口头禅较多。放慢语速，按「背景-行动-结果」三句话先打完骨架。"
    else:
        feedback = "骨架完整。下一层请补决策取舍：为什么选这个方案、放弃了什么。"

    return {
        "scoreLogic": score_logic,
        "scoreProfessional": score_professional,
        "scoreExpression": score_expression,
        "scoreMatch": score_match,
        "scoreConfidence": score_confidence,
        "feedback": feedback,
        "modelAnswer": (
            f"针对「{_clip(question, 42)}」："
            "先用 1 句背景定位场景，再讲你的职责与关键行动（含取舍），"
            "最后给可核对的结果（数字/上线/止损），并补一句复盘。"
        ),
        "starCoverage": star,
        "missedPoints": missed[:4],
        "strengths": strengths[:3],
        "followUpHint": (
            "面试官接下来会追问量化结果与个人贡献。"
            if not star["result"] or not first_person
            else "面试官可能会追问失败边界或如果重做你会怎么改。"
        ),
        "keywordsHit": [k for k, ok in star.items() if ok],
    }


def _normalize_evaluation(raw: dict, fallback: dict) -> dict:
    merged = {**fallback, **(raw or {})}
    for key in (
        "scoreLogic",
        "scoreProfessional",
        "scoreExpression",
        "scoreMatch",
        "scoreConfidence",
    ):
        merged[key] = _clamp_score(merged.get(key), fallback[key])
    star = merged.get("starCoverage")
    if not isinstance(star, dict):
        merged["starCoverage"] = fallback["starCoverage"]
    else:
        merged["starCoverage"] = {
            k: bool(star.get(k, fallback["starCoverage"].get(k)))
            for k in _STAR_PATTERNS
        }
    for list_key in ("missedPoints", "strengths", "keywordsHit"):
        value = merged.get(list_key)
        if isinstance(value, list):
            merged[list_key] = [str(item).strip() for item in value if str(item).strip()][:4]
        else:
            merged[list_key] = fallback.get(list_key) or []
    merged["feedback"] = str(merged.get("feedback") or fallback["feedback"]).strip()
    merged["modelAnswer"] = str(merged.get("modelAnswer") or fallback["modelAnswer"]).strip()
    merged["followUpHint"] = str(merged.get("followUpHint") or fallback.get("followUpHint") or "").strip()
    return merged


async def evaluate_answer(
    question: str,
    answer: str,
    role_id: str,
    *,
    resume_brief: str = "",
    job_description: str = "",
    target_job_title: str = "",
    difficulty: str = "standard",
    skipped: bool = False,
    persona_note: str = "",
    tech_slot: dict | None = None,
) -> dict:
    fallback = rule_based_evaluate(question, answer, difficulty=difficulty, skipped=skipped)
    if skipped or not is_llm_available():
        return fallback

    try:
        role = INTERVIEWER_ROLES.get(role_id) or INTERVIEWER_ROLES["technical"]
        role_name = role["name"]
        extra = []
        if persona_note:
            extra.append(persona_note)
        if tech_slot:
            extra.append(
                f"本题考点：{tech_slot.get('tech')} · {tech_slot.get('label')}。"
                "若回答只停留在「用过/做过」，没有原理、边界或故障处理，专业分不超过 55。"
            )
        if resume_brief:
            extra.append(resume_brief)
        if target_job_title:
            extra.append(f"目标岗位：{target_job_title}")
        if job_description:
            extra.append("JD：" + _clip(job_description, 500))
        extra.append((DIFFICULTIES.get(difficulty) or DIFFICULTIES["standard"])["instruction"])
        lang_note = (
            "英文面试时 modelAnswer 用英文，feedback 与 missedPoints 用中文，方便候选人复盘。"
            if role_id == "english"
            else "全部用中文。"
        )
        system_prompt = f"""你是{role_name}，正在严格评估候选人这一轮回答。{lang_note}
对照岗位与简历，指出空洞之处。返回 JSON：
{{
  "scoreLogic": 0-100,
  "scoreProfessional": 0-100,
  "scoreExpression": 0-100,
  "scoreMatch": 0-100,
  "scoreConfidence": 0-100,
  "feedback": "一句到位的改进建议，要点名缺了什么",
  "modelAnswer": "120-220字的满分示范，必须含背景、个人行动、量化结果",
  "starCoverage": {{"situation": true, "task": true, "action": true, "result": true}},
  "missedPoints": ["缺口1", "缺口2"],
  "strengths": ["亮点1"],
  "followUpHint": "面试官下一刀会追问什么",
  "keywordsHit": ["命中的关键词"]
}}
评分要拉开差距：空话不超过 55，有结构无数据 60-72，有个人贡献和数字才能 80+。
starCoverage 必须名副其实：没有场景就 situation=false，没有个人动作就 action=false，没有数字/可核对结果就 result=false。空话四项都应 false。"""
        user_prompt = "\n\n".join(
            extra
            + [
                f"问题：{question}",
                f"回答：{answer}",
            ]
        )
        result = await chat_completion(system_prompt, user_prompt, json_mode=True)
        parsed = parse_llm_json(result) if isinstance(result, str) else result
        if not isinstance(parsed, dict):
            parsed = json.loads(result)
        normalized = _normalize_evaluation(parsed, fallback)
        if len(answer.strip()) < 80:
            normalized["starCoverage"] = fallback["starCoverage"]
        return normalized
    except Exception:
        return fallback


def _verdict_for(score: int) -> dict[str, str]:
    if score >= 85:
        return {
            "id": "strong_hire",
            "label": "建议通过",
            "detail": "这一场已经接近可录用表达，进入下一轮把握较大。继续把弱项补成可复述的故事。",
        }
    if score >= 70:
        return {
            "id": "lean_hire",
            "label": "有条件通过",
            "detail": "方向对，但还有明显缺口。按训练计划把量化结果和个人贡献练熟再面。",
        }
    if score >= 55:
        return {
            "id": "hold",
            "label": "需要补强",
            "detail": "尚未达到一线面试官的通过线。先把 STAR 四段讲满，再练压力追问。",
        }
    return {
        "id": "no_hire",
        "label": "暂不推荐",
        "detail": "信息量或结构不足，容易在初试被刷。建议从热身难度把 90 秒故事打磨到能脱口而出。",
    }


def _dimension_drills() -> dict[str, str]:
    return {
        "scoreLogic": "把每段回答先写成三句话：背景 / 我做了什么 / 结果，再开口，禁止边想边说。",
        "scoreProfessional": "从简历里挑 1 个项目，补上指标基线、你的职责边界、备选方案和为什么没选。",
        "scoreExpression": "对着计时器讲 90 秒，删掉「那个/就是」，每句只保留一个动词。",
        "scoreMatch": "对照 JD 列 5 个关键词，每词准备一个 30 秒证据。",
        "scoreConfidence": "先写结论再展开。开头用「我的结论是…」，避免道歉式开场。",
    }


def build_session_report(
    qa_pairs: list[dict],
    transcript: dict | None = None,
    recording_url: str | None = None,
) -> dict:
    if not qa_pairs:
        empty_star = {key: 0 for key in _STAR_PATTERNS}
        return {
            "scoreLogic": 0,
            "scoreProfessional": 0,
            "scoreExpression": 0,
            "scoreMatch": 0,
            "scoreConfidence": 0,
            "overallScore": 0,
            "verdict": _verdict_for(0),
            "feedbackSummary": "本次面试暂无有效问答记录。请完整作答后再生成复盘。",
            "strengths": [],
            "weaknesses": ["没有完成有效问答"],
            "practicePlan": [
                "先用热身模式走完整场，每题至少讲清背景、行动、结果。",
                "从简历里准备 3 个能量化的项目故事。",
                "下一场改标准难度，专门练被追问时不换话题。",
            ],
            "starCoverage": empty_star,
            "questionReviews": [],
            **({"transcript": transcript} if transcript else {}),
            **({"recordingUrl": recording_url} if recording_url else {}),
        }

    score_keys = [
        "scoreLogic",
        "scoreProfessional",
        "scoreExpression",
        "scoreMatch",
        "scoreConfidence",
    ]
    scores = {
        key: round(sum(int(q["evaluation"].get(key) or 0) for q in qa_pairs) / len(qa_pairs))
        for key in score_keys
    }
    overall = round(
        scores["scoreLogic"] * 0.25
        + scores["scoreProfessional"] * 0.25
        + scores["scoreExpression"] * 0.15
        + scores["scoreMatch"] * 0.20
        + scores["scoreConfidence"] * 0.15
    )
    verdict = _verdict_for(overall)

    strength_counts: dict[str, int] = {}
    weak_counts: dict[str, int] = {}
    star_hits = {key: 0 for key in _STAR_PATTERNS}
    for pair in qa_pairs:
        evaluation = pair.get("evaluation") or {}
        for item in evaluation.get("strengths") or []:
            strength_counts[item] = strength_counts.get(item, 0) + 1
        for item in evaluation.get("missedPoints") or []:
            weak_counts[item] = weak_counts.get(item, 0) + 1
        coverage = evaluation.get("starCoverage") or {}
        for key in star_hits:
            if coverage.get(key):
                star_hits[key] += 1

    star_rate = {
        key: round(100 * hits / len(qa_pairs)) for key, hits in star_hits.items()
    }
    strengths = [k for k, _ in sorted(strength_counts.items(), key=lambda x: -x[1])[:4]]
    weaknesses = [k for k, _ in sorted(weak_counts.items(), key=lambda x: -x[1])[:4]]
    if not strengths:
        best = max(score_keys, key=lambda k: scores[k])
        labels = {
            "scoreLogic": "逻辑较清楚",
            "scoreProfessional": "专业表达尚可",
            "scoreExpression": "表达比较顺",
            "scoreMatch": "方向匹配还在线",
            "scoreConfidence": "态度比较稳定",
        }
        strengths = [labels[best]]
    if not weaknesses:
        worst = min(score_keys, key=lambda k: scores[k])
        labels = {
            "scoreLogic": "结构还需要更清楚",
            "scoreProfessional": "专业深度不够",
            "scoreExpression": "表达完整度不足",
            "scoreMatch": "和岗位的证据链偏弱",
            "scoreConfidence": "临场自信度不够",
        }
        weaknesses = [labels[worst]]

    drills = _dimension_drills()
    weakest = sorted(score_keys, key=lambda k: scores[k])[:3]
    practice_plan = [drills[key] for key in weakest]

    labels = {
        "scoreLogic": "逻辑",
        "scoreProfessional": "专业",
        "scoreExpression": "表达",
        "scoreMatch": "匹配",
        "scoreConfidence": "自信",
    }
    feedback_summary = "\n".join(
        [
            f"本场 {len(qa_pairs)} 轮问答，综合 {overall} 分，结论：{verdict['label']}。",
            "能力拆分 — " + " | ".join(f"{labels[k]} {scores[k]}" for k in score_keys),
            "STAR 覆盖 — "
            + " / ".join(
                f"{name} {star_rate[key]}%"
                for key, name in (
                    ("situation", "背景"),
                    ("task", "任务"),
                    ("action", "行动"),
                    ("result", "结果"),
                )
            ),
            "",
            verdict["detail"],
        ]
    )

    return {
        **scores,
        "overallScore": overall,
        "verdict": verdict,
        "feedbackSummary": feedback_summary,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "practicePlan": practice_plan,
        "starCoverage": star_rate,
        "questionReviews": qa_pairs,
        **({"transcript": transcript} if transcript else {}),
        **({"recordingUrl": recording_url} if recording_url else {}),
    }


async def generate_answer_hint(
    question: str,
    role_id: str,
    *,
    resume_brief: str = "",
    difficulty: str = "standard",
) -> dict:
    skeleton = {
        "situation": "用 1 句交代当时场景、角色和约束。",
        "task": "说明你要达成的目标和为什么是你来做。",
        "action": "只讲你亲自做的 2-3 个动作，含取舍。",
        "result": "给一个可核对的数字或上线/止损结果，再补一句复盘。",
    }
    talking_points = [
        "先结论后展开，避免从很远的公司介绍讲起。",
        "出现「我们」时，马上补「我负责哪一块」。",
        "至少准备一个数字：时长、规模、涨跌、故障分钟数。",
    ]
    if not is_llm_available():
        return {
            "starOutline": skeleton,
            "talkingPoints": talking_points,
            "warning": "这是答题骨架，不要照读。结合你自己的项目讲。",
        }

    try:
        role = INTERVIEWER_ROLES.get(role_id) or INTERVIEWER_ROLES["technical"]
        system_prompt = (
            f"你是面试教练，帮候选人组织「{role['name']}」这一题的答题骨架。"
            "不要写完整可背诵答案，只给提纲。返回 JSON："
            '{"starOutline":{"situation":"","task":"","action":"","result":""},'
            '"talkingPoints":["要点1","要点2","要点3"]}'
        )
        user_prompt = f"问题：{question}\n难度：{difficulty}\n{resume_brief}"
        result = await chat_completion(system_prompt, user_prompt, json_mode=True)
        parsed = parse_llm_json(result) if isinstance(result, str) else result
        if not isinstance(parsed, dict):
            parsed = json.loads(result)
        outline = parsed.get("starOutline") if isinstance(parsed.get("starOutline"), dict) else skeleton
        points = parsed.get("talkingPoints") if isinstance(parsed.get("talkingPoints"), list) else talking_points
        return {
            "starOutline": {
                "situation": str(outline.get("situation") or skeleton["situation"]),
                "task": str(outline.get("task") or skeleton["task"]),
                "action": str(outline.get("action") or skeleton["action"]),
                "result": str(outline.get("result") or skeleton["result"]),
            },
            "talkingPoints": [str(p) for p in points if str(p).strip()][:4] or talking_points,
            "warning": "这是答题骨架，不要照读。结合你自己的项目讲。",
        }
    except Exception:
        return {
            "starOutline": skeleton,
            "talkingPoints": talking_points,
            "warning": "这是答题骨架，不要照读。结合你自己的项目讲。",
        }
