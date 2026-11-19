import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, JSONResponse

from app.config import UPLOAD_DIR
from app.db.connection import get_db
from app.middleware.auth import get_auth_context
from app.services import quota as quota_service
from app.services.llm import is_llm_available
from app.services.resume_analysis import persist_analysis, run_full_analysis
from app.services.resume_diagnosis import diagnosis_db_fields
from app.services.resume_beautify import beautify_resume_content
from app.services.resume_enhancer import enhance_resume_content
from app.services.resume_parser import infer_target_job_from_parsed, parse_resume_file
from app.services.star_rewrite import rewrite_from_star_fields
from app.utils import row_to_camel, rows_to_camel

router = APIRouter()
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_EXT = {".pdf", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp"}

Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


def _sync_section_aliases(parsed: dict) -> dict:
    """保持 advantage/summary、project/projects、skill/skills、award/awards 字段双向同步"""
    if not isinstance(parsed, dict):
        return parsed
    sections = parsed.get("sections")
    if not isinstance(sections, dict):
        return parsed
    summary_val = str(sections.get("advantage") if sections.get("advantage") is not None else (sections.get("summary") or "")).strip()
    if not summary_val:
        summary_val = str(sections.get("summary") or "").strip()
    sections["summary"] = summary_val
    sections["advantage"] = summary_val

    projects_val = sections.get("projects") if sections.get("projects") is not None else (sections.get("project") or [])
    sections["projects"] = list(projects_val) if isinstance(projects_val, list) else []
    sections["project"] = list(sections["projects"])

    skills_val = sections.get("skills") if sections.get("skills") is not None else (sections.get("skill") or [])
    sections["skills"] = list(skills_val) if isinstance(skills_val, list) else []
    sections["skill"] = list(sections["skills"])

    awards_val = sections.get("awards") if sections.get("awards") is not None else (sections.get("award") or [])
    sections["awards"] = list(awards_val) if isinstance(awards_val, list) else []
    sections["award"] = list(sections["awards"])
    return parsed


def _save_resume_version(db, resume_id: int, user_id: int, version_label: str, parsed_obj: dict | str) -> None:
    """保存简历版本历史快照，支持回滚"""
    now = datetime.now(timezone.utc).isoformat()
    parsed_str = (
        parsed_obj
        if isinstance(parsed_obj, str)
        else json.dumps(parsed_obj, ensure_ascii=False)
    )
    db.execute(
        """INSERT INTO resume_versions (resume_id, user_id, version_label, parsed_json, created_at)
           VALUES (?, ?, ?, ?, ?)""",
        (resume_id, user_id, version_label, parsed_str, now),
    )


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


@router.get("/guest-status")
async def get_guest_status(deviceId: str = Query(..., description="客户端唯一设备标识")):
    device_id = deviceId.strip()
    db = get_db()
    row = db.execute(
        "SELECT COUNT(*) as cnt FROM guest_diagnoses WHERE device_id = ?",
        (device_id,),
    ).fetchone()
    used_cnt = row["cnt"] if row else 0
    return {
        "deviceId": device_id,
        "hasUsed": used_cnt > 0,
        "remaining": max(0, 1 - used_cnt),
    }


@router.post("/guest-diagnose")
async def guest_diagnose(body: dict):
    device_id = (body.get("deviceId") or "").strip()
    resume_text = (body.get("resumeText") or "").strip()
    target_job = (body.get("targetJobTitle") or "").strip()

    if not device_id:
        raise HTTPException(
            status_code=400,
            detail={"error": "设备标识缺失", "code": "DEVICE_ID_REQUIRED"},
        )

    if len(resume_text) < 20:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "简历文本过短，请至少粘贴一段有效的工作或项目经历（不少于20字）",
                "code": "TEXT_TOO_SHORT",
            },
        )

    db = get_db()
    row = db.execute(
        "SELECT COUNT(*) as cnt FROM guest_diagnoses WHERE device_id = ?",
        (device_id,),
    ).fetchone()
    if row and row["cnt"] >= 1:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "该设备已体验过 1 次免费轻量诊断。请注册或登录以解锁无限制深度诊断与模拟面试！",
                "code": "GUEST_LIMIT_REACHED",
            },
        )

    # 轻量诊断分析
    if not target_job:
        for candidate in ["前端开发", "后端开发", "全栈工程师", "产品经理", "测试开发", "数据分析", "算法工程师"]:
            if candidate[:2] in resume_text:
                target_job = candidate
                break
        if not target_job:
            target_job = "软件工程师"

    has_numbers = any(c.isdigit() for c in resume_text)
    has_keywords = any(kw in resume_text for kw in ["负责", "实现", "主导", "优化", "设计", "重构"])
    has_tech_words = any(kw in resume_text.lower() for kw in ["python", "java", "vue", "react", "sql", "git", "linux", "api", "spring"])

    base_score = 68
    if has_numbers:
        base_score += 8
    if has_keywords:
        base_score += 6
    if has_tech_words:
        base_score += 7
    if len(resume_text) > 200:
        base_score += 4
    score_overall = min(92, max(60, base_score))

    highlights = []
    if has_tech_words:
        highlights.append("包含明确的核心技术栈与专业术语表达")
    if has_keywords:
        highlights.append("具备基础职责叙述与动词引导模式")
    if has_numbers:
        highlights.append("部分段落包含数字指标，具备基础成果导向")
    if not highlights:
        highlights.append("段落文字叙述完整，具备基本求职背景雏形")

    suggestions = []
    if not has_numbers:
        suggestions.append("严重缺乏可量化的业务指标（如QPS提升%、降本增效金额、上线转化率等），建议使用 STAR 法则强化成果")
    else:
        suggestions.append("量化指标仅停留在表面，建议补充对比基线与具体收益（例如：通过X方案将耗时从A降低至B）")

    suggestions.append(f"针对意向岗位「{target_job}」，高频行业技能词覆盖度不足，需补充对齐 JD 的核心技术栈与工具链")
    suggestions.append("缺少个人核心竞争力（如关键技术攻坚、难点攻克沉淀），建议在自我评价中前置 3 点独特优势")

    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        """INSERT INTO guest_diagnoses (device_id, client_ip, target_job_title, resume_snippet, score_overall, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (device_id, "", target_job, resume_text[:120], score_overall, now),
    )
    db.commit()

    return {
        "scoreOverall": score_overall,
        "targetJobTitle": target_job,
        "highlights": highlights,
        "suggestions": suggestions,
        "dimensionScores": {
            "clarity": max(50, score_overall - 3),
            "competitiveness": max(50, score_overall - 5),
            "match": max(50, score_overall - 2),
            "professionalism": max(50, score_overall + 4),
        },
        "guestLimit": {
            "total": 1,
            "used": 1,
            "remaining": 0,
        },
        "message": "游客体验诊断完成。免费体验已完成 1/1 次，注册登录后可上传附件、保存完整版本并体验 AI 模拟面试！",
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
    parseOnly: str = Form("false"),
    auth: dict = Depends(get_auth_context),
):
    is_parse_only = str(parseOnly).strip().lower() in ("true", "1", "yes")

    if not is_parse_only:
        quota_check = await quota_service.check_resume_quota(auth)
        if not quota_check["allowed"]:
            raise HTTPException(
                status_code=403,
                detail={"error": quota_check["message"], "code": "QUOTA_EXCEEDED"},
            )
    else:
        quota_check = {"allowed": True}

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail={"error": "文件大小不能超过 10MB"})

    ext = "." + (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext == ".doc":
        raise HTTPException(
            status_code=400,
            detail={"error": "暂不支持旧版 .doc 格式，请将文件另存为 .docx 或 PDF 格式后上传"},
        )
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail={"error": "仅支持 PDF、Word (.docx)、图片 (.png/.jpg) 或 TXT 格式"},
        )

    file_name = f"{uuid.uuid4()}{ext}"
    file_path = Path(UPLOAD_DIR) / file_name
    file_path.write_bytes(content)

    try:
        parsed = parse_resume_file(str(file_path), file.content_type or "")
    except Exception as exc:
        file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail={"error": str(exc)},
        ) from exc

    parsed = _sync_section_aliases(dict(parsed))
    initial_parsed_copy = json.loads(json.dumps(parsed, ensure_ascii=False))

    inferred_job = (targetJobTitle or "").strip() or infer_target_job_from_parsed(parsed)
    stored_title = _title_from_upload(resumeTitle, file.filename)
    if stored_title == "我的简历" and inferred_job:
        stored_title = f"{inferred_job}简历"

    now = datetime.now(timezone.utc).isoformat()
    db = get_db()

    if is_parse_only:
        cursor = db.execute(
            """INSERT INTO user_resume (
                user_id, resume_title, target_job_title, job_description,
                original_file_name, stored_file_path, file_mime_type, parsed_json,
                analysis_status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'parsed', ?, ?)""",
            (
                auth["userId"],
                stored_title,
                inferred_job,
                jobDescription,
                file.filename,
                file_name,
                file.content_type or "",
                json.dumps(parsed, ensure_ascii=False),
                now,
                now,
            ),
        )
        resume_id = cursor.lastrowid
        _save_resume_version(db, resume_id, auth["userId"], "上传解析初版", initial_parsed_copy)
        db.commit()
        row = db.execute("SELECT * FROM user_resume WHERE id = ?", (resume_id,)).fetchone()
        return {
            "resume": row_to_camel(row),
            "diagnosis": None,
            "jdMatch": None,
            "starRewrite": {"suggestions": [], "summary": "已完成简历结构化解析，可先核对个人优势与经历，再触发 AI 诊断或模板美化。"},
            "analysisStatus": "parsed",
            "analysisSource": "rule_based",
            "grammarCheck": None,
        }

    try:
        analysis = await run_full_analysis(parsed, jobDescription, inferred_job)
    except Exception as exc:
        file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=502,
            detail={"error": f"简历分析失败: {exc}", "code": "LLM_ANALYSIS_FAILED"},
        ) from exc

    parsed = _sync_section_aliases(dict(analysis.get("parsed") or parsed))
    analysis["parsed"] = parsed

    diagnosis = analysis["diagnosis"]
    jd_match = analysis["jd_match"]
    star_result = analysis["star_result"]
    (
        score_overall,
        score_clarity,
        score_competitiveness,
        score_professionalism,
        diagnosis_report,
    ) = diagnosis_db_fields(diagnosis)

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
            inferred_job,
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
    resume_id = cursor.lastrowid
    _save_resume_version(db, resume_id, auth["userId"], "上传解析初版", initial_parsed_copy)
    if json.dumps(parsed, ensure_ascii=False) != json.dumps(initial_parsed_copy, ensure_ascii=False):
        _save_resume_version(db, resume_id, auth["userId"], "AI结构化排版", parsed)
    db.commit()

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
    db = get_db()
    row = db.execute(
        "SELECT * FROM user_resume WHERE id = ?", (resume_id,)
    ).fetchone()
    if not row or row["user_id"] != auth["userId"]:
        raise HTTPException(status_code=404, detail={"error": "Not found"})

    # 若之前仅解析未诊断（status=parsed），走首次诊断配额；否则走重分析配额
    was_parsed_only = row["analysis_status"] == "parsed"
    if was_parsed_only:
        quota_check = await quota_service.check_resume_quota(auth)
    else:
        quota_check = await quota_service.check_reanalyze_quota(auth)
    if not quota_check["allowed"]:
        raise HTTPException(
            status_code=403,
            detail={"error": quota_check["message"], "code": "QUOTA_EXCEEDED"},
        )

    parsed = _sync_section_aliases(json.loads(row["parsed_json"] or "{}"))
    jd = body.get("jobDescription") if "jobDescription" in body else (row["job_description"] or "")
    target_job_title = body.get("targetJobTitle") or row["target_job_title"] or infer_target_job_from_parsed(parsed)

    try:
        analysis = await run_full_analysis(parsed, jd, target_job_title or "")
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"error": f"简历分析失败: {exc}", "code": "LLM_ANALYSIS_FAILED"},
        ) from exc

    if analysis.get("parsed"):
        analysis["parsed"] = _sync_section_aliases(dict(analysis["parsed"]))

    persist_analysis(
        resume_id,
        analysis,
        analysis_status="complete",
        target_job_title=target_job_title,
        job_description=jd,
    )

    if was_parsed_only:
        await quota_service.consume_resume_diagnose(auth, resume_id, quota_check.get("me"))
    else:
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

    if "parsedJson" in body and isinstance(body["parsedJson"], dict):
        synced_parsed = _sync_section_aliases(dict(body["parsedJson"]))
        parsed_json = json.dumps(synced_parsed, ensure_ascii=False)
        version_label = str(body.get("versionLabel") or "手动编辑保存")
        _save_resume_version(db, resume_id, auth["userId"], version_label, synced_parsed)
    else:
        parsed_json = row["parsed_json"]

    resume_title = body.get("resumeTitle") or row["resume_title"]
    target_job_title = (
        body.get("targetJobTitle")
        if "targetJobTitle" in body
        else row["target_job_title"]
    )
    job_description = (
        body.get("jobDescription")
        if "jobDescription" in body
        else row["job_description"]
    )
    now = datetime.now(timezone.utc).isoformat()

    db.execute(
        """UPDATE user_resume
           SET resume_title = ?, target_job_title = ?, job_description = ?, parsed_json = ?, updated_at = ?
           WHERE id = ?""",
        (resume_title, target_job_title, job_description, parsed_json, now, resume_id),
    )
    db.commit()

    updated = db.execute(
        "SELECT * FROM user_resume WHERE id = ?", (resume_id,)
    ).fetchone()
    return row_to_camel(updated)


@router.get("/{resume_id}/versions")
async def list_resume_versions(resume_id: int, auth: dict = Depends(get_auth_context)):
    _get_owned_resume_row(resume_id, auth["userId"])
    db = get_db()
    rows = db.execute(
        """SELECT id, resume_id, version_label, created_at
           FROM resume_versions
           WHERE resume_id = ? AND user_id = ?
           ORDER BY id DESC LIMIT 20""",
        (resume_id, auth["userId"]),
    ).fetchall()
    return {"versions": rows_to_camel(rows)}


@router.post("/{resume_id}/versions/{version_id}/rollback")
async def rollback_resume_version(
    resume_id: int, version_id: int, auth: dict = Depends(get_auth_context)
):
    _get_owned_resume_row(resume_id, auth["userId"])
    db = get_db()
    ver = db.execute(
        "SELECT * FROM resume_versions WHERE id = ? AND resume_id = ? AND user_id = ?",
        (version_id, resume_id, auth["userId"]),
    ).fetchone()
    if not ver:
        raise HTTPException(status_code=404, detail={"error": "历史版本不存在"})

    parsed_obj = _sync_section_aliases(json.loads(ver["parsed_json"] or "{}"))
    parsed_json = json.dumps(parsed_obj, ensure_ascii=False)
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "UPDATE user_resume SET parsed_json = ?, updated_at = ? WHERE id = ?",
        (parsed_json, now, resume_id),
    )
    _save_resume_version(
        db,
        resume_id,
        auth["userId"],
        f"回退至：{ver['version_label']}",
        parsed_obj,
    )
    db.commit()
    updated = db.execute("SELECT * FROM user_resume WHERE id = ?", (resume_id,)).fetchone()
    return row_to_camel(updated)


@router.get("/{resume_id}/export")
async def export_resume_content(
    resume_id: int,
    format: str = Query("markdown"),
    auth: dict = Depends(get_auth_context),
):
    row = _get_owned_resume_row(resume_id, auth["userId"])
    parsed = _sync_section_aliases(json.loads(row["parsed_json"] or "{}"))
    sections = parsed.get("sections") or {}
    title = row["resume_title"] or "我的简历"
    target_job = row["target_job_title"] or ""
    advantage = str(sections.get("advantage") or sections.get("summary") or "").strip()
    contact = str(sections.get("contact") or "").strip()
    education = sections.get("education") or []
    experience = sections.get("experience") or []
    projects = sections.get("projects") or sections.get("project") or []
    skills = sections.get("skills") or sections.get("skill") or []
    awards = sections.get("awards") or sections.get("award") or []

    fmt = format.lower().strip()
    if fmt == "json":
        payload = {
            "resumeTitle": title,
            "targetJobTitle": target_job,
            "sections": {
                "contact": contact,
                "advantage": advantage,
                "summary": advantage,
                "education": education,
                "experience": experience,
                "project": projects,
                "projects": projects,
                "skill": skills,
                "skills": skills,
                "award": awards,
                "awards": awards,
            },
        }
        return JSONResponse(content=payload)

    md_lines = [f"# {title}"]
    if target_job:
        md_lines.append(f"**求职意向**：{target_job}\n")
    if contact:
        md_lines.extend(["## 联系方式", contact, ""])
    if advantage:
        md_lines.extend(["## 个人优势", advantage, ""])
    if education:
        md_lines.append("## 教育背景")
        for item in education:
            md_lines.append(f"- {item}")
        md_lines.append("")
    if experience:
        md_lines.append("## 工作经历")
        for item in experience:
            md_lines.append(f"### {item.splitlines()[0]}")
            for bullet in item.splitlines()[1:]:
                md_lines.append(f"- {bullet}")
            md_lines.append("")
    if projects:
        md_lines.append("## 项目经历")
        for item in projects:
            md_lines.append(f"### {item.splitlines()[0]}")
            for bullet in item.splitlines()[1:]:
                md_lines.append(f"- {bullet}")
            md_lines.append("")
    if skills:
        md_lines.append("## 专业技能")
        for item in skills:
            md_lines.append(f"- {item}")
        md_lines.append("")
    if awards:
        md_lines.append("## 荣誉奖项")
        for item in awards:
            md_lines.append(f"- {item}")
        md_lines.append("")

    md_content = "\n".join(md_lines).strip()
    if fmt == "html":
        html_body = (
            f"<!DOCTYPE html><html lang='zh-CN'><head><meta charset='utf-8'/>"
            f"<title>{title}</title></head><body style='max-width:780px;margin:24px auto;font-family:sans-serif;line-height:1.7;'>"
            f"<pre style='white-space:pre-wrap;font-family:inherit;'>{md_content}</pre></body></html>"
        )
        return HTMLResponse(content=html_body)
    return PlainTextResponse(content=md_content)


@router.delete("/{resume_id}")
async def delete_resume(resume_id: int, auth: dict = Depends(get_auth_context)):
    row = _get_owned_resume_row(resume_id, auth["userId"])
    db = get_db()
    db.execute(
        "UPDATE mock_interview_session SET resume_id = NULL WHERE resume_id = ?",
        (resume_id,),
    )
    db.execute("DELETE FROM resume_versions WHERE resume_id = ?", (resume_id,))
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
        parsed = _sync_section_aliases(dict(body["parsed"]))
    else:
        parsed = _sync_section_aliases(json.loads(row["parsed_json"] or "{}"))

    # 美化前确保至少有一个历史版本可供回退
    ver_count = db.execute(
        "SELECT COUNT(*) AS c FROM resume_versions WHERE resume_id = ?", (resume_id,)
    ).fetchone()["c"]
    if ver_count == 0:
        _save_resume_version(db, resume_id, auth["userId"], "美化前原版", parsed)
        db.commit()

    result = await beautify_resume_content(
        parsed=parsed,
        template_id=template_id,
        target_job_title=target_job_title,
        job_description=job_description,
    )
    if result.get("parsed"):
        result["parsed"] = _sync_section_aliases(dict(result["parsed"]))
        _save_resume_version(db, resume_id, auth["userId"], f"AI美化排版({template_id})", result["parsed"])
        db.commit()
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
        parsed = _sync_section_aliases(dict(body["parsed"]))
    else:
        parsed = _sync_section_aliases(json.loads(row["parsed_json"] or "{}"))

    result = await enhance_resume_content(
        parsed=parsed,
        mode=mode,
        target_job_title=target_job_title,
        job_description=job_description,
    )
    if result.get("enhancedSections"):
        synced = _sync_section_aliases({"sections": dict(result["enhancedSections"])})
        result["enhancedSections"] = synced["sections"]
    return result

