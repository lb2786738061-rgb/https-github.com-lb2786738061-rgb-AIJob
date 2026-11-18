"""Resume-driven technical interview: extract stack and cover each tech in depth."""

from __future__ import annotations

import re
from typing import Any


def _dims(*items: tuple[str, str, str, str]) -> list[dict[str, str]]:
    return [
        {"id": dim_id, "label": label, "ask": ask, "keywords": keywords}
        for dim_id, label, ask, keywords in items
    ]


GENERIC_DIMENSIONS = _dims(
    ("usage", "项目落地", "你在哪个项目里用到了{tech}？它解决什么问题，关键设计是什么？", "项目 落地 场景 key"),
    ("principle", "核心原理", "{tech} 最关键的底层机制是什么？你怎么向同事讲清楚？", "原理 机制 底层"),
    ("failure", "故障边界", "{tech} 在生产上最常见的故障是什么？你怎么发现、止损、避免再发？", "故障 超时 堆积 宕机"),
    ("tradeoff", "选型对比", "当时为什么选 {tech}，而不是常见替代方案？放弃了什么？", "对比 选型 替代"),
    ("scale", "性能运维", "流量或数据量放大 10 倍时，{tech} 会先在哪里成为瓶颈？你怎么改？", "性能 瓶颈 监控"),
)


