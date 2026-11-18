import hashlib
import secrets
from datetime import datetime, timezone

import jwt
from fastapi import HTTPException

from app.config import PLATFORM_JWT_SECRET
from app.db.connection import get_db


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt, hex_digest = stored.split("$", 1)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return secrets.compare_digest(digest.hex(), hex_digest)


def create_local_token(user_id: int) -> str:
    return jwt.encode(
        {
            "sub": f"local:{user_id}",
            "iss": "umams",
            "aud": "umams",
        },
        PLATFORM_JWT_SECRET,
        algorithm="HS256",
    )


def _ensure_usage_quota(db, user_id: int) -> None:
    row = db.execute(
        "SELECT id FROM usage_quotas WHERE user_id = ?", (user_id,)
    ).fetchone()
    if not row:
        db.execute(
            """INSERT INTO usage_quotas
               (user_id, resume_diagnosis_used, mock_interview_used, reanalyze_used, enterprise_credits)
               VALUES (?, 0, 0, 0, 0)""",
            (user_id,),
        )


def register_user(email: str, password: str, display_name: str) -> dict:
    email = email.strip().lower()
    display_name = display_name.strip() or email.split("@")[0]

    if len(password) < 6:
        raise HTTPException(
            status_code=400,
            detail={"error": "密码至少 6 位", "code": "VALIDATION_ERROR"},
        )

    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"error": "该邮箱已注册", "code": "EMAIL_EXISTS"},
        )

    now = datetime.now(timezone.utc).isoformat()
    password_hash = hash_password(password)
    cursor = db.execute(
        """INSERT INTO users (email, display_name, password_hash, plan_tier, created_at)
           VALUES (?, ?, ?, 'free', ?)""",
        (email, display_name, password_hash, now),
    )
    user_id = cursor.lastrowid
    db.execute(
        "UPDATE users SET platform_user_id = ? WHERE id = ?",
        (f"local:{user_id}", user_id),
    )
    _ensure_usage_quota(db, user_id)
    db.commit()

    return {
        "token": create_local_token(user_id),
        "user": {"id": user_id, "email": email, "displayName": display_name},
    }


def login_user(email: str, password: str) -> dict:
    email = email.strip().lower()
    db = get_db()
    row = db.execute(
        "SELECT id, email, display_name, password_hash FROM users WHERE email = ?",
        (email,),
    ).fetchone()

    if not row or not row["password_hash"]:
        raise HTTPException(
            status_code=401,
            detail={"error": "邮箱或密码错误", "code": "INVALID_CREDENTIALS"},
        )

    if not verify_password(password, row["password_hash"]):
        raise HTTPException(
            status_code=401,
            detail={"error": "邮箱或密码错误", "code": "INVALID_CREDENTIALS"},
        )

    user_id = row["id"]
    platform_row = db.execute(
        "SELECT platform_user_id FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    if not platform_row or not platform_row["platform_user_id"]:
        db.execute(
            "UPDATE users SET platform_user_id = ? WHERE id = ?",
            (f"local:{user_id}", user_id),
        )
    _ensure_usage_quota(db, user_id)
    db.commit()

    return {
        "token": create_local_token(user_id),
        "user": {
            "id": user_id,
            "email": row["email"],
            "displayName": row["display_name"],
        },
    }
