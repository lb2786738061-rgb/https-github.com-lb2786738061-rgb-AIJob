import re
import unicodedata
from pathlib import Path
from typing import NotRequired, TypedDict

from docx import Document
from pypdf import PdfReader

# 关键词按长度降序，保证 "核心技术栈" 优先于 "技能" 匹配
SECTION_KEYWORDS: dict[str, list[str]] = {
    "summary": ["个人简介", "个人优势", "自我评价", "自我介绍", "个人总结", "about", "summary", "profile"],
    "education": ["教育背景", "教育经历", "学历背景", "教育", "学历", "education", "academic"],
    "experience": ["工作经历", "工作履历", "实习经历", "工作经验", "工作", "experience", "employment", "work"],
    "skills": ["专业技能", "核心技能", "技能清单", "技能", "skills", "tech"],
    "projects": ["项目经历", "项目经验", "项目作品", "项目列表", "projects", "project"],
}

# 章节标题正则（完整行匹配，兼容尾部冒号）
SECTION_HEADER_PATTERN = re.compile(
    r"^("
    r"个人简介|个人优势|自我评价|自我介绍|个人总结|about|summary|profile|"
    r"教育背景|教育经历|学历背景|教育|学历|education|academic|"
    r"工作经历|工作履历|实习经历|工作经验|工作|experience|employment|work|"
    r"专业技能|核心技能|技术栈|技能清单|技能|skills|tech|"
    r"项目经历|项目经验|项目作品|项目列表|projects?|"
    r"证书|荣誉|奖项|获奖情况|"
    r"兴趣爱好|自我描述|个人评价"
    r")\s*[:：]?\s*$",
    re.I,
)

# 仅用较长标题拆行，避免短词「工作」「技能」误切「工作流」
LONG_SECTION_TITLES = (
    "个人简介", "个人优势", "自我评价", "自我介绍", "个人总结",
    "教育背景", "教育经历", "学历背景",
    "工作经历", "工作履历", "实习经历", "工作经验",
    "专业技能", "核心技能", "技能清单", "技术栈",
    "项目经历", "项目经验", "项目作品", "项目列表",
    "获奖情况", "兴趣爱好", "自我描述", "个人评价",
)
LONG_SECTION_TITLE_RE = re.compile(
    "(" + "|".join(sorted((re.escape(title) for title in LONG_SECTION_TITLES), key=len, reverse=True)) + ")"
)
CJK_SPACE_RE = re.compile(r"(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])")


class ParsedResume(TypedDict):
    rawText: str
    sections: dict
    layout: NotRequired[dict]


# Kangxi Radicals (U+2F00-2FDF) → CJK 常用汉字 手工映射表
# 这些是 PDF 中最常出现的兼容性部首字符
KANGXI_MAP = {
    "⻆": "角", "⻋": "车", "⻓": "长", "⻚": "页", "⻬": "齐",
    "⻔": "门", "⻢": "马", "⻛": "风", "⻜": "飞", "⻝": "食",
    "⻥": "鱼", "⻦": "鸟", "⻩": "黄", "⻰": "龙", "⻳": "龟",
    "⻅": "见", "⻉": "贝",
}


def _normalize_text(text: str) -> str:
    """NFKC 归一化 + Kangxi 部首映射：将 PDF 常见的兼容性 Unicode 还原为标准汉字。
    这是本解析器最关键的一步——否则所有中文章节标题匹配都会失效。
    """
    # NFKC 先处理能处理的（全角、半角、部分兼容字符）
    normalized = unicodedata.normalize("NFKC", text)
    # 再处理 Kangxi Radicals 等 NFKC 无法映射的兼容部首
    for old, new in KANGXI_MAP.items():
        normalized = normalized.replace(old, new)
    # PDF 常把标题拆成「工 作 经 历」，去掉汉字之间的空白，英文单词空格保留
    return CJK_SPACE_RE.sub("", normalized)


def _split_inline_section_headers(text: str) -> str:
    """把黏在正文里的章节标题拆成独占一行，便于后续整行匹配。"""
    lines: list[str] = []
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if not stripped:
            lines.append("")
            continue
        parts = LONG_SECTION_TITLE_RE.split(stripped)
        if len(parts) == 1:
            lines.append(stripped)
            continue
        for part in parts:
            piece = part.strip().lstrip(":：").strip()
            if piece:
                lines.append(piece)
    return "\n".join(lines)