TECH_CATALOG: list[dict[str, Any]] = [
    {
        "id": "redis",
        "name": "Redis",
        "priority": 100,
        "aliases": ["redis"],
        "dimensions": _dims(
            ("usage", "项目落地", "简历里 Redis 用在哪个项目？缓存、锁、队列还是会话？key 怎么设计、过期怎么定？", "项目 key 过期 缓存 锁"),
            ("datastructures", "数据结构", "这个场景为什么用 String/Hash/ZSet/Bitmap/Stream，而不是别的结构？内存和查询复杂度差在哪？", "hash zset string bitmap stream 结构"),
            ("cache", "缓存三大问题", "穿透、击穿、雪崩你在项目里分别怎么防？互斥锁、空值缓存、单飞、熔断各适合什么？", "穿透 击穿 雪崩 空值 单飞"),
            ("persist", "持久化", "RDB 和 AOF 你怎么选？fork、rewrite 会造成什么抖动，怎么降低丢数据窗口？", "rdb aof 持久化 fork rewrite"),
            ("expire", "过期与淘汰", "key 过期后会发生什么？你用的淘汰策略是什么，大 key、热 key 怎么处理？", "过期 淘汰 lru lfu 大key 热key"),
            ("consistency", "双写一致性", "缓存和 DB 怎么保持一致？先更新库还是先删缓存？延迟双删、订阅 binlog 你怎么看？", "一致性 双写 删缓存 binlog"),
            ("ha", "高可用", "主从、哨兵、Cluster 你用过哪种？槽位迁移、脑裂、只读从库延迟怎么处理？", "哨兵 cluster 主从 槽位 脑裂"),
            ("concurrency", "并发与锁", "pipeline、事务、Lua 各解决什么？分布式锁过期了业务还没完，你怎么续期和防误删？", "pipeline lua 事务 分布式锁 续期"),
            ("ops", "性能运维", "怎么排查 Redis 变慢？慢日志、bigkeys、fork 导致的延迟、监控指标你看哪些？", "慢查询 bigkey 监控 延迟"),
        ),
    },
    {
        "id": "rabbitmq",
        "name": "RabbitMQ",
        "priority": 96,
        "aliases": ["rabbitmq", "rabbit mq"],
        "dimensions": _dims(
            ("usage", "项目落地", "RabbitMQ 在项目里承担什么？交换机类型怎么选，消息长什么样？", "交换机 exchange 队列 routing"),
            ("reliability", "投递可靠性", "怎么保证不丢消息？publisher confirm、持久化、mandatory、ack 你怎么配？", "confirm ack 持久化 不丢"),
            ("order", "顺序与重复", "如何处理重复消费和乱序？幂等键、业务去重、单队列单消费者各有什么代价？", "幂等 重复 乱序 顺序"),
            ("backlog", "堆积与限流", "队列堆积时你怎么发现和泄洪？死信、延迟队列、消费者预取你怎么设？", "堆积 死信 延迟 prefetch qos"),
            ("ha", "高可用", "镜像队列或 quorum 你怎么选？节点宕了未 ack 的消息会怎样？", "镜像 quorum 高可用"),
            ("tradeoff", "对比选型", "为什么是 RabbitMQ 而不是 Kafka/Redis Stream/CAP？吞吐、延迟、顺序你怎么权衡？", "kafka 对比 选型"),
        ),
    },
    {
        "id": "kafka",
        "name": "Kafka",
        "priority": 95,
        "aliases": ["kafka"],
        "dimensions": _dims(
            ("usage", "项目落地", "Kafka 在链路里做什么？topic、分区、key 怎么定，保证什么语义？", "topic 分区 key"),
            ("semantics", "投递语义", "at most once / at least once / exactly once 你实际用的是哪种，怎么落地？", "exactly ack 幂等 事务"),
            ("rebalance", "消费与再均衡", "消费者组再均衡时会丢进度吗？位移提交策略怎么选？", "rebalance offset 消费者组"),
            ("lag", "堆积与性能", "消费延迟飙升你怎么查？分区数、ISR、副本、压缩各影响什么？", "lag isr 副本 堆积"),
        ),
    },
    {
        "id": "docker",
        "name": "Docker",
        "priority": 90,
        "aliases": ["docker"],
        "dimensions": _dims(
            ("usage", "项目落地", "镜像怎么构建？多阶段构建、基础镜像、配置和密钥你怎么处理？", "镜像 dockerfile 构建"),
            ("network", "网络与存储", "容器网络模式怎么选？数据卷、日志、时区这些生产问题你怎么解？", "网络 volume 数据卷"),
            ("compose", "编排落地", "docker-compose 里依赖、健康检查、重启策略怎么配？和 K8s 边界在哪？", "compose 健康检查 重启"),
            ("troubleshoot", "故障排查", "容器起不来、OOM、磁盘写满，你的排查顺序是什么？", "oom 日志 磁盘 排查"),
            ("security", "安全与发布", "如何避免把密钥打进镜像？镜像扫描、非 root、只读层你做了哪些？", "密钥 安全 root 扫描"),
        ),
    },
    {
        "id": "kubernetes",
        "name": "Kubernetes",
        "priority": 92,
        "aliases": ["kubernetes", "k8s"],
        "dimensions": _dims(
            ("usage", "项目落地", "工作负载用 Deployment 还是 StatefulSet？探针、资源限制怎么定？", "deployment probe 资源"),
            ("network", "服务发现", "Service、Ingress、DNS 怎么走？滚动发布时如何保证不断流？", "service ingress 滚动"),
            ("failure", "故障", "Pod 反复重启、节点 NotReady，你怎么定位？", "crashloop 探针 事件"),
        ),
    },
    {
        "id": "mysql",
        "name": "MySQL",
        "priority": 94,
        "aliases": ["mysql"],
        "dimensions": _dims(
            ("index", "索引", "这条慢 SQL 的索引你怎么设计？覆盖索引、最左匹配、回表怎么解释？", "索引 回表 explain"),
            ("txn", "事务隔离", "项目用什么隔离级别？脏读、幻读、间隙锁你怎么处理超卖？", "隔离 锁 幻读 事务"),
            ("ha", "主从与备份", "主从延迟、读写分离、备份恢复你怎么做？", "主从 延迟 备份"),
        ),
    },
    {
        "id": "postgresql",
        "name": "PostgreSQL",
        "priority": 88,
        "aliases": ["postgresql", "postgres"],
        "dimensions": _dims(
            ("usage", "项目落地", "为什么用 PostgreSQL？JSONB、窗口函数、并发控制你用到了哪些？", "jsonb mvcc 窗口"),
            ("index", "索引与性能", "BTree/GIN/GiST 怎么选？vacuum 和膨胀你怎么处理？", "gin vacuum 索引"),
        ),
    },
    {
        "id": "sqlserver",
        "name": "SQL Server",
        "priority": 86,
        "aliases": ["sql server", "sqlserver", "t-sql", "tsql"],
        "dimensions": _dims(
            ("usage", "项目落地", "存储过程、索引、事务在项目里怎么分工？哪些逻辑不该放进库里？", "存储过程 索引 事务"),
            ("index", "执行计划", "怎么看执行计划、找缺失索引和参数嗅探？", "执行计划 参数嗅探 索引"),
            ("lock", "锁与阻塞", "阻塞、死锁怎么查？隔离级别和 nolock 你怎么取舍？", "死锁 阻塞 隔离"),
        ),
    },
    {
        "id": "elasticsearch",
        "name": "Elasticsearch",
        "priority": 84,
        "aliases": ["elasticsearch", "elastic search", "elk"],
        "dimensions": _dims(
            ("usage", "项目落地", "ES 存什么、怎么建索引？和 DB 的职责怎么切？", "倒排 索引 mapping"),
            ("consistency", "近实时与一致", "refresh、translog、脑裂你怎么理解？写入可见延迟如何接受？", "refresh translog 近实时"),
        ),
    },
    {
        "id": "nginx",
        "name": "Nginx",
        "priority": 78,
        "aliases": ["nginx"],
        "dimensions": _dims(
            ("usage", "项目落地", "反向代理、负载、静态资源你怎么配？超时和缓冲踩过哪些坑？", "反向代理 负载 超时"),
            ("lb", "负载与高可用", "upstream 策略、健康检查、会话保持怎么做？", "upstream 健康检查"),
        ),
    },
    {
        "id": "consul",
        "name": "Consul",
        "priority": 80,
        "aliases": ["consul"],
        "dimensions": _dims(
            ("usage", "项目落地", "Consul 做服务发现还是配置中心？健康检查失败后流量怎么切？", "服务发现 健康检查 配置"),
            ("consistency", "一致性", "Raft、脑裂、多数据中心你怎么理解？注册失败怎么降级？", "raft 脑裂 降级"),
        ),
    },
    {
        "id": "nacos",
        "name": "Nacos",
        "priority": 80,
        "aliases": ["nacos"],
        "dimensions": _dims(
            ("usage", "项目落地", "Nacos 里服务注册和配置推送怎么用？和 Consul/Apollo 比你为什么选它？", "注册 配置 推送"),
            ("failure", "故障", "配置中心挂了应用会怎样？你做了本地缓存还是启动强依赖？", "降级 缓存 故障"),
        ),
    },
    {
        "id": "dotnet",
        "name": ".NET",
        "priority": 82,
        "aliases": [".net", "dotnet", "asp.net", "c#", "csharp", ".net core", ".net 6", ".net 8", "webapi"],
        "dimensions": _dims(
            ("usage", "项目落地", "ASP.NET / .NET 在项目里的分层怎么切？同步接口和后台任务怎么协作？", "分层 webapi 后台"),
            ("async", "并发模型", "async/await、线程池饥饿、HttpClient 复用你怎么处理？", "async 线程池 httpclient"),
            ("gc", "性能", "GC、内存泄漏、热路径你怎么查？有没有真实优化案例？", "gc 内存 性能"),
            ("abp", "框架取舍", "ABP / 自建框架的边界在哪？哪些扩展点你真正改过？", "abp 模块 扩展"),
        ),
    },
    {
        "id": "python",
        "name": "Python",
        "priority": 75,
        "aliases": ["python"],
        "dimensions": _dims(
            ("usage", "项目落地", "Python 在项目里做什么？GIL 对你的架构有什么影响？", "gil 同步 异步"),
            ("async", "并发", "多线程、多进程、asyncio、Celery/RQ 你怎么选？", "asyncio celery rq 进程"),
            ("packaging", "工程化", "依赖、虚拟环境、类型检查、测试你怎么保证可维护？", "依赖 pytest 类型"),
        ),
    },
    {
        "id": "fastapi",
        "name": "FastAPI",
        "priority": 72,
        "aliases": ["fastapi"],
        "dimensions": _dims(
            ("usage", "项目落地", "FastAPI 路由、依赖注入、后台任务你怎么组织？和 Flask 比优势在哪？", "依赖注入 路由"),
            ("async", "异步陷阱", "哪些调用会堵住事件循环？你怎么隔离同步 ORM 或 CPU 任务？", "事件循环 阻塞 线程池"),
        ),
    },
    {
        "id": "vue",
        "name": "Vue",
        "priority": 55,
        "aliases": ["vue", "vue.js", "vue 3", "vuex"],
        "dimensions": _dims(
            ("usage", "项目落地", "Vue 3 里状态、路由、组件通信怎么拆？你负责到哪一层？", "组合式 pinia vuex"),
            ("perf", "性能", "大列表、无用渲染、打包体积你怎么优化？", "虚拟列表 keep-alive 渲染"),
        ),
    },
    {
        "id": "canal",
        "name": "Canal",
        "priority": 83,
        "aliases": ["canal"],
        "dimensions": _dims(
            ("usage", "项目落地", "Canal 订阅什么、往哪里灌？如何保证 binlog 解析不丢、不乱？", "binlog 订阅 位点"),
            ("consistency", "延迟与一致", "同步延迟、重复、表结构变更你怎么处理？", "延迟 幂等 ddl"),
        ),
    },
    {
        "id": "cap",
        "name": "CAP",
        "priority": 81,
        "aliases": ["cap"],
        "dimensions": _dims(
            ("usage", "项目落地", "CAP 发消息和本地事务怎么保证最终一致？失败重试、回查你怎么做？", "最终一致 本地消息 重试"),
            ("failure", "失败语义", "Outbox 写入成功但 Broker 挂了会怎样？你怎么对账？", "outbox 对账 补偿"),
        ),
    },
    {
        "id": "jenkins",
        "name": "Jenkins",
        "priority": 60,
        "aliases": ["jenkins", "ci/cd", "cicd"],
        "dimensions": _dims(
            ("usage", "项目落地", "流水线分几段？失败回滚、制品、密钥怎么管？", "pipeline 回滚 制品"),
        ),
    },
    {
        "id": "prometheus",
        "name": "Prometheus",
        "priority": 70,
        "aliases": ["prometheus", "skywalking"],
        "dimensions": _dims(
            ("usage", "项目落地", "你监控哪些黄金指标？告警怎么避免风暴？一次真实排障讲清楚。", "指标 告警 排障"),
        ),
    },
]

