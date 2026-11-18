from fastapi import APIRouter, Depends

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
        user_data = {
            "id": user["id"],
            "email": user["email"],
            "displayName": user["displayName"],
            "planTier": quota["planTier"],
        }
    else:
        user_data = {
            "id": auth["userId"],
            "email": "",
            "displayName": "用户",
            "planTier": "free",
        }

    return {
        "user": user_data,
        "quota": quota,
        "llmEnabled": is_llm_available(),
    }