def _is_section_header(line: str) -> bool:
    stripped = line.strip()
    if not stripped or len(stripped) > 40:
        return False
    return bool(SECTION_HEADER_PATTERN.match(stripped))


def _line_matches_keywords(line: str, keywords: list[str]) -> bool:
    """整行匹配才认为是章节标题，避免"工作流引擎"被误判为"工作"。"""
    stripped = line.strip()
    if not stripped or len(stripped) > 40:
        return False
    lower = stripped.lower()
    for keyword in sorted(keywords, key=len, reverse=True):
        key = keyword.lower()
        # 完全相等，或去掉尾部冒号后相等
        if lower == key or lower.rstrip(":：") == key:
            return True
        # "关键词: 内容" 的形式（如"技能：Python、Java"）
        if lower.startswith(key + ":") or lower.startswith(key + "："):
            return True
    return False


def _extract_section(text: str, keywords: list[str]) -> str | None:
    lines = text.splitlines()
    best: str | None = None

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not _line_matches_keywords(stripped, keywords):
            continue
        # 如果这行本身就是"xxx内容..."（含章节关键词但后面还有实质内容），
        # 说明这是标题和内容在同一行（如"技能：Python、Java"），需要把内容部分也纳入
        inline_content = ""
        for keyword in keywords:
            if stripped.lower().startswith(keyword.lower()):
                rest = stripped[len(keyword):].lstrip(":：").strip()
                if rest:
                    inline_content = rest
                break

        section_lines: list[str] = []
        if inline_content:
            section_lines.append(inline_content)
        for j in range(i + 1, len(lines)):
            nxt = lines[j].strip()
            if not nxt:
                if section_lines:
                    section_lines.append("")
                continue
            if _is_section_header(nxt) and j > i + 1:
                break
            section_lines.append(nxt)

        # 合并 PDF 软换行：把短行黏到前一行，形成完整段落
        # 但不合并明显是标题的行（含日期/竖线）或 bullet 行（数字/短横开头）
        merged: list[str] = []
        for ln in section_lines:
            if not ln:
                merged.append("")
                continue
            is_bullet = bool(
                re.match(r"^\d+[.、)\]）]\s*", ln) or re.match(r"^[-•*·▪◦]\s*", ln)
            )
            has_date = bool(ENTRY_HEADER_RE.search(ln))
            is_short_header = len(ln) <= 30 and not ln.endswith(
                ("。", "，", ",", "；", ";", "：", ":", ".")
            )
            is_entry_like = _is_entry_header(ln) or _looks_like_header(ln)
            is_body = bool(BODY_PREFIX_RE.match(ln))
            prev_is_header = bool(
                merged
                and merged[-1]
                and (_is_entry_header(merged[-1]) or _looks_like_header(merged[-1]))
            )
            # 前一行短、当前行不是 bullet/标题/正文要点 → 续行，合并
            if (
                merged
                and merged[-1]
                and len(merged[-1]) < 60
                and not is_bullet
                and not has_date
                and not is_short_header
                and not is_entry_like
                and not is_body
                and not prev_is_header
                and len(ln) < 60
            ):
                merged[-1] = merged[-1] + ln
            else:
                merged.append(ln)
        section_lines = merged

        content = "\n".join(section_lines).strip() or stripped
        if best is None or len(content) > len(best):
            best = content

    return best


ENTRY_HEADER_RE = re.compile(
    r"\d{4}(?:[./\-年]\d{1,2}(?:[./\-月]\d{1,2}日?)?)?月?"
    r"\s*[-–—~～至到]+"
    r"\s*(?:\d{4}(?:[./\-年]\d{1,2}(?:[./\-月]\d{1,2}日?)?)?月?|至今|现在|present|今)",
    re.I,
)

# 中文项目/职位条目常见标题模式：公司/项目名 + 职位 + 时间，或纯描述行
HEADER_HINT_RE = re.compile(
    r"(?:公司|大学|学院|项目|系统|平台|app|小程序|软件|工作室)|"
    r"(?:工程师|经理|主管|专员|实习|主管|开发|设计|运营|分析|架构)|"
    r"(?:开发|架构|设计|管理|负责|主导)",
    re.I,
)