def _haystack(parsed: dict | None) -> str:
    parsed = parsed or {}
    chunks: list[str] = [str(parsed.get("rawText") or "")]
    layout = parsed.get("layout") if isinstance(parsed.get("layout"), dict) else {}
    sections = parsed.get("sections") if isinstance(parsed.get("sections"), dict) else {}
    skills = layout.get("skills") or sections.get("skills") or []
    if isinstance(skills, dict):
        for group in skills.get("groups") or []:
            chunks.append(str(group.get("label") or ""))
            chunks.extend(str(item) for item in (group.get("items") or []))
    elif isinstance(skills, list):
        chunks.extend(str(item) for item in skills)
    for key in ("experience", "projects", "summary"):
        value = layout.get(key) or sections.get(key) or ""
        chunks.append(str(value))
    return "\n".join(chunks).lower()


def _alias_hit(alias: str, text: str) -> bool:
    needle = alias.lower()
    if needle.startswith(".") or "#" in needle or " " in needle:
        return needle in text
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(needle)}(?![a-z0-9])", text, re.I))


def extract_resume_techs(parsed: dict | None) -> list[dict[str, Any]]:
    text = _haystack(parsed)
    found: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in TECH_CATALOG:
        if any(_alias_hit(alias, text) for alias in item["aliases"]):
            if item["id"] in seen:
                continue
            seen.add(item["id"])
            found.append(item)
    found.sort(key=lambda row: (-int(row["priority"]), row["name"]))
    return found


