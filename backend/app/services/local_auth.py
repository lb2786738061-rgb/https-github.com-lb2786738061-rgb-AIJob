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


def send_sms_code(phone: str) -> dict:
    phone = phone.strip()
    if not (phone.isdigit() and len(phone) == 11 and phone.startswith("1")):
        raise HTTPException(
            status_code=400,
            detail={"error": "请输入有效的11位手机号码", "code": "INVALID_PHONE"},
        )

    code = f"{secrets.randbelow(900000) + 100000}"
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    expires_at = (now + timedelta(minutes=5)).isoformat()
    now_str = now.isoformat()

    db = get_db()
    db.execute(
        """INSERT INTO sms_verifications (phone, code, expires_at, used, created_at)
           VALUES (?, ?, ?, 0, ?)""",
        (phone, code, expires_at, now_str),
    )
    db.commit()

    # 开发环境控制台日志直接打印验证码
    print(f"\n[短信服务/模拟发送] 手机号: {phone} | 验证码: {code} | 有效期: 5分钟\n")

    return {
        "success": True,
        "message": "验证码发送成功",
        "phone": phone,
        "devCode": code,  # 开发环境返回以方便即时体验
    }


def login_by_sms(phone: str, code: str) -> dict:
    phone = phone.strip()
    code = code.strip()

    if not (phone.isdigit() and len(phone) == 11):
        raise HTTPException(
            status_code=400,
            detail={"error": "手机号码格式不正确", "code": "INVALID_PHONE"},
        )
    if not code:
        raise HTTPException(
            status_code=400,
            detail={"error": "请输入验证码", "code": "EMPTY_CODE"},
        )

    db = get_db()
    row = db.execute(
        """SELECT id, code, expires_at, used FROM sms_verifications
           WHERE phone = ? AND used = 0
           ORDER BY created_at DESC LIMIT 1""",
        (phone,),
    ).fetchone()

    if not row or row["code"] != code:
        raise HTTPException(
            status_code=400,
            detail={"error": "验证码错误或已失效", "code": "INVALID_CODE"},
        )

    now = datetime.now(timezone.utc)
    try:
        exp = datetime.fromisoformat(row["expires_at"])
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < now:
            raise HTTPException(
                status_code=400,
                detail={"error": "验证码已过期，请重新获取", "code": "CODE_EXPIRED"},
            )
    except (ValueError, TypeError):
        pass

    # 标记已使用
    db.execute("UPDATE sms_verifications SET used = 1 WHERE id = ?", (row["id"],))

    # 查找或注册用户
    user_row = db.execute(
        "SELECT id, email, display_name, phone, plan_tier FROM users WHERE phone = ? OR email = ?",
        (phone, f"{phone}@careerai.local"),
    ).fetchone()

    now_str = now.isoformat()
    if not user_row:
        default_email = f"{phone}@careerai.local"
        display_name = f"用户_{phone[-4:]}"
        cursor = db.execute(
            """INSERT INTO users (email, phone, display_name, plan_tier, created_at)
               VALUES (?, ?, ?, 'free', ?)""",
            (default_email, phone, display_name, now_str),
        )
        user_id = cursor.lastrowid
        db.execute(
            "UPDATE users SET platform_user_id = ? WHERE id = ?",
            (f"local:{user_id}", user_id),
        )
        _ensure_usage_quota(db, user_id)
        email = default_email
    else:
        user_id = user_row["id"]
        email = user_row["email"]
        display_name = user_row["display_name"]
        if not user_row["phone"]:
            db.execute("UPDATE users SET phone = ? WHERE id = ?", (phone, user_id))
        _ensure_usage_quota(db, user_id)

    db.commit()

    return {
        "token": create_local_token(user_id),
        "user": {
            "id": user_id,
            "email": email,
            "phone": phone,
            "displayName": display_name,
        },
    }

