import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse

from app.config import UPLOAD_DIR
from app.db.connection import get_db
from app.middleware.auth import get_auth_context
from app.services import quota as quota_service
from app.services.llm import is_llm_available
from app.services.resume_analysis import persist_analysis, run_full_analysis
from app.services.resume_diagnosis import diagnosis_db_fields
from app.services.resume_beautify import beautify_resume_content
from app.services.resume_enhancer import enhance_resume_content
from app.services.resume_parser import parse_resume_file
from app.services.star_rewrite import rewrite_from_star_fields
from app.utils import row_to_camel, rows_to_camel

router = APIRouter()
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_EXT = {".pdf", ".doc", ".docx", ".txt"}

Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


def _require_llm() -> None:
    if not is_llm_available():
        raise HTTPException(
            status_code=503,
            detail={
                "error": "请先配置 OPENAI_API_KEY 启用大模型",
                "code": "LLM_REQUIRED",
            },
        )


def _analysis_response(row, analysis) -> dict:
    resume = row_to_camel(row)
    return {
        "resume": resume,
        "diagnosis": analysis["diagnosis"],
        "jdMatch": analysis["jd_match"],
        "starRewrite": analysis["star_result"],
        "analysisStatus": resume.get("analysisStatus") or "complete",
        "analysisSource": analysis.get("analysis_source", "llm"),
        "grammarCheck": analysis.get("grammar_check"),
    }


@router.get("")
async def list_resumes(auth: dict = Depends(get_auth_context)):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM user_resume WHERE user_id = ? ORDER BY updated_at DESC",
        (auth["userId"],),
    ).fetchall()
    return rows_to_camel(rows)


@router.get("/{resume_id}")
async def get_resume(resume_id: int, auth: dict = Depends(get_auth_context)):
    db = get_db()
    row = db.execute(
        "SELECT * FROM user_resume WHERE id = ?", (resume_id,)
    ).fetchone()
    if not row or row["user_id"] != auth["userId"]:
        raise HTTPException(status_code=404, detail={"error": "Not found"})
    return row_to_camel(row)


def _title_from_upload(resume_title: str, filename: str | None) -> str:
    title = (resume_title or "").strip() or "我的简历"
    if title != "我的简历":
        return title
    stem = Path(filename or "").stem.strip()
    return stem or title


def _get_owned_resume_row(resume_id: int, user_id: int):
    db = get_db()
    row = db.execute(
        "SELECT * FROM user_resume WHERE id = ?", (resume_id,)
    ).fetchone()
    if not row or row["user_id"] != user_id:
        raise HTTPException(status_code=404, detail={"error": "Not found"})
    return row


def _resolve_stored_file(row) -> Path:
    stored = row["stored_file_path"]
    if not stored:
        raise HTTPException(
            status_code=404,
            detail={"error": "原文件不可用，请重新上传简历"},
        )
    file_path = Path(UPLOAD_DIR) / stored
    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail={"error": "原文件已丢失，请重新上传简历"},
        )
    return file_path


@router.get("/{resume_id}/file")
async def get_resume_file(resume_id: int, auth: dict = Depends(get_auth_context)):
    row = _get_owned_resume_row(resume_id, auth["userId"])
    file_path = _resolve_stored_file(row)

    mime = row["file_mime_type"] or "application/octet-stream"
    download_name = row["original_file_name"] or f"resume{file_path.suffix}"
    return FileResponse(
        path=file_path,
        media_type=mime,
        filename=download_name,
        content_disposition_type="inline",
    )


