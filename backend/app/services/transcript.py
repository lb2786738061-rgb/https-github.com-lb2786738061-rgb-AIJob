import re

FILLER_PATTERNS = [
    re.compile(r"^嗯+"),
    re.compile(r"^啊+"),
    re.compile(r"^那个+"),
    re.compile(r"^就是+"),
    re.compile(r"^然后+"),
    re.compile(r"^这个+"),
    re.compile(r"^呃+"),
    re.compile(r"^um+", re.I),
    re.compile(r"^uh+", re.I),
    re.compile(r"^like+", re.I),
    re.compile(r"^you know+", re.I),
]


def mark_filler_words(text: str) -> list[dict]:
    segments: list[dict] = []
    remaining = text

    while remaining:
        matched = False
        for pattern in FILLER_PATTERNS:
            m = pattern.match(remaining)
            if m:
                segments.append({"text": m.group(0), "isFiller": True})
                remaining = remaining[m.end():]
                matched = True
                break
        if not matched:
            next_filler = re.search(
                r"嗯|啊|那个|就是|然后|这个|呃|um|uh|like|you know",
                remaining,
                re.I,
            )
            chunk_end = next_filler.start() if next_filler else len(remaining)
            chunk = remaining[:chunk_end]
            if chunk:
                segments.append({"text": chunk, "isFiller": False})
                remaining = remaining[chunk_end:]
            else:
                remaining = remaining[1:]

    return [s for s in segments if s["text"]]


def build_transcript_report(qa_pairs: list[dict]) -> dict:
    full_transcript = "\n\n".join(
        f"【Q{i + 1}】{q['question']}\n【A{i + 1}】{q['answer']}"
        for i, q in enumerate(qa_pairs)
    )
    answer_text = " ".join(q["answer"] for q in qa_pairs)
    segments = mark_filler_words(answer_text)
    filler_count = sum(1 for s in segments if s["isFiller"])

    return {
        "fullTranscript": full_transcript,
        "segments": segments,
        "fillerCount": filler_count,
    }
