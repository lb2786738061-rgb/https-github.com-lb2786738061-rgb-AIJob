from typing import TypedDict


class EnterpriseCompany(TypedDict):
    id: str
    name: str
    industry: str
    description: str
    questions: list[str]


ENTERPRISE_COMPANIES: list[EnterpriseCompany] = [
    {
        "id": "bytedance",
        "name": "字节跳动",
        "industry": "internet_rd",
        "description": "互联网大厂综合面，注重业务理解与技术深度",
        "questions": [
            "请介绍一个你负责的核心项目，以及你在其中的关键贡献。",
            "如何设计一个高并发的推荐系统？你会关注哪些指标？",
            "遇到技术方案被否定时，你如何处理？",
            "描述一次跨团队协作推动项目的经历。",
            "你对字节「始终创业」的文化如何理解？",
            "如何平衡快速迭代与代码质量？",
            "请举例说明你如何用数据驱动产品决策。",
            "你如何看待 OKR 与 KPI 的区别？",
        ],
    },
    {
        "id": "alibaba",
        "name": "阿里巴巴",
        "industry": "internet_rd",
        "description": "电商/云计算方向，强调价值观与业务结果",
        "questions": [
            "用 STAR 法则介绍你最有成就感的项目。",
            "如何保障大促期间系统稳定性？",
            "客户第一、团队合作、拥抱变化，哪个对你挑战最大？",
            "描述一次你在压力下交付的经历。",
            "如果业务目标与技术债务冲突，你怎么权衡？",
            "你如何理解中台战略？",
            "请分享一次你推动组织变革的经历。",
            "双11 峰值流量你会如何设计架构？",
        ],
    },
    {
        "id": "tencent",
        "name": "腾讯",
        "industry": "internet_pm",
        "description": "产品/技术综合面，关注用户价值与协作",
        "questions": [
            "请做一个自我介绍，突出与目标岗位的匹配点。",
            "如何评估一个产品功能是否值得做？",
            "描述一次用户需求与技术实现产生分歧的处理过程。",
            "你如何做竞品分析？",
            "为什么想加入腾讯？",
            "微信生态下如何做增长？",
            "请描述一次失败的产品决策及复盘。",
            "如何衡量用户留存与活跃度？",
        ],
    },
    {
        "id": "huawei",
        "name": "华为",
        "industry": "manufacturing",
        "description": "硬科技/通信方向，注重抗压与专业深度",
        "questions": [
            "介绍你的技术背景和核心技能。",
            "描述一次解决复杂技术难题的经历。",
            "如何在资源受限下保证项目交付？",
            "你对加班和出差怎么看？",
            "你的职业规划是什么？",
            "请介绍你对 5G/6G 技术趋势的理解。",
            "如何管理跨国团队沟通？",
            "描述一次你在质量与进度冲突中的取舍。",
        ],
    },
    {
        "id": "mckinsey",
        "name": "麦肯锡",
        "industry": "consulting",
        "description": "咨询案例面，考察结构化思维与商业洞察",
        "questions": [
            "估算中国一年消耗多少张 A4 纸？请给出结构化思路。",
            "某连锁餐饮利润下滑，你会如何诊断？",
            "描述一次你用数据驱动决策的经历。",
            "Why consulting? Why us?",
            "你最大的失败是什么？学到了什么？",
            "如何向非专业人士解释复杂商业问题？",
            "某新能源车企进入欧洲市场，你会如何制定策略？",
            "请用 MECE 原则拆解一个你熟悉的行业。",
        ],
    },
    {
        "id": "baidu",
        "name": "百度",
        "industry": "data_ai",
        "description": "AI 与大搜索方向，注重算法与工程结合",
        "questions": [
            "介绍你在 NLP/搜索/推荐方面的经验。",
            "如何评估大模型应用的业务价值？",
            "描述一次模型上线后的效果优化经历。",
            "搜索排序中如何平衡 relevance 与 diversity？",
            "你如何看待 AGI 对行业的影响？",
            "请介绍一个你主导的 AI 项目完整链路。",
            "如何处理训练数据中的 bias 问题？",
            "百度 Apollo 自动驾驶你认为核心挑战是什么？",
        ],
    },
    {
        "id": "meituan",
        "name": "美团",
        "industry": "internet_ops",
        "description": "本地生活/O2O，强调运营效率与履约",
        "questions": [
            "请介绍你对本地生活行业的理解。",
            "如何提升骑手配送效率？",
            "描述一次你用运营手段拉动 GMV 的经历。",
            "外卖平台如何应对竞争对手补贴战？",
            "请分析美团「零售+科技」战略。",
            "如何设计商家侧的激励机制？",
            "高峰期系统降级策略你会如何设计？",
            "用户增长与商户供给如何平衡？",
        ],
    },
    {
        "id": "jd",
        "name": "京东",
        "industry": "ecommerce",
        "description": "电商与物流，强调供应链与用户体验",
        "questions": [
            "京东自营模式与平台模式有何差异？",
            "如何优化仓储拣货效率？",
            "描述一次你处理客诉或售后危机的经历。",
            "618 大促技术保障你会关注什么？",
            "请介绍你对供应链数字化的理解。",
            "如何降低物流最后一公里成本？",
            "品类运营中如何做选品决策？",
            "京东科技业务你认为增长点在哪？",
        ],
    },
    {
        "id": "xiaomi",
        "name": "小米",
        "industry": "hardware",
        "description": "硬件+IoT 生态，注重产品思维与性价比",
        "questions": [
            "请介绍你对小米 IoT 生态的理解。",
            "如何做硬件产品的成本管控？",
            "描述一次产品从 0 到 1 的经历。",
            "手机行业存量竞争下如何差异化？",
            "你如何看待「人车家全生态」战略？",
            "硬件研发中如何管理 BOM 变更？",
            "请分享一次用户反馈驱动产品迭代的案例。",
            "小米国际化面临哪些挑战？",
        ],
    },
    {
        "id": "deloitte",
        "name": "德勤",
        "industry": "consulting",
        "description": "四大咨询，考察商业分析与沟通能力",
        "questions": [
            "请用结构化方式分析某行业盈利下降原因。",
            "Describe a time you worked in a diverse team.",
            "客户不认可你的分析结论时如何处理？",
            "数字化转型的关键成功因素有哪些？",
            "请估算某城市咖啡店数量并说明假设。",
            "你为何选择咨询行业？",
            "如何管理多个并行项目？",
            "ESG 对企业战略有何影响？",
        ],
    },
]


def get_enterprise_company(company_id: str) -> EnterpriseCompany | None:
    for company in ENTERPRISE_COMPANIES:
        if company["id"] == company_id:
            return company
    return None
