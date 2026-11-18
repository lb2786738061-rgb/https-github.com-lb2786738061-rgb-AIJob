from datetime import datetime, timezone

from app.db.connection import get_db
from app.utils import row_to_camel


def resolve_shadow_user(platform_user_id: str, platform_me: dict | None = None) -> dict:
    db = get_db()
    row = db.execute(
        "SELECT * FROM users WHERE platform_user_id = ?", (platform_user_id,)
    ).fetchone()

    if row:
        user = row_to_camel(row)
        return {
            "id": user["id"],
            "email": user["email"],
            "displayName": user["displayName"],
            "planTier": user["planTier"],
        }

    user_info = (platform_me or {}).get("user", {})
    email = (
        (user_info.get("email") or "").strip()
        or (user_info.get("username") or "").strip()
        or f"{platform_user_id[:8]}@platform.local"
    )
    display_name = (
        (user_info.get("displayName") or "").strip()
        or (user_info.get("username") or "").strip()
        or "用户"
    )
    now = datetime.now(timezone.utc).isoformat()

    cursor = db.execute(
        """INSERT INTO users (email, display_name, platform_user_id, plan_tier, created_at)
           VALUES (?, ?, ?, ?, ?)""",
        (email, display_name, platform_user_id, "free", now),
    )
    db.commit()

    return {
        "id": cursor.lastrowid,
        "email": email,
        "displayName": display_name,
        "planTier": "free",
    }