# 明显属于正文描述的行（以这些动词/词组开头），不应作为条目边界
BODY_PREFIX_RE = re.compile(
    r"^(?:负责|参与|协助|主导|完成|使用|实现|优化|设计|开发|搭建|推动|跟进|支持|编写|维护|管理|"
    r"包括|涵盖|主要|具体|通过|基于|利用|结合|针对|解决|提升|降低|保障|确保|"
    r"简介|描述|背景|目标|成果|收获|体会)"
)


def _is_entry_header(line: str) -> bool:
    """判断该行是否像是一个新经历条目的标题行（包含日期范围或 | 分隔符）"""
    if ENTRY_HEADER_RE.search(line):
        return True
    if "|" in line or "｜" in line:
        return True
    return False


def _looks_like_header(line: str) -> bool:
    """无日期/竖线时的弱标题判断：较短 + 含机构/职位关键词 + 不是正文句式"""
    if ENTRY_HEADER_RE.search(line) or "|" in line or "｜" in line:
        return True
    if len(line) > 30:
        return False
    if BODY_PREFIX_RE.match(line):
        return False
    if line.endswith(("。", "；", ";", "，", ",")):
        return False
    if HEADER_HINT_RE.search(line):
        return True
    return False


def _split_section_items(section: str) -> list[str]:
    lines = [ln.strip() for ln in section.splitlines() if ln.strip()]
    if not lines:
        return []

    def is_header_line(line: str) -> bool:
        if ENTRY_HEADER_RE.search(line):
            return True
        return bool(re.search(r"\d{4}", line) and re.search(r"[-–—~～至到|｜]", line))

    def is_bullet_line(line: str) -> bool:
        return bool(re.match(r"^(?:\d+[.、)\]）]|[-•*·▪◦])\s*", line))

    def is_project_title_line(line: str) -> bool:
        stripped = re.sub(r"^(?:\d+[.、)\]）]|[-•*·▪◦])\s*", "", line).strip()
        if not stripped or len(stripped) > 40:
            return False
        if BODY_PREFIX_RE.match(stripped):
            return False
        if stripped.endswith(("。", "！", "？", "；", ";", "，", ",")):
            return False
        if re.match(r"项目(?:名称|名|[一二三四五六七八九十]+|\d+)\s*[:：]", stripped):
            return True
        if re.match(r"[【\[《<].{1,30}[】\]》>]", stripped):
            return True
        if re.search(r"项目|系统|平台|小程序|APP", stripped, re.I) and not re.search(
            r"公司|集团|有限", stripped
        ):
            return True
        return False

    def is_title_line(line: str) -> bool:
        if is_header_line(line) or is_bullet_line(line):
            return False
        if len(line) > 40 or re.search(r"[。！？；;，,]$", line):
            return False
        return True

    blocks: list[list[str]] = []
    current: list[str] = []

    for line in lines:
        if is_header_line(line) or is_project_title_line(line):
            if current:
                blocks.append(current)
            current = [line]
        elif is_bullet_line(line):
            if not current:
                current = [line]
            else:
                current.append(line)
        elif not current:
            current = [line]
        elif is_title_line(line):
            blocks.append(current)
            current = [line]
        else:
            current.append(line)

    if current:
        blocks.append(current)

    items: list[str] = []
    for block in blocks:
        cleaned_lines = [line.strip() for line in block if line.strip()]
        item = "\n".join(cleaned_lines).strip()
        if len(item) > 2:
            items.append(item)

    return items



def _extract_list_items(text: str, keywords: list[str]) -> list[str]:
    section = _extract_section(text, keywords)
    if not section:
        return []
    return _split_section_items(section)


def _iter_docx_blocks(doc: Document):
    from docx.oxml.ns import qn
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    body = doc.element.body
    for child in body.iterchildren():
        if child.tag == qn("w:p"):
            yield Paragraph(child, doc)
        elif child.tag == qn("w:tbl"):
            yield Table(child, doc)


def _table_row_text(row) -> str:
    cells: list[str] = []
    for cell in row.cells:
        text = " ".join(part.strip() for part in cell.text.splitlines() if part.strip())
        if text and (not cells or cells[-1] != text):
            cells.append(text)
    return " | ".join(cells)


def _extract_docx_text(doc: Document) -> str:
    parts: list[str] = []
    for block in _iter_docx_blocks(doc):
        from docx.table import Table
        from docx.text.paragraph import Paragraph

        if isinstance(block, Paragraph):
            text = block.text.strip()
            if text:
                parts.append(text)
        elif isinstance(block, Table):
            for row in block.rows:
                line = _table_row_text(row)
                if line:
                    parts.append(line)
    return "\n".join(parts)


