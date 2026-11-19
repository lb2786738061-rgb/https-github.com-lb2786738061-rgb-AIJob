import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.db.migrate import ALTER_STATEMENTS, SCHEMA
from app.services.interview_engine import generate_replacement_question
from app.services.resume_parser import (
    infer_target_job_from_parsed,
    parse_resume_file,
    structure_resume_text,
)
from app.services.weak_questions import (
    get_user_exam_preferences,
    list_weak_questions,
    practice_weak_question,
    record_question_evaluation,
    update_weak_question_preference,
)


def _create_test_db() -> sqlite3.Connection:
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
        ("user@careerai.local", "求职者", "free", "2026-11-19T00:00:00+00:00"),
    )
    db.commit()
    return db


class MainFlowRequirementTests(unittest.IsolatedAsyncioTestCase):
    def test_resume_extracts_advantage_and_awards(self):
        """验证 R-03 & R-05：解析出个人优势(advantage)、荣誉奖项(award)并推断目标岗位"""
        raw = "\n".join(
            [
                "王小明 | 13900001111 | 求职意向：高级Java后端工程师",
                "个人优势",
                "5年高并发分布式系统研发经验，精通微服务架构与缓存治理。",
                "工作经历",
                "字节跳动 | 后端开发工程师 | 2021.07 - 至今",
                "负责核心推荐服务性能优化，将接口 P99 耗时降低 40%。",
                "项目经历",
                "分布式订单网关系统 | 核心负责人 | 2022.03 - 2023.09",
                "设计高可用限流与幂等组件。",
                "专业技能",
                "Java、Spring Boot、Redis、Kafka",
                "教育背景",
                "浙江大学 | 计算机科学与技术 本科 | 2017.09 - 2021.06",
                "荣誉奖项",
                "ACM-ICPC 亚洲区域赛银奖",
                "国家奖学金",
            ]
        )
        parsed = structure_resume_text(raw)
        sections = parsed["sections"]
        self.assertIn("高并发分布式", sections["advantage"])
        self.assertEqual(sections["advantage"], sections["summary"])
        self.assertTrue(sections["award"])
        self.assertIn("ACM-ICPC", "\n".join(sections["award"]))
        self.assertEqual(sections["award"], sections["awards"])
        inferred = infer_target_job_from_parsed(parsed)
        self.assertEqual(inferred, "高级Java后端工程师")

    def test_legacy_doc_rejected_with_clear_message(self):
        """验证 R-01：不支持旧版 .doc 时给出明确中文提示"""
        with tempfile.TemporaryDirectory() as tmp:
            doc_path = Path(tmp) / "legacy.doc"
            doc_path.write_bytes(b"fake legacy doc bytes")
            with self.assertRaises(ValueError) as ctx:
                parse_resume_file(str(doc_path))
            self.assertIn(".doc", str(ctx.exception))
            self.assertIn(".docx", str(ctx.exception))

    async def test_swap_question_returns_different_angle(self):
        """验证 I-05：换一题返回全新切入角度的题目且不与原题相同"""
        original_q = "请结合你最近一份经历，用 90 秒做自我介绍。"
        new_q = await generate_replacement_question(
            "technical",
            original_q,
            [original_q],
            question_index=1,
            resume_brief="经历：字节跳动高并发订单网关\n技能：Redis、Kafka",
            target_job_title="高级后端工程师",
        )
        self.assertTrue(new_q)
        self.assertNotEqual(new_q.strip(), original_q.strip())

    async def test_weak_question_closed_loop_and_exam_preferences(self):
        """验证 I-08 & P-01 & P-02：弱题入库默认再考 -> 对照练习再次评估达标转已掌握 -> 勾选下次再出联动"""
        db = _create_test_db()
        with patch("app.services.weak_questions.get_db", return_value=db):
            # 1. 记录一道低于 70 分的弱题
            weak_eval = {
                "scoreLogic": 50,
                "scoreProfessional": 48,
                "scoreMatch": 52,
                "scoreExpression": 55,
                "feedback": "缺少具体行动和量化结果",
                "modelAnswer": "在交易网关项目中，我通过本地缓存将延迟从 500ms 降至 90ms。",
                "missedPoints": ["缺少量化结果"],
            }
            meta = record_question_evaluation(
                user_id=1,
                session_id=None,
                resume_id=None,
                question="请讲一次你在Redis缓存治理中的线上事故排查经历？",
                answer="就是看了一下日志然后重启了服务。",
                evaluation=weak_eval,
                interviewer_role="technical",
                target_job_title="后端工程师",
            )
            self.assertEqual(meta["status"], "weak")
            self.assertTrue(meta["nextExamEnabled"])
            item_id = meta["weakQuestionId"]
            self.assertIsNotNone(item_id)

            # 2. 检查弱题筛选与出题偏好
            listed = list_weak_questions(1, status_filter="weak")
            self.assertEqual(listed["stats"]["weakCount"], 1)
            prefs = get_user_exam_preferences(1)
            self.assertEqual(len(prefs["weakRetry"]), 1)

            # 3. 对照示范答案进行重练并再次评估（高分回答自动转为已掌握）
            strong_answer = (
                "当时在订单网关项目中，由于热点 Key 失效导致数据库 QPS 飙升。"
                "我的任务是在 15 分钟内止损并彻底根治缓存击穿。"
                "我先采取了互斥锁与逻辑过期双层方案，并增加了热点探测本地缓存。"
                "最终上线后核心接口 P99 延迟从 820ms 降低到 95ms，缓存命中率提升至 99.6%。"
            )
            prac_res = await practice_weak_question(1, item_id, strong_answer)
            self.assertTrue(prac_res["masteredNow"])
            self.assertEqual(prac_res["item"]["status"], "mastered")
            # 已掌握题默认关闭下次再考，除非用户主动勾选
            self.assertFalse(prac_res["item"]["nextExamEnabled"])

            # 4. 用户主动勾选「下次再出」，验证进入 masteredRephrase 偏好
            updated = update_weak_question_preference(1, item_id, next_exam_enabled=True)
            self.assertTrue(updated["nextExamEnabled"])
            prefs_after = get_user_exam_preferences(1)
            self.assertEqual(len(prefs_after["masteredRephrase"]), 1)
        db.close()


if __name__ == "__main__":
    unittest.main()
