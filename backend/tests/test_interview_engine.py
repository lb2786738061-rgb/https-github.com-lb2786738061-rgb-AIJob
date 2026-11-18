import unittest

from app.services.interview_engine import (
    FALLBACK_QUESTIONS,
    TECH_MAX_QUESTIONS,
    build_resume_brief,
    build_session_report,
    clean_interviewer_question,
    count_main_questions,
    get_interview_stage,
    is_probe_question,
    max_questions_for_role,
    plan_next_question_action,
    rule_based_evaluate,
    should_insert_probe,
    _fallback_question,
)
from app.services.tech_interview import build_tech_agenda, extract_resume_techs


class InterviewEngineTests(unittest.TestCase):
    def test_stages_cover_eight_questions(self):
        self.assertEqual(get_interview_stage(1)["id"], "opening")
        self.assertEqual(get_interview_stage(3)["id"], "core")
        self.assertEqual(get_interview_stage(6)["id"], "pressure")
        self.assertEqual(get_interview_stage(8)["id"], "close")

    def test_resume_brief_prefers_layout_over_raw_text(self):
        brief = build_resume_brief(
            {
                "rawText": "一堆无结构文本",
                "layout": {
                    "name": "李冰",
                    "summary": "全栈工程师",
                    "experience": [
                        {
                            "org": "某公司",
                            "role": "后端",
                            "bullets": ["把接口延迟从 800ms 降到 120ms"],
                        }
                    ],
                    "skills": {"groups": [{"items": ["Python", "FastAPI"]}]},
                },
                "sections": {},
            },
            target_job_title="高级后端工程师",
        )
        self.assertIn("李冰", brief)
        self.assertIn("高级后端工程师", brief)
        self.assertIn("800ms", brief)
        self.assertIn("Python", brief)

    def test_rule_based_eval_rewards_star_and_numbers(self):
        weak = rule_based_evaluate("介绍一个项目", "还可以吧，就是做了一些东西")
        strong = rule_based_evaluate(
            "介绍一个项目",
            "当时在交易中台，我负责把查询接口从同步改成缓存。目标是把 P95 从 800ms 降下来。"
            "我先加了本地缓存和超时熔断，上线后延迟降到 120ms，故障率也下降了。",
        )
        self.assertGreater(strong["scoreLogic"], weak["scoreLogic"])
        self.assertTrue(strong["starCoverage"]["result"])
        self.assertIn("量化结果", "".join(weak["missedPoints"]))

    def test_skip_and_probe_rules(self):
        skipped = rule_based_evaluate("Q", "", skipped=True)
        self.assertLess(skipped["scoreProfessional"], 40)
        self.assertTrue(should_insert_probe(skipped, "", 0))
        self.assertFalse(should_insert_probe(skipped, "", 2))

    def test_report_includes_verdict_and_practice_plan(self):
        qa = [
            {
                "question": "介绍项目",
                "answer": "我做了缓存，延迟从 800ms 降到 120ms。",
                "evaluation": rule_based_evaluate(
                    "介绍项目",
                    "当时项目在交易中台，我负责缓存改造，目标是降低延迟。我上了本地缓存，结果 P95 从 800ms 降到 120ms。",
                ),
            }
        ]
        report = build_session_report(qa)
        self.assertIn("overallScore", report)
        self.assertIn("label", report["verdict"])
        self.assertTrue(report["practicePlan"])
        self.assertEqual(report["starCoverage"]["result"], 100)

    def test_clean_question_strips_prefix(self):
        self.assertEqual(clean_interviewer_question('面试官：请介绍一下你自己'), "请介绍一下你自己")
        self.assertTrue(is_probe_question("【追问】你刚才说的指标基线是多少？"))
        self.assertFalse(is_probe_question("你刚才说的指标基线是多少？"))

    def test_extracts_middleware_stack_and_covers_redis_in_depth(self):
        parsed = {
            "rawText": "中间件：Redis、RabbitMQ、Docker",
            "sections": {
                "skills": ["中间件与架构：Redis、RabbitMQ、Canal、Docker"]
            },
            "layout": {
                "skills": {
                    "groups": [
                        {"label": "中间件", "items": ["Redis", "RabbitMQ", "Docker"]}
                    ]
                }
            },
        }
        techs = extract_resume_techs(parsed)
        names = [item["name"] for item in techs]
        self.assertIn("Redis", names)
        self.assertIn("RabbitMQ", names)
        self.assertIn("Docker", names)
        agenda = build_tech_agenda(techs, 8)
        redis_slots = [slot for slot in agenda if slot["tech"] == "Redis"]
        self.assertGreaterEqual(len(redis_slots), 3)
        agenda10 = build_tech_agenda(techs, 10)
        redis10 = [slot for slot in agenda10 if slot["tech"] == "Redis"]
        self.assertGreaterEqual(len(redis10), 5)
        labels10 = {slot["label"] for slot in redis10}
        self.assertTrue({"项目落地", "缓存三大问题", "持久化"} <= labels10)
        labels = {slot["label"] for slot in redis_slots}
        self.assertTrue(labels & {"项目落地", "缓存三大问题", "持久化", "数据结构", "过期与淘汰"})
        first = _fallback_question("technical", 1, tech_agenda=agenda)
        self.assertIn("Redis", first)

    def test_technical_stage_names(self):
        self.assertEqual(get_interview_stage(1, "technical")["name"], "技术落地")
        self.assertEqual(get_interview_stage(3, "technical")["id"], "core")
        self.assertEqual(get_interview_stage(1, "enterprise:bytedance")["name"], "技术落地")
        self.assertEqual(get_interview_stage(1, "enterprise:bytedance")["total"], 8)
        self.assertEqual(get_interview_stage(8, "hr")["total"], 8)
        self.assertEqual(get_interview_stage(10, "technical")["total"], 10)

    def test_technical_fallback_covers_ten(self):
        self.assertGreaterEqual(len(FALLBACK_QUESTIONS["technical"]), 10)
        self.assertEqual(max_questions_for_role("technical"), TECH_MAX_QUESTIONS)
        last = _fallback_question("technical", 10)
        self.assertTrue(last)

    def test_agenda_has_ten_slots(self):
        techs = extract_resume_techs(
            {
                "rawText": "Redis Docker RabbitMQ",
                "layout": {
                    "skills": {
                        "groups": [{"items": ["Redis", "Docker", "RabbitMQ"]}]
                    }
                },
            }
        )
        agenda = build_tech_agenda(techs, 10)
        self.assertEqual(len(agenda), 10)

    def test_plan_fills_eight_and_ten_questions(self):
        def fill(max_questions: int, allow_probe: bool = False) -> int:
            asked_main = 1
            while True:
                action = plan_next_question_action(
                    asked_main=asked_main,
                    max_questions=max_questions,
                    last_was_probe=False,
                    probe_used=0,
                    allow_probe=allow_probe,
                    evaluation={
                        "scoreLogic": 80,
                        "scoreProfessional": 80,
                        "starCoverage": {"result": True},
                    },
                    answer="当时在交易中台，我负责缓存改造，目标是把 P95 从 800ms 降下来。我上了本地缓存，结果降到 120ms。",
                )
                if action != "next":
                    return asked_main
                asked_main += 1

        self.assertEqual(fill(8), 8)
        self.assertEqual(fill(10), 10)

    def test_technical_probe_does_not_consume_next_slot(self):
        action = plan_next_question_action(
            asked_main=3,
            max_questions=10,
            last_was_probe=False,
            probe_used=0,
            allow_probe=True,
            evaluation={
                "scoreLogic": 40,
                "scoreProfessional": 40,
                "starCoverage": {"result": False},
            },
            answer="还可以吧",
        )
        self.assertEqual(action, "probe")
        self.assertEqual(
            count_main_questions(
                [
                    {"role": "assistant", "content": "Q1 Redis 怎么用"},
                    {"role": "user", "content": "用过"},
                    {"role": "assistant", "content": "【追问】具体怎么用"},
                ]
            ),
            1,
        )


if __name__ == "__main__":
    unittest.main()