def _slot(tech: dict[str, Any], dimension: dict[str, str], index: int) -> dict[str, Any]:
    return {
        "index": index,
        "techId": tech["id"],
        "tech": tech["name"],
        "dimension": dimension["id"],
        "label": dimension["label"],
        "ask": dimension["ask"].format(tech=tech["name"]),
        "keywords": dimension["keywords"],
    }


def _counts_for(tech_n: int, slots: int) -> list[int]:
    if tech_n <= 0:
        return []
    if tech_n == 1:
        return [slots]
    if tech_n == 2:
        primary = slots // 2 + slots % 2 + (1 if slots >= 6 else 0)
        primary = min(primary, slots - 1)
        return [primary, slots - primary]
    if slots >= 10 and tech_n >= 3:
        return [5, 3, slots - 8]
    primary = min(4, max(3, slots - 3)) if slots >= 7 else max(2, slots - 2)
    remain = slots - primary
    second = max(1, (remain + 1) // 2)
    third = max(1, remain - second)
    while primary + second + third > slots:
        if primary > 2:
            primary -= 1
        elif second > 1:
            second -= 1
        else:
            third -= 1
    counts = [primary, second, third]
    extra = slots - sum(counts)
    if extra > 0:
        counts[0] += extra
    return counts


def build_tech_agenda(techs: list[dict[str, Any]], question_count: int = 8) -> list[dict[str, Any]]:
    if not techs:
        return []
    picked = techs[:3]
    counts = _counts_for(len(picked), question_count)
    agenda: list[dict[str, Any]] = []
    for tech, count in zip(picked, counts):
        dims = list(tech.get("dimensions") or GENERIC_DIMENSIONS)
        if len(dims) < count:
            extras = [dim for dim in GENERIC_DIMENSIONS if dim["id"] not in {d["id"] for d in dims}]
            dims.extend(extras)
            while len(dims) < count:
                dims.append(dims[len(dims) % max(len(tech.get("dimensions") or [GENERIC_DIMENSIONS[0]]), 1)])
        for dimension in dims[:count]:
            agenda.append(_slot(tech, dimension, len(agenda) + 1))
    return agenda[:question_count]


def tech_slot_for(agenda: list[dict[str, Any]], question_index: int, *, probe: bool = False) -> dict[str, Any] | None:
    if not agenda:
        return None
    idx = max(1, int(question_index or 1))
    if probe:
        idx = max(1, idx - 1)
    return agenda[min(idx, len(agenda)) - 1]


def format_tech_stack_line(techs: list[dict[str, Any]]) -> str:
    if not techs:
        return ""
    names = "、".join(item["name"] for item in techs[:8])
    return f"简历技术栈（按考察优先级）：{names}"


def format_tech_agenda_prompt(agenda: list[dict[str, Any]], current: dict[str, Any] | None) -> str:
    if not agenda:
        return ""
    lines = ["本场技术点检清单（必须按序覆盖，每题只打一个考点）："]
    for slot in agenda:
        mark = "← 当前" if current and slot["index"] == current["index"] else ""
        lines.append(f"{slot['index']}. {slot['tech']} · {slot['label']} {mark}".rstrip())
    if current:
        lines.append(
            f"当前必须考察：{current['tech']} 的「{current['label']}」。"
            f"问法要结合简历项目，但考点必须打到该维度，不能只问「你用过吗」。"
            f"参考问法：{current['ask']}"
        )
        lines.append("禁止把已经问过的维度再问一遍，除非上一题完全没答清。")
    return "\n".join(lines)


def public_tech_agenda(agenda: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "index": slot["index"],
            "tech": slot["tech"],
            "techId": slot["techId"],
            "dimension": slot["dimension"],
            "label": slot["label"],
        }
        for slot in agenda
    ]
