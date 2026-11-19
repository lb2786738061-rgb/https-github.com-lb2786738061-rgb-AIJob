import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from app.db.connection import get_db
from app.middleware.auth import get_auth_context
from app.services.llm import is_llm_available
from app.services.quota import get_quota_status
from app.utils import row_to_camel

router = APIRouter()


@router.get("/me")
async def get_me(auth: dict = Depends(get_auth_context)):
    db = get_db()
    row = db.execute(
        "SELECT * FROM users WHERE id = ?", (auth["userId"],)
    ).fetchone()
    quota = await get_quota_status(auth)

    if row:
        user = row_to_camel(row)
        privacy = {}
        if user.get("privacySettings"):
            try:
                privacy = json.loads(user["privacySettings"])
            except Exception:
                privacy = {}

        user_data = {
            "id": user["id"],
            "email": user["email"],
            "phone": user.get("phone") or "",
            "displayName": user["displayName"],
            "targetJobTitle": user.get("targetJobTitle") or "",
            "privacySettings": privacy,
            "planTier": quota["planTier"],
            "isDeleted": bool(user.get("isDeleted")),
        }
    else:
        user_data = {
            "id": auth["userId"],
            "email": "",
            "phone": "",
            "displayName": "用户",
            "targetJobTitle": "",
            "privacySettings": {},
            "planTier": "free",
            "isDeleted": False,
        }

    return {
        "user": user_data,
        "quota": quota,
        "llmEnabled": is_llm_available(),
    }


@router.put("/profile")
async def update_profile(body: dict, auth: dict = Depends(get_auth_context)):
    user_id = auth["userId"]
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        raise HTTPException(status_code=404, detail={"error": "用户不存在"})

    display_name = body.get("displayName")
    target_job_title = body.get("targetJobTitle")
    privacy_settings = body.get("privacySettings")

    updates = []
    params = []

    if display_name is not None:
        updates.append("display_name = ?")
        params.append(display_name.strip())
    if target_job_title is not None:
        updates.append("target_job_title = ?")
        params.append(target_job_title.strip())
    if privacy_settings is not None:
        updates.append("privacy_settings = ?")
        params.append(json.dumps(privacy_settings, ensure_ascii=False))

    if updates:
        params.append(user_id)
        db.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", tuple(params))
        db.commit()

    updated = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return {"success": True, "user": row_to_camel(updated)}


@router.post("/delete-account")
async def delete_account(auth: dict = Depends(get_auth_context)):
    user_id = auth["userId"]
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        raise HTTPException(status_code=404, detail={"error": "用户不存在"})

    now = datetime.now(timezone.utc).isoformat()
    # 注销账号：软删除并匿名化敏感字段
    anonymized_email = f"deleted_{user_id}_{int(datetime.now().timestamp())}@careerai.local"
    db.execute(
        """UPDATE users
           SET is_deleted = 1,
               display_name = '已注销用户',
               phone = NULL,
               email = ?,
               password_hash = NULL
           WHERE id = ?""",
        (anonymized_email, user_id),
    )
    db.commit()

    return {"success": True, "message": "账号已安全注销"}