@router.get("/{resume_id}/preview")
async def preview_resume(resume_id: int, auth: dict = Depends(get_auth_context)):
    """Return HTML preview for Word resumes while preserving document structure."""
    import mammoth

    row = _get_owned_resume_row(resume_id, auth["userId"])
    file_path = _resolve_stored_file(row)
    ext = file_path.suffix.lower()

    if ext not in (".docx", ".doc"):
        raise HTTPException(
            status_code=400,
            detail={"error": "仅 Word 简历支持 HTML 预览，PDF 请使用原文件视图"},
        )

    with file_path.open("rb") as docx_file:
        result = mammoth.convert_to_html(docx_file)

    html_body = result.value or "<p>（未能提取 Word 内容）</p>"
    page = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {{
      margin: 0;
      padding: 24px 32px 40px;
      background: #fff;
      color: #1a2e28;
      font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
      font-size: 14px;
      line-height: 1.65;
    }}
    p {{ margin: 0 0 0.75em; }}
    h1, h2, h3, h4 {{ margin: 1.2em 0 0.5em; line-height: 1.35; }}
    ul, ol {{ margin: 0.5em 0 1em; padding-left: 1.5em; }}
    table {{ border-collapse: collapse; width: 100%; margin: 0.75em 0; }}
    td, th {{ border: 1px solid #d9e2de; padding: 6px 10px; vertical-align: top; }}
    strong, b {{ font-weight: 700; }}
  </style>
</head>
<body>{html_body}</body>
</html>"""
    return HTMLResponse(content=page)


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    resumeTitle: str = Form("我的简历"),
    targetJobTitle: str = Form(""),
    jobDescription: str = Form(""),
    auth: dict = Depends(get_auth_context),
):
    _require_llm()

    quota_check = await quota_service.check_resume_quota(auth)
    if not quota_check["allowed"]:
        raise HTTPException(
            status_code=403,
            detail={"error": quota_check["message"], "code": "QUOTA_EXCEEDED"},
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail={"error": "文件大小不能超过 10MB"})

    ext = "." + (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400, detail={"error": "仅支持 PDF、Word、TXT 格式"}
        )

    file_name = f"{uuid.uuid4()}{ext}"
    file_path = Path(UPLOAD_DIR) / file_name
    file_path.write_bytes(content)

    parsed = parse_resume_file(str(file_path), file.content_type or "")

    try:
        analysis = await run_full_analysis(parsed, jobDescription, targetJobTitle)
    except Exception as exc:
        file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=502,
            detail={"error": f"大模型分析失败: {exc}", "code": "LLM_ANALYSIS_FAILED"},
        ) from exc

    parsed = analysis.get("parsed") or parsed

    now = datetime.now(timezone.utc).isoformat()
    diagnosis = analysis["diagnosis"]
    jd_match = analysis["jd_match"]
    star_result = analysis["star_result"]
    stored_title = _title_from_upload(resumeTitle, file.filename)
    (
        score_overall,
        score_clarity,
        score_competitiveness,
        score_professionalism,
        diagnosis_report,
    ) = diagnosis_db_fields(diagnosis)

    db = get_db()
    cursor = db.execute(
        """INSERT INTO user_resume (
            user_id, resume_title, target_job_title, job_description,
            original_file_name, stored_file_path, file_mime_type, parsed_json,
            score_overall, score_clarity, score_competitiveness, score_match,
            score_professionalism, match_percentage, missing_keywords, jd_match_report,
            diagnosis_report, star_suggestions, analysis_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            auth["userId"],
            stored_title,
            targetJobTitle,
            jobDescription,
            file.filename,
            file_name,
            file.content_type or "",
            json.dumps(parsed, ensure_ascii=False),
            score_overall,
            score_clarity,
            score_competitiveness,
            jd_match["scoreMatch"] if jd_match else None,
            score_professionalism,
            jd_match["matchPercentage"] if jd_match else None,
            json.dumps(jd_match["missingKeywords"], ensure_ascii=False) if jd_match else None,
            jd_match["report"] if jd_match else None,
            diagnosis_report,
            json.dumps(star_result, ensure_ascii=False),
            "complete",
            now,
            now,
        ),
    )
    db.commit()

    resume_id = cursor.lastrowid
    row = db.execute(
        "SELECT * FROM user_resume WHERE id = ?", (resume_id,)
    ).fetchone()
    await quota_service.consume_resume_diagnose(
        auth, resume_id, quota_check.get("me")
    )

    return _analysis_response(row, analysis)


@router.post("/{resume_id}/analyze")
async def analyze_resume(
    resume_id: int,
    body: dict,
    auth: dict = Depends(get_auth_context),
):
    _require_llm()

    quota_check = await quota_service.check_reanalyze_quota(auth)
    if not quota_check["allowed"]:
        raise HTTPException(
            status_code=403,
            detail={"error": quota_check["message"], "code": "QUOTA_EXCEEDED"},
        )

    db = get_db()
    row = db.execute(
        "SELECT * FROM user_resume WHERE id = ?", (resume_id,)
    ).fetchone()
    if not row or row["user_id"] != auth["userId"]:
        raise HTTPException(status_code=404, detail={"error": "Not found"})

    parsed = json.loads(row["parsed_json"] or "{}")
    jd = body.get("jobDescription") or row["job_description"] or ""
    target_job_title = body.get("targetJobTitle") or row["target_job_title"]

    try:
        analysis = await run_full_analysis(parsed, jd, target_job_title or "")
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"error": f"大模型分析失败: {exc}", "code": "LLM_ANALYSIS_FAILED"},
        ) from exc

    persist_analysis(
        resume_id,
        analysis,
        analysis_status="complete",
        target_job_title=target_job_title,
        job_description=jd,
    )

    await quota_service.consume_reanalyze(auth, resume_id)

    updated = db.execute(
        "SELECT * FROM user_resume WHERE id = ?", (resume_id,)
    ).fetchone()

    return _analysis_response(updated, analysis)


