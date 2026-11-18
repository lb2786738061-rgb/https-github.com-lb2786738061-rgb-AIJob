import re
from typing import Any

from app.services.resume_section_utils import (
    SECTION_LABELS,
    clean_list_items,
)

DATE_TOKEN = r"\d{4}(?:[./\-年]\d{1,2}(?:[./\-月]\d{1,2}日?)?)?月?"
DATE_END = rf"(?:{DATE_TOKEN}|至今|现在|present|今)"
DATE_RANGE_RE = re.compile(rf"({DATE_TOKEN})\s*[-–—~～至到]+\s*({DATE_END})", re.I)
BULLET_PREFIX_RE = re.compile(r"^(?:\d+[.、)\]）]\s+|[-•*·▪◦]\s+)")
NUMBERED_PREFIX_RE = re.compile(r"^(?:\d+[.、)\]）]|[（(][一二三四五六七八九十\d]+[)）]|[-•*·▪◦])\s*")
ACTION_PREFIX_RE = re.compile(
    r"^(?:[-•*]\s*)?(负责|参与|完成|使用|实现|主导|协助|优化|设计|开发了|搭建|推动|跟进|支持|编写|维护)"
)
ACTION_SPLIT_RE = re.compile(
    r"(?:(?<=\s)|(?<=[\u4e00-\u9fff。；;，,：:]))"
    r"(?=(?:负责|参与|完成|使用|实现|主导|协助|优化|设计|开发了|搭建|推动|跟进|支持|编写|维护)(?!人))"
)
PROJECT_ORDINAL = r"(?:名称|名|[一二三四五六七八九十]+|\d+)"
PROJECT_CHUNK_RE = re.compile(rf"(?=项目{PROJECT_ORDINAL}\s*[:：])")
PROJECT_LABEL_RE = re.compile(rf"^项目{PROJECT_ORDINAL}\s*[:：.、]\s*(.+)$")
BRACKET_HEADING_RE = re.compile(r"^[【\[《<](.+?)[】\]》>](.*)$")
NAME_FIELD_RE = re.compile(r"^(?:姓名|名字)\s*[:：]\s*(.+)$")
SKILL_LABEL_RE = re.compile(r"^(.{1,12}?)[:：](.+)$")
PROJECT_LIKE_RE = re.compile(r"项目|系统|平台|小程序|APP", re.I)
COMPANY_LIKE_RE = re.compile(r"公司|集团|科技|网络|有限|厂|银行|中心|部")

ENTRY_KEYS = ("experience", "projects", "education")


def _clean_bullet(line: str) -> str:
    return BULLET_PREFIX_RE.sub("", line or "").strip()


def _looks_like_header(line: str) -> bool:
    if DATE_RANGE_RE.search(line):
        return True
    return ("|" in line or "｜" in line) and len(line) <= 80


ROLE_HINT_RE = re.compile(r"(工程师|经理|主管|专员|实习生|实习|开发|设计|运营|分析|架构师|助理|顾问)$")
ORG_HINT_RE = re.compile(r"(公司|集团|科技|网络|有限|大学|学院|银行|中心|工作室)")


def _split_title_meta(title: str) -> tuple[str, str]:
    piped = [part.strip() for part in re.split(r"\s*[|｜]\s*", title) if part.strip()]
    if len(piped) >= 2:
        return piped[0], " | ".join(piped[1:])
    spaced = [part.strip() for part in re.split(r"\s{2,}", title) if part.strip()]
    if len(spaced) >= 2:
        return spaced[0], " | ".join(spaced[1:])
    parts = [part for part in title.split(" ") if part]
    if len(parts) >= 2:
        if ORG_HINT_RE.search(parts[0]) and re.search(r"(本科|硕士|博士|研究生|学士)$", parts[-1]):
            return parts[0], " ".join(parts[1:])
        org = " ".join(parts[:-1])
        role = parts[-1]
        if ORG_HINT_RE.search(org) and ROLE_HINT_RE.search(role):
            return org, role
    return title.strip(), ""


