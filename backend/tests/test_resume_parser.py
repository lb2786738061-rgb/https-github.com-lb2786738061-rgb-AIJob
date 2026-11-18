import unittest

from app.services.resume_parser import _column_text, structure_resume_text


def _block(x0: float, y0: float, x1: float, y1: float, text: str, block_type: int = 0):
    return (x0, y0, x1, y1, text, 0, block_type)


class ResumeParserTests(unittest.TestCase):
    def test_spaced_cjk_headers_extract_sections(self):
        parsed = structure_resume_text(
            "\n".join(
                [
                    "张三",
                    "工 作 经 历",
                    "阿里巴巴 | 工程师 | 2020.06 - 2023.08",
                    "负责交易系统开发",
                    "教 育 背 景",
                    "清华大学 | 本科 | 2016.09 - 2020.06",
                    "项 目 经 历",
                    "简历助手 | 负责人 | 2023.01 - 2023.06",
                ]
            )
        )
        self.assertTrue(parsed["sections"]["experience"])
        self.assertIn("阿里巴巴", "\n".join(parsed["sections"]["experience"]))
        self.assertTrue(parsed["sections"]["education"])
        self.assertIn("清华大学", "\n".join(parsed["sections"]["education"]))
        self.assertTrue(parsed["sections"]["projects"])
        self.assertIn("简历助手", "\n".join(parsed["sections"]["projects"]))

    def test_inline_header_stuck_to_body_extracts_experience(self):
        parsed = structure_resume_text(
            "张三\n工作经历阿里巴巴 | 工程师 | 2020.06 - 2023.08\n负责交易系统开发"
        )
        self.assertTrue(parsed["sections"]["experience"])
        joined = "\n".join(parsed["sections"]["experience"])
        self.assertIn("阿里巴巴", joined)
        self.assertIn("交易系统", joined)

    def test_two_column_blocks_read_left_then_right(self):
        blocks = [
            _block(50, 50, 200, 70, "张三"),
            _block(50, 90, 200, 110, "Python / Java"),
            _block(350, 50, 540, 70, "工作经历"),
            _block(350, 90, 540, 130, "阿里巴巴 | 工程师 | 2020.06 - 2023.08"),
            _block(100, 40, 180, 180, "", 1),
        ]
        text = _column_text(blocks, 595)
        self.assertEqual(
            text,
            "张三\nPython / Java\n\n工作经历\n阿里巴巴 | 工程师 | 2020.06 - 2023.08",
        )
        self.assertNotIn("张三\n工作经历\nPython", text)

    def test_standalone_word_style_headers_still_extract(self):
        parsed = structure_resume_text(
            "\n".join(
                [
                    "李四",
                    "13800000000",
                    "工作经历",
                    "腾讯 | 后端开发 | 2021.03 - 至今",
                    "负责支付网关",
                    "教育背景",
                    "北京大学 | 硕士 | 2018.09 - 2021.06",
                    "专业技能",
                    "Python",
                    "Go",
                ]
            )
        )
        self.assertIn("腾讯", "\n".join(parsed["sections"]["experience"]))
        self.assertIn("北京大学", "\n".join(parsed["sections"]["education"]))
        self.assertIn("Python", "\n".join(parsed["sections"]["skills"]))

    def test_mashed_long_section_is_kept(self):
        body = "负责" + ("系统开发与性能优化，" * 40)
        self.assertGreater(len(body), 400)
        parsed = structure_resume_text(f"张三\n工作经历{body}")
        self.assertEqual(len(parsed["sections"]["experience"]), 1)
        self.assertIn("系统开发", parsed["sections"]["experience"][0])

    def test_numbered_project_title_is_not_kept_as_bullet(self):
        parsed = structure_resume_text(
            "\n".join(
                [
                    "张三",
                    "工作经历",
                    "ABC科技有限公司 | 前端 | 2021.06 - 至今",
                    "1、智能招聘系统",
                    "负责前端架构",
                    "2、数据中台可视化平台",
                    "负责图表组件",
                ]
            )
        )
        self.assertGreaterEqual(len(parsed["sections"]["experience"]), 3)
        joined = "\n".join(parsed["sections"]["experience"])
        self.assertIn("智能招聘", joined)
        self.assertIn("数据中台", joined)


if __name__ == "__main__":
    unittest.main()