def _is_text_block(block) -> bool:
    if len(block) > 6 and block[6] != 0:
        return False
    return bool((block[4] or "").strip())


def _block_center_x(block) -> float:
    return (block[0] + block[2]) / 2


def _sort_blocks(column: list) -> list:
    return sorted(column, key=lambda block: (round(block[1], 1), round(block[0], 1)))


def _split_column_groups(blocks: list, page_width: float) -> tuple[list, list] | None:
    """按水平中心的最大空隙分成两栏；空隙不够则视为单栏。"""
    if len(blocks) < 2 or page_width <= 0:
        return None
    ordered = sorted(blocks, key=_block_center_x)
    best_gap = 0.0
    split_at = -1
    for index in range(1, len(ordered)):
        gap = _block_center_x(ordered[index]) - _block_center_x(ordered[index - 1])
        if gap > best_gap:
            best_gap = gap
            split_at = index
    min_gap = max(24.0, page_width * 0.12)
    if split_at < 1 or best_gap < min_gap:
        return None
    left = ordered[:split_at]
    right = ordered[split_at:]
    if not left or not right:
        return None
    return left, right


def _column_text(blocks: list, page_width: float) -> str:
    usable = [block for block in blocks if _is_text_block(block)]
    if not usable:
        return ""

    columns = _split_column_groups(usable, page_width)
    if columns:
        left, right = columns
        lines = [block[4].strip() for block in _sort_blocks(left)]
        lines.append("")
        lines.extend(block[4].strip() for block in _sort_blocks(right))
        return "\n".join(lines).strip()

    usable = _sort_blocks(usable)
    return "\n".join(block[4].strip() for block in usable)


def _extract_pdf_text(path: Path) -> str:
    """Extract PDF text with column-aware ordering (PyMuPDF), fallback to pypdf."""
    try:
        import pymupdf

        doc = pymupdf.open(str(path))
        page_texts: list[str] = []
        for page in doc:
            blocks = page.get_text("blocks")
            text = _column_text(blocks, page.rect.width)
            if text:
                page_texts.append(text)
        doc.close()
        text = "\n\n".join(page_texts).strip()
        if text:
            return text
    except Exception:
        pass

    reader = PdfReader(str(path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _extract_contact(cleaned: str) -> str:
    """取开头几行作为联系方式，直到遇到第一个明确的章节标题为止。"""
    lines = cleaned.split("\n")
    head: list[str] = []
    for line in lines[:8]:
        if _is_section_header(line):
            break
        head.append(line)
        if len(head) >= 5:
            break
    return "\n".join(head)


def structure_resume_text(raw_text: str) -> ParsedResume:
    # NFKC 归一化必须在所有处理之前，否则章节标题无法匹配
    normalized = _normalize_text(raw_text)
    cleaned = re.sub(r"\s{3,}", "\n", normalized).strip()
    cleaned = _split_inline_section_headers(cleaned)
    return {
        "rawText": cleaned,
        "sections": {
            "contact": _extract_contact(cleaned),
            "summary": _extract_section(cleaned, SECTION_KEYWORDS["summary"]),
            "education": _extract_list_items(cleaned, SECTION_KEYWORDS["education"]),
            "experience": _extract_list_items(cleaned, SECTION_KEYWORDS["experience"]),
            "skills": _extract_list_items(cleaned, SECTION_KEYWORDS["skills"]),
            "projects": _extract_list_items(cleaned, SECTION_KEYWORDS["projects"]),
        },
    }


def parse_resume_file(file_path: str, mime_type: str = "") -> ParsedResume:
    path = Path(file_path)
    raw_text = ""

    if mime_type == "application/pdf" or path.suffix.lower() == ".pdf":
        raw_text = _extract_pdf_text(path)
    elif "word" in mime_type or path.suffix.lower() in (".docx", ".doc"):
        doc = Document(str(path))
        raw_text = _extract_docx_text(doc)
    elif mime_type == "text/plain" or path.suffix.lower() == ".txt":
        raw_text = path.read_text(encoding="utf-8")
    else:
        raise ValueError("Unsupported file format. Use PDF, Word, or TXT.")

    if not raw_text.strip():
        raise ValueError("Could not extract text from resume file.")

    return structure_resume_text(raw_text)