def split_header(header: str) -> tuple[str, str, str | None]:
    """Return (org, role, date) from a title line."""
    date = None
    last_match = None
    for match in DATE_RANGE_RE.finditer(header):
        last_match = match
    rest = header
    if last_match:
        date = last_match.group(0).strip()
        rest = (header[: last_match.start()] + header[last_match.end() :]).strip()
    rest = re.sub(r"^[|｜\s]+|[|｜\s]+$", "", rest)
    rest = re.sub(r"\s*[|｜]\s*", " | ", rest)
    rest = re.sub(r"\s+", " ", rest).strip()
    org, role = _split_title_meta(rest or header)
    return org, role, date


def _split_name_and_duty(text: str) -> tuple[str, str | None, list[str]]:
    date = None
    last_match = None
    for match in DATE_RANGE_RE.finditer(text):
        last_match = match
    rest = text
    if last_match:
        date = last_match.group(0).strip()
        rest = (text[: last_match.start()] + text[last_match.end() :]).strip()
    rest = re.sub(r"^[|｜\s]+|[|｜\s]+$", "", rest).strip()
    parts = [part.strip() for part in ACTION_SPLIT_RE.split(rest) if part.strip()]
    if len(parts) >= 2:
        return parts[0].rstrip(" ，,;；|｜"), date, parts[1:]
    sentences = [part.strip() for part in re.split(r"(?<=[。！？])", rest) if part.strip()]
    if len(sentences) >= 2 and len(sentences[0]) <= 40 and not ACTION_PREFIX_RE.match(sentences[0]):
        return sentences[0].rstrip(" ，,;；|｜"), date, sentences[1:]
    return rest, date, []


def parse_project_heading(line: str) -> dict[str, Any] | None:
    """Return a sub-level entry when the line is a project title, not a duty sentence."""
    raw = (line or "").strip()
    if not raw:
        return None
    stripped = NUMBERED_PREFIX_RE.sub("", raw).strip()
    if not stripped:
        return None

    labeled = PROJECT_LABEL_RE.match(stripped)
    if labeled:
        name, date, duties = _split_name_and_duty(labeled.group(1).strip())
        if name:
            return {"org": name, "role": "", "date": date, "bullets": duties, "isSubLevel": True}

    bracket = BRACKET_HEADING_RE.match(stripped)
    if bracket:
        inner = bracket.group(1).strip()
        tail = (bracket.group(2) or "").strip()
        if inner and not ACTION_PREFIX_RE.match(inner) and len(inner) <= 40:
            combined = f"{inner} {tail}".strip() if tail else inner
            name, date, duties = _split_name_and_duty(combined)
            return {
                "org": name or inner,
                "role": "",
                "date": date,
                "bullets": duties,
                "isSubLevel": True,
            }

    if ACTION_PREFIX_RE.match(stripped):
        return None
    if re.search(r"[。！？]$", stripped) and len(stripped) > 24:
        return None
    if COMPANY_LIKE_RE.search(stripped):
        return None
    if len(stripped) <= 40 and PROJECT_LIKE_RE.search(stripped):
        name, date, duties = _split_name_and_duty(stripped)
        if name and len(name) <= 40 and not ACTION_PREFIX_RE.match(name):
            return {"org": name, "role": "", "date": date, "bullets": duties, "isSubLevel": True}
    return None


def _split_mashed_tail(role: str) -> tuple[str, list[str]]:
    if not role:
        return role, []
    chunks = [part.strip() for part in PROJECT_CHUNK_RE.split(role) if part.strip()]
    if len(chunks) >= 2:
        head = chunks[0].rstrip(" ，,;；|｜")
        rest = chunks[1:]
        if parse_project_heading(head):
            return "", [head, *rest]
        return head, rest
    if len(role) < 24:
        return role, []
    parts = [part.strip() for part in ACTION_SPLIT_RE.split(role) if part.strip()]
    if len(parts) < 2:
        sentences = [part.strip() for part in re.split(r"(?<=[。！？])", role) if part.strip()]
        if len(sentences) >= 2 and len(sentences[0]) <= 40:
            return sentences[0], sentences[1:]
        return role, []
    head = parts[0].rstrip(" ，,;；|｜")
    bullets = [part for part in parts[1:] if part]
    if head and (ACTION_PREFIX_RE.match(head) or len(head) > 40):
        return "", [head, *bullets]
    return head, bullets


def _expand_project_chunks(texts: list[str]) -> list[str]:
    expanded: list[str] = []
    for text in texts:
        parts = [part.strip() for part in PROJECT_CHUNK_RE.split(text) if part.strip()]
        expanded.extend(parts or ([text] if text else []))
    return expanded


