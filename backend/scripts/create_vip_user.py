"""Create or upgrade a local VIP account with permanent membership."""

from datetime import datetime, timezone

from app.db.connection import get_db
from app.db.migrate import migrate
from app.services.local_auth import hash_password, login_user
from app.services.quota import get_local_quota_status

EMAIL = "vip@careerai.local"
PASSWORD = "CareerAI2026!"
DISPLAY_NAME = "永久会员"


def main() -> None:
    migrate()
    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE email = ?", (EMAIL,)).fetchone()

    if existing:
        user_id = existing["id"]
        db.execute(
            "UPDATE users SET plan_tier = ?, display_name = ? WHERE id = ?",
            ("membership_pass", DISPLAY_NAME, user_id),
        )
        quota = db.execute(
            "SELECT id FROM usage_quotas WHERE user_id = ?", (user_id,)
        ).fetchone()
        if quota:
            db.execute(
                """UPDATE usage_quotas
                   SET resume_diagnosis_used = 0, mock_interview_used = 0,
                       reanalyze_used = 0, enterprise_credits = 99
                   WHERE user_id = ?""",
                (user_id,),
            )
        else:
            db.execute(
                """INSERT INTO usage_quotas
                   (user_id, resume_diagnosis_used, mock_interview_used, reanalyze_used, enterprise_credits)
                   VALUES (?, 0, 0, 0, 99)""",
                (user_id,),
            )
        action = "updated"
    else:
        now = datetime.now(timezone.utc).isoformat()
        cursor = db.execute(
            """INSERT INTO users (email, display_name, password_hash, plan_tier, platform_user_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (EMAIL, DISPLAY_NAME, hash_password(PASSWORD), "membership_pass", "pending", now),
        )
        user_id = cursor.lastrowid
        db.execute(
            "UPDATE users SET platform_user_id = ? WHERE id = ?",
            (f"local:{user_id}", user_id),
        )
        db.execute(
            """INSERT INTO usage_quotas
               (user_id, resume_diagnosis_used, mock_interview_used, reanalyze_used, enterprise_credits)
               VALUES (?, 0, 0, 0, 99)""",
            (user_id,),
        )
        action = "created"

    db.commit()
    login_user(EMAIL, PASSWORD)
    quota = get_local_quota_status(user_id)

    print(f"Account {action} successfully.")
    print(f"Email:    {EMAIL}")
    print(f"Password: {PASSWORD}")
    print(f"Plan:     {quota['planTier']}")
    print(f"Enterprise credits: {quota['enterpriseCredits']}")


if __name__ == "__main__":
    main()
