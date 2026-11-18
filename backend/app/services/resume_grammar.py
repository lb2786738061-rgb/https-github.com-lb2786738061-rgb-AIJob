import re
from typing import TypedDict

from app.services.resume_parser import ParsedResume


class GrammarCheckResult(TypedDict):
    scoreGrammar: int
    grammarIssues: list[str]
    grammarReport: str


COMMON_TYPOS = [
    (r"做位", "作为"),
    (r"在次", "在此"),
    (r"以经", "已经"),
    (r"帐号", "账号"),
    (r"部份", "部分"),
    (r"侯选", "候选"),
    (r"入职公司\s*[:：]?\s*$", None),
]

WEAK_VERBS = ["负责", "参与", "协助", "配合", "了解", "熟悉"]


def check_grammar_spelling(parsed: ParsedResume) -> GrammarCheckResult:
    text = parsed["rawText"]
    issues: list[str] = []

    if re.search(r"[，,。\.！!？?；;]{2,}", text):
        issues.append("存在重复标点符号，建议检查排版")

    if re.search(r"\s{2,}", text):
        issues.append("存在多余空格或排版不整齐")

    for wrong, correct in COMMON_TYPOS:
        if re.search(wrong, text):
            hint = f"疑似错别字：「{wrong}」"
            if correct:
                hint += f"，建议改为「{correct}」"
            issues.append(hint)

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for line in lines:
        if len(line) > 80 and "。" not in line and "；" not in line:
            issues.append("部分句子过长，建议拆分为短句提升可读性")
            break

    passive_count = sum(text.count(v) for v in WEAK_VERBS)
    if passive_count >= 5:
        issues.append(
            f"被动/弱动词出现 {passive_count} 次（如负责、参与），建议改为成果导向表述"
        )

    quant_ratio = len(re.findall(r"\d+%|\d+万|\d+倍", text)) / max(len(lines), 1)
    if quant_ratio < 0.15 and len(lines) > 8:
        issues.append("量化表述偏少，建议补充百分比、金额、规模等数字")

    if not re.search(r"[。！？\.!?]", text) and len(text) > 200:
        issues.append("全文缺少句号分段，影响阅读体验")

    score = max(40, 100 - len(issues) * 12)
    report_lines = [
        f"语法与排版评分：{score}/100",
        "",
        "【检测到的问题】" if issues else "【检测结果】",
    ]
    if issues:
        report_lines.extend(f"• {item}" for item in issues)
    else:
        report_lines.append("未发现明显语法错别字或排版问题")

    return {
        "scoreGrammar": score,
        "grammarIssues": issues,
        "grammarReport": "\n".join(report_lines),
    }


def merge_grammar_into_diagnosis(diagnosis: dict, grammar: GrammarCheckResult) -> dict:
    merged = dict(diagnosis)
    report = merged.get("diagnosisReport") or ""
    merged["diagnosisReport"] = report + "\n\n" + grammar["grammarReport"]
    issues = list(merged.get("issues") or [])
    issues.extend(grammar["grammarIssues"])
    merged["issues"] = issues
    merged["scoreGrammar"] = grammar["scoreGrammar"]
    return merged