def split_company_projects(entry: dict[str, Any]) -> list[dict[str, Any]]:
    """Split project titles out of a company entry's bullets into isSubLevel children."""
    if not entry or entry.get("isSubLevel"):
        return [entry] if entry else []
    bullets = [str(item).strip() for item in (entry.get("bullets") or []) if str(item).strip()]
    fragments = _expand_project_chunks(bullets)
    if not fragments:
        return [entry]

    company_bullets: list[str] = []
    children: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for fragment in fragments:
        heading = parse_project_heading(fragment)
        if heading:
            current = heading
            children.append(current)
            continue
        if current is not None:
            current["bullets"] = [*(current.get("bullets") or []), fragment]
        else:
            company_bullets.append(fragment)

    if not children:
        return [entry]

    parent = dict(entry)
    parent["bullets"] = company_bullets
    parent["isSubLevel"] = False
    return [parent, *children]


def expand_experience_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    expanded: list[dict[str, Any]] = []
    for entry in entries:
        expanded.extend(split_company_projects(entry))
    return expanded


def parse_entry_from_item(item: str, context: str = "experience") -> dict[str, Any] | None:
    lines = [line.strip() for line in (item or "").splitlines() if line.strip()]
    if not lines:
        return None

    header = lines[0]
    rest_lines = lines[1:]
    if not _looks_like_header(header) and rest_lines and _looks_like_header(rest_lines[0]):
        header = rest_lines[0]
        rest_lines = [lines[0], *rest_lines[1:]]

    org, role, date = split_header(header)
    bullets = [_clean_bullet(line) for line in rest_lines if _clean_bullet(line)]

    extra_org, org_bullets = _split_mashed_tail(org)
    if org_bullets:
        org = extra_org
        bullets = org_bullets + bullets

    extra_role, extra_bullets = _split_mashed_tail(role)
    if extra_bullets:
        role = extra_role
        bullets = extra_bullets + bullets

    if NUMBERED_PREFIX_RE.match(org) and PROJECT_LIKE_RE.search(org) and not COMPANY_LIKE_RE.search(org):
        org = NUMBERED_PREFIX_RE.sub("", org).strip()

    if not org and not role and not bullets:
        return None

    is_sub_level = False
    if context == "experience" and (not date) and PROJECT_LIKE_RE.search(org or role) and not COMPANY_LIKE_RE.search(org or ""):
        is_sub_level = True

    return {
        "org": org,
        "role": role,
        "date": date,
        "bullets": bullets,
        "isSubLevel": is_sub_level,
    }


def parse_contact_layout(contact: str, resume_title: str = "") -> tuple[str, list[dict[str, str]]]:
    fragments: list[str] = []
    for line in (contact or "").splitlines():
        text = line.strip()
        if not text:
            continue
        for part in re.split(r"[|｜]", text):
            piece = part.strip()
            if piece:
                fragments.append(piece)

    name = ""
    name_source = None
    for fragment in fragments:
        labeled = NAME_FIELD_RE.match(fragment)
        if labeled and len(labeled.group(1).strip()) <= 30:
            name = labeled.group(1).strip()
            name_source = fragment
            break
    if not name and fragments:
        first = fragments[0]
        if len(first) <= 30 and "@" not in first and ":" not in first and "：" not in first:
            name = first
            name_source = first
    if not name:
        name = resume_title

    pieces = [{"text": fragment} for fragment in fragments if fragment != name_source]
    return name, pieces


def parse_skills_layout(items: list[str]) -> dict[str, Any]:
    groups: list[dict[str, Any]] = []
    for item in items:
        for line in (item or "").splitlines():
            text = line.strip()
            if not text:
                continue
            labeled = SKILL_LABEL_RE.match(text)
            if labeled:
                tokens = [token.strip() for token in re.split(r"[、，,;/；]", labeled.group(2)) if token.strip()]
                groups.append({"label": labeled.group(1).strip(), "items": tokens})
                continue
            tokens = [token.strip() for token in re.split(r"[、，,;/；]", text) if token.strip()]
            if tokens:
                groups.append({"label": None, "items": tokens})
    return {"groups": groups}


