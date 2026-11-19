"""执行数据库迁移"""

import sqlite3

from app.db.connection import get_db

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  plan_tier TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_resume (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  resume_title TEXT NOT NULL,
  target_job_title TEXT,
  job_description TEXT,
  original_file_name TEXT,
  parsed_json TEXT,
  score_overall INTEGER,
  score_clarity INTEGER,
  score_competitiveness INTEGER,
  score_match INTEGER,
  score_professionalism INTEGER,
  match_percentage INTEGER,
  missing_keywords TEXT,
  diagnosis_report TEXT,
  star_suggestions TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resume_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resume_id INTEGER NOT NULL REFERENCES user_resume(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  version_label TEXT NOT NULL,
  parsed_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mock_interview_session (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  resume_id INTEGER REFERENCES user_resume(id),
  interviewer_role TEXT NOT NULL,
  industry TEXT,
  mode TEXT NOT NULL DEFAULT 'text',
  status TEXT NOT NULL DEFAULT 'active',
  total_duration_sec INTEGER DEFAULT 0,
  question_count INTEGER DEFAULT 0,
  score_logic INTEGER,
  score_professional INTEGER,
  score_expression INTEGER,
  score_match INTEGER,
  feedback_summary TEXT,
  report_json TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS interview_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES mock_interview_session(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  score_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interview_weak_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  session_id INTEGER REFERENCES mock_interview_session(id),
  resume_id INTEGER REFERENCES user_resume(id),
  question TEXT NOT NULL,
  last_answer TEXT,
  model_answer TEXT,
  interviewer_role TEXT,
  target_job_title TEXT,
  score_overall INTEGER NOT NULL DEFAULT 0,
  score_logic INTEGER NOT NULL DEFAULT 0,
  score_professional INTEGER NOT NULL DEFAULT 0,
  score_match INTEGER NOT NULL DEFAULT 0,
  score_expression INTEGER NOT NULL DEFAULT 0,
  deduction_notes TEXT,
  score_json TEXT,
  status TEXT NOT NULL DEFAULT 'weak',
  next_exam_enabled INTEGER NOT NULL DEFAULT 1,
  practice_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscription_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  plan_type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_quotas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  resume_diagnosis_used INTEGER NOT NULL DEFAULT 0,
  mock_interview_used INTEGER NOT NULL DEFAULT 0,
  reset_at TEXT
);

CREATE TABLE IF NOT EXISTS sms_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guest_diagnoses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  client_ip TEXT,
  target_job_title TEXT,
  resume_snippet TEXT,
  score_overall INTEGER,
  created_at TEXT NOT NULL
);
"""

ALTER_STATEMENTS = [
    "ALTER TABLE user_resume ADD COLUMN jd_match_report TEXT",
    "ALTER TABLE mock_interview_session ADD COLUMN score_confidence INTEGER",
    "ALTER TABLE mock_interview_session ADD COLUMN recording_path TEXT",
    "ALTER TABLE users ADD COLUMN password_hash TEXT",
    "ALTER TABLE usage_quotas ADD COLUMN reanalyze_used INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE usage_quotas ADD COLUMN enterprise_credits INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN platform_user_id TEXT",
    "ALTER TABLE user_resume ADD COLUMN analysis_status TEXT DEFAULT 'complete'",
    "ALTER TABLE user_resume ADD COLUMN stored_file_path TEXT",
    "ALTER TABLE user_resume ADD COLUMN file_mime_type TEXT",
    "ALTER TABLE mock_interview_session ADD COLUMN difficulty TEXT DEFAULT 'standard'",
    "ALTER TABLE mock_interview_session ADD COLUMN target_job_title TEXT",
    "ALTER TABLE mock_interview_session ADD COLUMN experience_years TEXT",
    "ALTER TABLE mock_interview_session ADD COLUMN job_description TEXT",
    "ALTER TABLE mock_interview_session ADD COLUMN duration_limit_sec INTEGER DEFAULT 900",
    "ALTER TABLE users ADD COLUMN phone TEXT",
    "ALTER TABLE users ADD COLUMN target_job_title TEXT",
    "ALTER TABLE users ADD COLUMN privacy_settings TEXT DEFAULT '{}'",
    "ALTER TABLE users ADD COLUMN is_deleted INTEGER DEFAULT 0",
    "ALTER TABLE subscription_orders ADD COLUMN refund_status TEXT DEFAULT 'none'",
    "ALTER TABLE subscription_orders ADD COLUMN refund_reason TEXT",
    "ALTER TABLE subscription_orders ADD COLUMN refunded_at TEXT",
]


def migrate() -> None:
    db = get_db()
    db.executescript(SCHEMA)

    demo = db.execute(
        "SELECT id FROM users WHERE email = ?", ("demo@careerai.local",)
    ).fetchone()

    if not demo:
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc).isoformat()
        db.execute(
            "INSERT INTO users (email, display_name, plan_tier, created_at) VALUES (?, ?, ?, ?)",
            ("demo@careerai.local", "演示用户", "free", now),
        )
        user_id = db.execute(
            "SELECT id FROM users WHERE email = ?", ("demo@careerai.local",)
        ).fetchone()[0]
        db.execute(
            "INSERT INTO usage_quotas (user_id, resume_diagnosis_used, mock_interview_used) VALUES (?, 0, 0)",
            (user_id,),
        )
        print("Created demo user (id=1)")

    for sql in ALTER_STATEMENTS:
        try:
            db.execute(sql)
        except sqlite3.OperationalError:
            pass

    db.commit()
    print("Migration complete.")


if __name__ == "__main__":
    migrate()
