import sqlite3
import unittest
from unittest.mock import AsyncMock, patch

from app.db.migrate import ALTER_STATEMENTS, SCHEMA
from app.services.interview_session import process_interview_answer


STRONG_EVAL = {
    "scoreLogic": 82,
    "scoreProfessional": 80,
    "scoreExpression": 78,
    "scoreMatch": 80,
    "scoreConfidence": 76,
    "feedback": "骨架完整。",
    "modelAnswer": "示范",
    "starCoverage": {"situation": True, "task": True, "action": True, "result": True},
    "missedPoints": [],
    "strengths": ["有量化结果"],
    "followUpHint": "",
    "keywordsHit": ["result"],
}


def _memory_db() -> sqlite3.Connection:
    db = sqlite3.connect(":memory:", check_same_thread=False)
    db.row_factory = sqlite3.Row
    db.executescript(SCHEMA)
    for sql in ALTER_STATEMENTS:
        try:
            db.execute(sql)
        except sqlite3.OperationalError:
            pass
    db.execute(
        "INSERT INTO users (email, display_name, plan_tier, created_at) VALUES (?, ?, ?, ?)",
        ("tester@careerai.local", "测试用户", "membership_pass", "2026-01-01T00:00:00+00:00"),
    )
    db.commit()
    return db


def _start_session(db: sqlite3.Connection, role: str) -> int:
    cursor = db.execute(
        """INSERT INTO mock_interview_session (
            user_id, resume_id, interviewer_role, industry, mode,
            status, question_count, started_at, difficulty, target_job_title
        ) VALUES (1, NULL, ?, NULL, 'text', 'active', 1, ?, 'standard', NULL)""",
        (role, "2026-01-01T00:00:00+00:00"),
    )
    session_id = cursor.lastrowid
    db.execute(
        """INSERT INTO interview_messages (session_id, role, content, message_type, created_at)
           VALUES (?, 'assistant', ?, 'text', ?)""",
        (session_id, "开场问题", "2026-01-01T00:00:00+00:00"),
    )
    db.commit()
    return session_id


class InterviewSessionCountTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = _memory_db()
        self.auth = {"userId": 1}
        self.paid = patch(
            "app.services.interview_session.quota_service.is_paid",
            new=AsyncMock(return_value=True),
        )
        self.eval_patch = patch(
            "app.services.interview_session.evaluate_answer",
            new=AsyncMock(return_value=STRONG_EVAL),
        )
        self.follow_patch = patch(
            "app.services.interview_session.generate_follow_up_question",
            new=AsyncMock(side_effect=self._next_question),
        )
        self.db_patch = patch(
            "app.services.interview_session.get_db",
            return_value=self.db,
        )
        self.paid.start()
        self.eval_patch.start()
        self.follow_patch.start()
        self.db_patch.start()
        self.addCleanup(self.paid.stop)
        self.addCleanup(self.eval_patch.stop)
        self.addCleanup(self.follow_patch.stop)
        self.addCleanup(self.db_patch.stop)
        self.addCleanup(self.db.close)

    async def _next_question(self, *args, **kwargs):
        return "下一题"

    async def _run_until_complete(self, role: str) -> dict:
        session_id = _start_session(self.db, role)
        last = None
        for _ in range(20):
            last = await process_interview_answer(
                session_id,
                self.auth,
                "当时在交易中台，我负责缓存改造，目标是把 P95 从 800ms 降下来。"
                "我上了本地缓存和超时熔断，上线后延迟降到 120ms。",
            )
            if last["isComplete"]:
                return last
        self.fail("session did not complete")
        return last or {}

    async def test_hr_asks_eight_questions(self):
        result = await self._run_until_complete("hr")
        assistants = self.db.execute(
            "SELECT COUNT(*) AS c FROM interview_messages WHERE role = 'assistant'"
        ).fetchone()["c"]
        self.assertTrue(result["isComplete"])
        self.assertEqual(assistants, 8)
        self.assertEqual(result["questionCount"], 8)
        self.assertEqual(result["maxQuestions"], 8)

    async def test_technical_asks_ten_questions(self):
        result = await self._run_until_complete("technical")
        assistants = self.db.execute(
            "SELECT COUNT(*) AS c FROM interview_messages WHERE role = 'assistant'"
        ).fetchone()["c"]
        self.assertTrue(result["isComplete"])
        self.assertEqual(assistants, 10)
        self.assertEqual(result["questionCount"], 10)
        self.assertEqual(result["maxQuestions"], 10)


if __name__ == "__main__":
    unittest.main()