def layout_from_sections(sections: dict[str, Any], resume_title: str = "") -> dict[str, Any]:
    name, contact = parse_contact_layout(str(sections.get("contact") or ""), resume_title)
    experience = expand_experience_entries(
        [
            entry
            for item in clean_list_items(list(sections.get("experience") or []))
            if (entry := parse_entry_from_item(item, "experience"))
        ]
    )
    projects = [
        entry
        for item in clean_list_items(list(sections.get("projects") or []))
        if (entry := parse_entry_from_item(item, "projects"))
    ]
    education = [
        entry
        for item in clean_list_items(list(sections.get("education") or []))
        if (entry := parse_entry_from_item(item, "education"))
    ]
    return {
        "name": name,
        "contact": contact,
        "summary": str(sections.get("summary") or "").strip(),
        "experience": experience,
        "projects": projects,
        "education": education,
        "skills": parse_skills_layout(list(sections.get("skills") or [])),
    }


def flatten_entry(entry: dict[str, Any]) -> str:
    header_parts = [str(entry.get("org") or "").strip(), str(entry.get("role") or "").strip()]
    date = str(entry.get("date") or "").strip()
    if date:
        header_parts.append(date)
    header = " | ".join(part for part in header_parts if part)
    bullets = [str(bullet).strip() for bullet in (entry.get("bullets") or []) if str(bullet).strip()]
    if header and bullets:
        return header + "\n" + "\n".join(bullets)
    return header or "\n".join(bullets)