@router.post("/{resume_id}/star-rewrite")
async def star_rewrite(
    resume_id: int, body: dict, auth: dict = Depends(get_auth_context)
):
    db = get_db()
    row = db.execute(
        "SELECT * FROM user_resume WHERE id = ?", (resume_id,)
    ).fetchone()
    if not row or row["user_id"] != auth["userId"]:
        raise HTTPException(status_code=404, detail={"error": "Not found"})

    rewritten = rewrite_from_star_fields(body)
    return {"rewritten": rewritten}


@router.patch("/{resume_id}")
async def patch_resume(
    resume_id: int, body: dict, auth: dict = Depends(get_auth_context)
):
    db = get_db()
    row = db.execute(
        "SELECT * FROM user_resume WHERE id = ?", (resume_id,)
    ).fetchone()
    if not row or row["user_id"] != auth["userId"]:
        raise HTTPException(status_code=404, detail={"error": "Not found"})

    parsed_json = (
        json.dumps(body["parsedJson"], ensure_ascii=False)
        if "parsedJson" in body
        else row["parsed_json"]
    )
    resume_title = body.get("resumeTitle") or row["resume_title"]
    now = datetime.now(timezone.utc).isoformat()

    db.execute(
        "UPDATE user_resume SET resume_title = ?, parsed_json = ?, updated_at = ? WHERE id = ?",
        (resume_title, parsed_json, now, resume_id),
    )
    db.commit()

    updated = db.execute(
        "SELECT * FROM user_resume WHERE id = ?", (resume_id,)
    ).fetchone()
    return row_to_camel(updated)


@router.delete("/{resume_id}")
async def delete_resume(resume_id: int, auth: dict = Depends(get_auth_context)):
    row = _get_owned_resume_row(resume_id, auth["userId"])
    db = get_db()
    db.execute(
        "UPDATE mock_interview_session SET resume_id = NULL WHERE resume_id = ?",
        (resume_id,),
    )
    stored = row["stored_file_path"]
    if stored:
        (Path(UPLOAD_DIR) / stored).unlink(missing_ok=True)
    db.execute("DELETE FROM user_resume WHERE id = ?", (resume_id,))
    db.commit()
    return {"ok": True}


@router.post("/{resume_id}/beautify")
async def beautify_resume(
    resume_id: int,
    body: dict,
    auth: dict = Depends(get_auth_context),
):
    db = get_db()
    row = db.execute(
        "SELECT * FROM user_resume WHERE id = ?", (resume_id,)
    ).fetchone()
    if not row or row["user_id"] != auth["userId"]:
        raise HTTPException(status_code=404, detail={"error": "Not found"})

    template_id = body.get("templateId") or "classic"
    target_job_title = body.get("targetJobTitle") or row["target_job_title"] or ""
    job_description = body.get("jobDescription") or row["job_description"] or ""

    if "parsed" in body and isinstance(body["parsed"], dict):
        parsed = body["parsed"]
    else:
        parsed = json.loads(row["parsed_json"] or "{}")

    result = await beautify_resume_content(
        parsed=parsed,
        template_id=template_id,
        target_job_title=target_job_title,
        job_description=job_description,
    )
    return result


@router.post("/{resume_id}/enhance")
async def enhance_resume(
    resume_id: int,
    body: dict,
    auth: dict = Depends(get_auth_context),
):
    db = get_db()
    row = db.execute(
        "SELECT * FROM user_resume WHERE id = ?", (resume_id,)
    ).fetchone()
    if not row or row["user_id"] != auth["userId"]:
        raise HTTPException(status_code=404, detail={"error": "Not found"})

    mode = body.get("mode", "comprehensive")
    target_job_title = body.get("targetJobTitle") or row["target_job_title"] or ""
    job_description = body.get("jobDescription") or row["job_description"] or ""

    # 优先采用请求体中携带的最新编辑中数据，未携带则读取已持久化数据
    if "parsed" in body and isinstance(body["parsed"], dict):
        parsed = body["parsed"]
    else:
        parsed = json.loads(row["parsed_json"] or "{}")

    result = await enhance_resume_content(
        parsed=parsed,
        mode=mode,
        target_job_title=target_job_title,
        job_description=job_description,
    )
    return result
