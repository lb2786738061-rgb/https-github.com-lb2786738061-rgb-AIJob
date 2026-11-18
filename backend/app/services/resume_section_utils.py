import re
from typing import Any

LIST_SECTION_KEYS = ("experience", "projects", "education", "skills")

SECTION_LABELS = {
    "experience": "工作经历",
    "projects": "项目经历",
    "education": "教育背景",
    "skills": "技能",
}

ITEM_MAX_LENGTH = 2000
RAW_TEXT_MAX = 12000
RAW_TEXT_CHUNK = 6000


def clean_list_items(items: list[str]) -> list[str]:
    cleaned: list[str] = []
    for item in items:
        lines: list[str] = []
        for line in (item or "").splitlines():
            text = re.sub(r"[ \t]+", " ", line).strip()
            if text:
                lines.append(text)
        text = "\n".join(lines)
        if text:
            cleaned.append(text[:ITEM_MAX_LENGTH])
    return cleaned


def item_fingerprint(text: str) -> str:
    normalized = re.sub(r"\s+", "", text or "")
    normalized = re.sub(r"[^\w\u4e00-\u9fff]", "", normalized)
    return normalized[:80].lower()


def raw_text_reference(raw_text: str) -> str:
    raw = raw_text or ""
    if len(raw) <= RAW_TEXT_MAX:
        return raw
    return f"{raw[:RAW_TEXT_CHUNK]}\n...\n{raw[-RAW_TEXT_CHUNK:]}"


def _item_matches_existing(item: str, updated_items: list[str], updated_fps: set[str]) -> bool:
    fp = item_fingerprint(item)
    if not fp:
        return False
    if fp in updated_fps:
        return True
    for updated in updated_items:
        updated_fp = item_fingerprint(updated)
        if not updated_fp:
            continue
        if fp in updated_fp or updated_fp in fp:
            return True
    return False


def preserve_section_lists(
    original_sections: dict[str, Any],
    updated_sections: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    merged = dict(updated_sections)
    notes: list[str] = []

    for key in LIST_SECTION_KEYS:
        original_items = [str(item) for item in (original_sections.get(key) or []) if item]
        updated_items = clean_list_items(list(updated_sections.get(key) or []))

        if not original_items:
            merged[key] = updated_items
            continue

        if not updated_items:
            merged[key] = clean_list_items(original_items)
            notes.append(f"已恢复 {len(original_items)} 条{SECTION_LABELS[key]}（模型未返回）")
            continue

        if len(updated_items) >= len(original_items):
            merged[key] = updated_items
            continue

        updated_fps = {item_fingerprint(item) for item in updated_items if item_fingerprint(item)}
        missing: list[str] = []
        for item in original_items:
            cleaned_items = clean_list_items([item])
            if not cleaned_items:
                continue
            cleaned = cleaned_items[0]
            if _item_matches_existing(cleaned, updated_items, updated_fps):
                continue
            missing.append(cleaned)
            fp = item_fingerprint(cleaned)
            if fp:
                updated_fps.add(fp)

        if missing:
            merged[key] = updated_items + missing
            notes.append(f"已恢复 {len(missing)} 条被遗漏的{SECTION_LABELS[key]}")
        else:
            merged[key] = updated_items

    return merged, notes


def build_sections_from_llm(
    original_sections: dict[str, Any],
    llm_sections: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    candidate = {
        "contact": str(llm_sections.get("contact") or original_sections.get("contact") or ""),
        "summary": str(llm_sections.get("summary") or original_sections.get("summary") or ""),
        "experience": clean_list_items(list(llm_sections.get("experience") or [])),
        "skills": clean_list_items(list(llm_sections.get("skills") or [])),
        "education": clean_list_items(list(llm_sections.get("education") or [])),
        "projects": clean_list_items(list(llm_sections.get("projects") or [])),
    }
    merged, notes = preserve_section_lists(original_sections, candidate)
    return merged, notes