def flatten_skills(skills: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    for group in skills.get("groups") or []:
        items = [str(item).strip() for item in (group.get("items") or []) if str(item).strip()]
        label = str(group.get("label") or "").strip()
        if label and items:
            lines.append(f"{label}：{'、'.join(items)}")
        elif items:
            lines.extend(items)
        elif label:
            lines.append(label)
    return lines


def flatten_layout_to_sections(layout: dict[str, Any]) -> dict[str, Any]:
    contact_lines = [str(layout.get("name") or "").strip()]
    contact_lines.extend(
        str(piece.get("text") or "").strip()
        for piece in (layout.get("contact") or [])
        if isinstance(piece, dict) and str(piece.get("text") or "").strip()
    )
    return {
        "contact": "\n".join(line for line in contact_lines if line),
        "summary": str(layout.get("summary") or "").strip(),
        "experience": [flatten_entry(entry) for entry in (layout.get("experience") or []) if flatten_entry(entry)],
        "projects": [flatten_entry(entry) for entry in (layout.get("projects") or []) if flatten_entry(entry)],
        "education": [flatten_entry(entry) for entry in (layout.get("education") or []) if flatten_entry(entry)],
        "skills": flatten_skills(layout.get("skills") or {}),
    }


def _clean_string_list(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    return [str(item).strip() for item in values if str(item).strip()]


def normalize_entry(raw: Any) -> dict[str, Any] | None:
    if isinstance(raw, str):
        return parse_entry_from_item(raw)
    if not isinstance(raw, dict):
        return None
    org = str(raw.get("org") or raw.get("title") or raw.get("company") or raw.get("school") or "").strip()
    role = str(raw.get("role") or raw.get("subtitle") or raw.get("position") or "").strip()
    date_value = raw.get("date")
    date = str(date_value).strip() if date_value else None
    bullets = _clean_string_list(raw.get("bullets") or raw.get("items") or [])
    if not org and not role and not bullets:
        return None
    extra_role, extra_bullets = _split_mashed_tail(role)
    if extra_bullets:
        role = extra_role
        bullets = extra_bullets + bullets
    return {
        "org": org,
        "role": role,
        "date": date or None,
        "bullets": bullets,
        "isSubLevel": bool(raw.get("isSubLevel") or raw.get("is_sub_level")),
    }


def normalize_layout(raw: Any, fallback_sections: dict[str, Any], resume_title: str = "") -> dict[str, Any]:
    fallback = layout_from_sections(fallback_sections, resume_title)
    if not isinstance(raw, dict):
        return fallback

    name = str(raw.get("name") or fallback.get("name") or resume_title).strip()
    contact_raw = raw.get("contact")
    contact: list[dict[str, str]] = []
    if isinstance(contact_raw, list):
        for piece in contact_raw:
            if isinstance(piece, dict) and str(piece.get("text") or "").strip():
                contact.append({"text": str(piece.get("text")).strip()})
            elif isinstance(piece, str) and piece.strip():
                contact.append({"text": piece.strip()})
    if not contact:
        contact = list(fallback.get("contact") or [])

    summary = str(raw.get("summary") if raw.get("summary") is not None else fallback.get("summary") or "").strip()

    def entries_for(key: str) -> list[dict[str, Any]]:
        parsed = [entry for item in (raw.get(key) or []) if (entry := normalize_entry(item))]
        if key == "experience":
            parsed = expand_experience_entries(parsed)
        return parsed or list(fallback.get(key) or [])

    skills_raw = raw.get("skills")
    skills = fallback.get("skills") or {"groups": []}
    if isinstance(skills_raw, dict):
        groups = []
        for group in skills_raw.get("groups") or []:
            if not isinstance(group, dict):
                continue
            items = _clean_string_list(group.get("items") or [])
            label = str(group.get("label") or "").strip() or None
            if items or label:
                groups.append({"label": label, "items": items})
        if groups:
            skills = {"groups": groups}
    elif isinstance(skills_raw, list) and skills_raw:
        skills = parse_skills_layout([str(item) for item in skills_raw])

    return {
        "name": name or resume_title,
        "contact": contact,
        "summary": summary,
        "experience": entries_for("experience"),
        "projects": entries_for("projects"),
        "education": entries_for("education"),
        "skills": skills,
    }


def _alnum_text(text: str) -> str:
    return re.sub(r"[^\w\u4e00-\u9fff]", "", text or "").lower()


def texts_overlap(original: str, candidate: str) -> bool:
    source = _alnum_text(original)
    target = _alnum_text(candidate)
    if not source or not target:
        return False
    if source in target or target in source:
        return True
    shorter, longer = (source, target) if len(source) <= len(target) else (target, source)
    if len(shorter) < 8:
        return shorter in longer
    hits = 0
    step = 6
    for index in range(0, len(shorter) - step + 1, step):
        if shorter[index : index + step] in longer:
            hits += 1
    return hits >= max(1, (len(shorter) - step) // step // 2 + 1)


def entry_fingerprint_text(entry: dict[str, Any]) -> str:
    return flatten_entry(entry)


def looks_mashed(item: str) -> bool:
    """True when a parsed item is still one glued blob, not a header + bullets."""
    text = (item or "").strip()
    if not text:
        return False
    lines = [line for line in text.splitlines() if line.strip()]
    if len(lines) <= 1 and len(text) > 160:
        return True
    recovered = parse_entry_from_item(text)
    if not recovered:
        return len(text) > 120
    org = str(recovered.get("org") or "")
    bullets = list(recovered.get("bullets") or [])
    if len(org) > 60 and ("。" in org or ACTION_PREFIX_RE.search(org)):
        return True
    if not recovered.get("date") and not bullets and len(org) > 80:
        return True
    return False


def sections_look_sparse(sections: dict[str, Any]) -> bool:
    experience = list(sections.get("experience") or [])
    education = list(sections.get("education") or [])
    projects = list(sections.get("projects") or [])
    return len(experience) + len(education) + len(projects) == 0


def preserve_layout_entries(
    original_sections: dict[str, Any],
    layout: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    notes: list[str] = []
    merged = dict(layout)
    skipped_mashed = 0

    for key in ENTRY_KEYS:
        original_items = clean_list_items([str(item) for item in (original_sections.get(key) or []) if item])
        current = list(merged.get(key) or [])
        missing: list[dict[str, Any]] = []
        for item in original_items:
            if any(texts_overlap(item, entry_fingerprint_text(entry)) for entry in current):
                continue
            if looks_mashed(item):
                skipped_mashed += 1
                continue
            recovered = parse_entry_from_item(item, key)
            if recovered and not looks_mashed(flatten_entry(recovered)):
                pieces = split_company_projects(recovered) if key == "experience" else [recovered]
                missing.extend(pieces)
                current.extend(pieces)
            else:
                skipped_mashed += 1

        if key == "experience":
            current = expand_experience_entries(current)
        if missing or key == "experience":
            merged[key] = current
        if missing:
            notes.append(f"已恢复 {len(missing)} 条被遗漏的{SECTION_LABELS[key]}")

    if skipped_mashed:
        notes.append(f"有 {skipped_mashed} 条粘连原文未回补，需从全文重新拆条")

    return merged, notes
