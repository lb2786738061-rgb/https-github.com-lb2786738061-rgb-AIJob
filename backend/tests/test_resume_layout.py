import unittest

from app.services.resume_layout import (
    layout_from_sections,
    parse_entry_from_item,
    parse_project_heading,
    split_company_projects,
)
from app.services.resume_parser import _split_section_items, structure_resume_text


class ResumeLayoutProjectSplitTests(unittest.TestCase):
    def test_labeled_projects_under_company(self):
        entry = parse_entry_from_item(
            "\n".join(
                [
                    "ABC科技有限公司 | 前端开发工程师 | 2021.06 - 至今",
                    "项目一：智能招聘系统",
                    "负责前端架构",
                    "项目二：企业官网",
                    "主导改版",
                ]
            ),
            "experience",
        )
        pieces = split_company_projects(entry)
        self.assertEqual(len(pieces), 3)
        self.assertFalse(pieces[0]["isSubLevel"])
        self.assertIn("ABC", pieces[0]["org"])
        self.assertTrue(pieces[1]["isSubLevel"])
        self.assertIn("智能招聘", pieces[1]["org"])
        self.assertTrue(any("前端架构" in item for item in pieces[1]["bullets"]))
        self.assertTrue(pieces[2]["isSubLevel"])
        self.assertIn("企业官网", pieces[2]["org"])
        self.assertTrue(any("主导改版" in item for item in pieces[2]["bullets"]))

    def test_numbered_project_title_without_date(self):
        entry = parse_entry_from_item(
            "\n".join(
                [
                    "ABC科技有限公司 | 前端开发工程师 | 2021.06 - 至今",
                    "1、智能招聘系统",
                    "负责前端架构",
                    "2、数据中台可视化平台",
                    "负责图表组件",
                ]
            ),
            "experience",
        )
        pieces = split_company_projects(entry)
        self.assertEqual(len(pieces), 3)
        self.assertFalse(pieces[0]["isSubLevel"])
        self.assertTrue(pieces[1]["isSubLevel"])
        self.assertIn("智能招聘", pieces[1]["org"])
        self.assertTrue(pieces[2]["isSubLevel"])
        self.assertIn("数据中台", pieces[2]["org"])

    def test_duty_sentence_is_not_a_project(self):
        entry = parse_entry_from_item(
            "\n".join(
                [
                    "ABC科技有限公司 | 前端开发工程师 | 2021.06 - 至今",
                    "负责电商平台项目的前端开发",
                    "参与组件库建设",
                ]
            ),
            "experience",
        )
        pieces = split_company_projects(entry)
        self.assertEqual(len(pieces), 1)
        self.assertFalse(pieces[0]["isSubLevel"])
        joined = "\n".join(pieces[0]["bullets"])
        self.assertIn("电商平台", joined)
        self.assertIn("组件库", joined)

    def test_mashed_project_one_two_split(self):
        entry = parse_entry_from_item(
            "ABC科技有限公司 | 前端开发工程师 | 2021.06 - 至今\n"
            "项目一：智能招聘系统负责前端架构。项目二：企业官网主导改版。",
            "experience",
        )
        pieces = split_company_projects(entry)
        self.assertEqual(len(pieces), 3)
        self.assertIn("智能招聘", pieces[1]["org"])
        self.assertIn("企业官网", pieces[2]["org"])
        self.assertTrue(any("前端架构" in item for item in pieces[1]["bullets"]))
        self.assertTrue(any("主导改版" in item for item in pieces[2]["bullets"]))

    def test_layout_from_sections_expands_experience(self):
        layout = layout_from_sections(
            {
                "contact": "张三",
                "experience": [
                    "\n".join(
                        [
                            "ABC科技有限公司 | 前端开发工程师 | 2021.06 - 至今",
                            "项目一：智能招聘系统",
                            "负责前端架构",
                            "项目二：数据中台可视化平台",
                            "负责图表组件",
                        ]
                    )
                ],
                "projects": [],
                "education": [],
                "skills": [],
            }
        )
        experience = layout["experience"]
        self.assertEqual(len(experience), 3)
        self.assertFalse(experience[0]["isSubLevel"])
        self.assertTrue(experience[1]["isSubLevel"])
        self.assertTrue(experience[2]["isSubLevel"])

    def test_duty_line_is_not_project_heading(self):
        self.assertIsNone(parse_project_heading("负责电商平台项目的前端开发"))


class ResumeParserProjectTitleTests(unittest.TestCase):
    def test_numbered_project_titles_become_separate_items(self):
        items = _split_section_items(
            "\n".join(
                [
                    "ABC科技有限公司 | 前端 | 2021.06 - 至今",
                    "1、智能招聘系统",
                    "负责前端架构",
                    "2、数据中台可视化平台",
                    "负责图表组件",
                ]
            )
        )
        self.assertGreaterEqual(len(items), 3)
        self.assertIn("ABC", items[0])
        self.assertTrue(any("智能招聘" in item for item in items[1:]))
        self.assertTrue(any("数据中台" in item for item in items[1:]))

    def test_numbered_duty_stays_with_company(self):
        items = _split_section_items(
            "\n".join(
                [
                    "ABC科技有限公司 | 前端 | 2021.06 - 至今",
                    "1. 负责交易系统开发",
                    "2. 参与组件库建设",
                ]
            )
        )
        self.assertEqual(len(items), 1)
        self.assertIn("交易系统", items[0])
        self.assertIn("组件库", items[0])

    def test_structure_resume_keeps_company_and_projects(self):
        parsed = structure_resume_text(
            "\n".join(
                [
                    "张三",
                    "工作经历",
                    "ABC科技有限公司 | 前端 | 2021.06 - 至今",
                    "项目一：智能招聘系统",
                    "负责前端架构",
                    "项目二：数据中台可视化平台",
                    "负责图表组件",
                ]
            )
        )
        layout = layout_from_sections(parsed["sections"])
        orgs = [entry["org"] for entry in layout["experience"]]
        self.assertTrue(any("ABC" in org for org in orgs))
        self.assertTrue(any("智能招聘" in org for org in orgs))
        self.assertTrue(any("数据中台" in org for org in orgs))
        self.assertTrue(any(entry.get("isSubLevel") for entry in layout["experience"]))


if __name__ == "__main__":
    unittest.main()
