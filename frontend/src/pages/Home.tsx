import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { motion } from "motion/react";
import {
  ResumeIcon,
  MicIcon,
  ChartIcon,
  RocketIcon,
  ArrowRightIcon,
  SparkleIcon,
  GaugeIcon,
  BrainIcon,
  TargetIcon,
  CheckIcon,
  TrophyIcon,
  UsersIcon,
  TrendUpIcon,
  BuildingIcon,
  FlameIcon,
} from "../components/Icons";
import { Reveal, HoverCard, AnimatedGradientText } from "../components/Animations";

const FEATURES = [
  {
    Icon: ResumeIcon,
    title: "简历智能工作台",
    desc: "上传解析、多维诊断、JD 匹配、STAR 改写与专业模板美化导出，一站完成简历升级。",
    to: "/resume",
    tag: "简历核心",
    color: "from-emerald-50 to-teal-50 border-emerald-200",
  },
  {
    Icon: MicIcon,
    title: "AI 全真模拟面试",
    desc: "覆盖 HR / 技术 / 压力 / 英语与名企专项，支持追问、提示与过程评分，贴近真实面试节奏。",
    to: "/interview",
    tag: "实战演练",
    color: "from-amber-50 to-orange-50 border-amber-200",
  },
  {
    Icon: ChartIcon,
    title: "弱题复盘与深度报告",
    desc: "答错弱题自动沉淀，支持对照满分示范重练评估、控制下次是否再考，形成练习闭环。",
    to: "/practice",
    tag: "复盘闭环",
    color: "from-violet-50 to-purple-50 border-violet-200",
  },
];

const ROLES = [
  { name: "HR 面试官", desc: "文化匹配 · 沟通表达 · 动机考察" },
  { name: "技术面试官", desc: "系统设计 · 代码思维 · 架构能力" },
  { name: "压力面试官", desc: "高压追问 · 临场反应 · 心理素质" },
  { name: "英语面试官", desc: "口语表达 · 专业词汇 · 国际化场景" },
];

const METRICS = [
  { Icon: UsersIcon, value: "12,847", label: "累计用户" },
  { Icon: ResumeIcon, value: "38,291", label: "简历优化" },
  { Icon: MicIcon, value: "156,704", label: "模拟面试" },
  { Icon: TrophyIcon, value: "94.3%", label: "用户满意度" },
];

const TESTIMONIALS = [
  {
    name: "张同学",
    role: "应届 CS 硕士 → 字节跳动 后端开发",
    quote: "简历评分从 62 分拉到 87 分，STAR 改写建议直接可以用。压力面试练了 6 轮，真实面的时候真的没慌。",
    score: 8,
  },
  {
    name: "李先生",
    role: "3 年产品 → 美团 高级产品经理",
    quote: "JD 匹配分析帮我精准定位了缺失的关键词，面试复盘报告里的改进建议非常具体，不是空泛的套话。",
    score: 9,
  },
  {
    name: "王女士",
    role: "5 年前端 → 腾讯 技术面试通过",
    quote: "英语面试官特别好用，模拟了好几轮国际化场景的问答。AI 的追问比我预期的要犀利很多。",
    score: 8,
  },
];

const ENTERPRISES = ["字节跳动", "阿里巴巴", "腾讯", "华为", "美团", "京东", "百度", "网易"];

export default function Home() {
  const [llmEnabled, setLlmEnabled] = useState(false);

  useEffect(() => {
    api.getHealth().then((d) => setLlmEnabled(d.llmEnabled)).catch(() => {});
  }, []);

  return (
    <div className="page-container pb-24">
      {/* ── Hero ── */}
      <section className="pt-8 pb-16 md:pt-16 md:pb-24">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="hero-badge mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animation: "pulse-dot 2s ease-in-out infinite" }} />
              AI 求职竞争力工作台
              {llmEnabled && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                  LIVE
                </span>
              )}
            </div>

            <h1 className="hero-title mb-6 max-w-3xl">
              把简历打磨成亮点，
              <br />
              <AnimatedGradientText text="把面试练成胜势" className="font-display font-black text-4xl md:text-5xl lg:text-[3.5rem] tracking-tight" />
            </h1>

            <p className="page-subtitle max-w-2xl mb-9 text-base md:text-[1.05rem] leading-relaxed">
              职赢AI 聚合简历诊断、JD 匹配、STAR 改写、专业排版美化与全真模拟面试，
              用一套流程帮你从「能投」走到「能赢」。
            </p>

            <motion.div
              className="flex flex-col sm:flex-row gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link to="/resume" className="btn-primary-lg group">
                开始优化简历
                <ArrowRightIcon size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/interview"
                className="btn-secondary !py-3.5 !px-7 !text-base !rounded-[0.9rem] group"
              >
                <MicIcon size={18} />
                进入模拟面试
              </Link>
              <Link
                to="/guest"
                className="px-5 py-3.5 rounded-[0.9rem] text-sm font-semibold border border-brand-300 text-brand-700 bg-brand-50/60 hover:bg-brand-100/80 transition-all flex items-center justify-center gap-1.5"
              >
                <span>⚡</span> 免登录体检(1次)
              </Link>
            </motion.div>

            {!llmEnabled && (
              <motion.p
                className="mt-6 text-sm tag tag-warning inline-flex items-center gap-1.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                <BrainIcon size={14} />
                大模型未配置，当前部分能力将使用规则降级 · 配置后启用完整 AI
              </motion.p>
            )}

            <motion.div
              className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-ink-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
            >
              <div className="flex items-center gap-1.5">
                <CheckIcon size={14} className="text-emerald-600" /> 无需注册即可体验
              </div>
              <div className="flex items-center gap-1.5">
                <CheckIcon size={14} className="text-emerald-600" /> PDF / Word / TXT 全格式
              </div>
              <div className="flex items-center gap-1.5">
                <CheckIcon size={14} className="text-emerald-600" /> 隐私本地处理
              </div>
            </motion.div>
          </motion.div>

          {/* Hero card */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="absolute -inset-4 bg-gradient-to-tr from-emerald-200/40 via-amber-100/20 to-violet-100/40 blur-2xl rounded-[2rem]" />
            <div className="glass-card p-6 md:p-7 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-emerald-100 to-transparent rounded-bl-full opacity-70" />

              <div className="flex items-center gap-2 mb-3">
                <GaugeIcon size={16} className="text-emerald-600" />
                <p className="section-label !mb-0">今日推荐流程</p>
              </div>

              <ol className="space-y-4 text-sm">
                {[
                  { step: "上传简历并填写目标岗位", detail: "获取评分、问题诊断与关键词缺口", Icon: ResumeIcon },
                  { step: "一键 AI 美化与强化", detail: "套用专业模板，优化表达与成果量化", Icon: SparkleIcon },
                  { step: "针对岗位开启模拟面试", detail: "实战追问 + 复盘报告，针对性补强", Icon: TargetIcon },
                ].map((s, idx) => (
                  <li key={s.step} className="flex gap-3 items-start">
                    <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-bold inline-flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-emerald-500/30">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-ink">{s.step}</p>
                      <p className="text-ink-muted mt-0.5">{s.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-6 pt-5 border-t border-border flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-ink-faint">已支持导出</p>
                  <p className="font-semibold text-ink text-sm">精美 PDF · 5 款专业模板</p>
                </div>
                <Link
                  to="/resume"
                  className="btn-primary !py-2 !px-3.5 text-xs inline-flex items-center gap-1"
                >
                  去体验 <ArrowRightIcon size={12} />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Social proof metrics ── */}
      <Reveal>
        <div className="glass-card grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border overflow-hidden">
          {METRICS.map(({ Icon, value, label }) => (
            <div key={label} className="stat-card group">
              <Icon size={20} className="mx-auto mb-2 text-emerald-600 opacity-70 group-hover:opacity-100 transition-opacity" />
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ── Features ── */}
      <section className="mt-20">
        <Reveal>
          <div className="flex items-end justify-between gap-4 mb-10">
            <div>
              <p className="section-label mb-2">核心能力</p>
              <h2 className="font-display text-2xl md:text-3xl font-extrabold text-ink">
                为求职结果而设计的 AI 工作流
              </h2>
            </div>
            <Link to="/pricing" className="hidden sm:inline-flex btn-secondary !py-2.5 !px-4 text-sm items-center gap-1">
              查看会员权益 <ArrowRightIcon size={14} />
            </Link>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map((item, i) => {
            const Icon = item.Icon;
            return (
              <Reveal key={item.title} delay={i * 0.1}>
                <HoverCard>
                  <Link
                    to={item.to}
                    className="glass-card glass-card-interactive p-7 block group h-full"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-11 h-11 rounded-xl border flex items-center justify-center bg-gradient-to-br ${item.color}`}>
                        <Icon size={22} className="text-emerald-700" />
                      </div>
                      <span className="tag tag-success">{item.tag}</span>
                    </div>
                    <h3 className="font-display font-bold text-xl mb-2.5 text-ink group-hover:text-emerald-700 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-ink-muted text-sm leading-relaxed">{item.desc}</p>
                    <p className="mt-5 text-sm font-bold text-emerald-700 inline-flex items-center gap-1">
                      立即体验
                      <ArrowRightIcon
                        size={14}
                        className="group-hover:translate-x-0.5 transition-transform"
                      />
                    </p>
                  </Link>
                </HoverCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── Interview roles preview ── */}
      <section className="mt-20">
        <Reveal>
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <p className="section-label mb-2">4 类 AI 面试官</p>
              <h2 className="font-display text-2xl md:text-3xl font-extrabold text-ink">
                覆盖真实面试的每一个关键角色
              </h2>
            </div>
            <Link to="/interview" className="hidden sm:inline-flex btn-secondary !py-2.5 !px-4 text-sm items-center gap-1">
              查看全部 <ArrowRightIcon size={14} />
            </Link>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ROLES.map((role, i) => (
            <Reveal key={role.name} delay={i * 0.08}>
              <HoverCard>
                <div className="glass-card p-5 h-full cursor-pointer group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    {i === 0 && <UsersIcon size={18} className="text-emerald-700" />}
                    {i === 1 && <BrainIcon size={18} className="text-emerald-700" />}
                    {i === 2 && <FlameIcon size={18} className="text-emerald-700" />}
                    {i === 3 && <MicIcon size={18} className="text-emerald-700" />}
                  </div>
                  <h3 className="font-display font-bold text-base mb-1.5 text-ink">{role.name}</h3>
                  <p className="text-ink-muted text-xs leading-relaxed">{role.desc}</p>
                </div>
              </HoverCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Enterprise CTA ── */}
      <section className="mt-20">
        <Reveal>
          <div className="glass-card-dark p-8 md:p-11 flex flex-col md:flex-row items-center justify-between gap-7 overflow-hidden relative">
            <div className="absolute -right-10 -bottom-10 w-56 h-56 rounded-full bg-emerald-400/10 blur-2xl" />
            <div className="absolute top-4 right-6 text-[10rem] font-display opacity-5 font-black leading-none select-none">名企</div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <BuildingIcon size={16} className="text-amber-300" />
                <p className="section-label !text-amber-300">名企专项特训</p>
              </div>
              <h2 className="font-display text-2xl md:text-3xl font-extrabold mb-2.5">
                字节 · 阿里 · 腾讯 · 华为 等目标企业突击
              </h2>
              <p className="text-slate-300 text-sm md:text-[0.95rem] max-w-xl leading-relaxed">
                结合企业风格题库与 AI 追问，进行高强度专项演练。适合冲刺面试前的临场提升与表达打磨。
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {ENTERPRISES.map((e) => (
                  <span key={e} className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-white/70 border border-white/10">
                    {e}
                  </span>
                ))}
              </div>
            </div>
            <Link to="/enterprise" className="btn-accent shrink-0 !px-8 !py-3.5 relative z-10 inline-flex items-center gap-1.5">
              <RocketIcon size={16} />
              探索名企包
              <ArrowRightIcon size={14} />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── Testimonials ── */}
      <section className="mt-20">
        <Reveal>
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <p className="section-label mb-2">用户反馈</p>
              <h2 className="font-display text-2xl md:text-3xl font-extrabold text-ink">
                看看真实求职者怎么说
              </h2>
            </div>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.1}>
              <HoverCard>
                <div className="glass-card p-6 h-full">
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <span key={s} className={s < Math.round(t.score / 2) ? "text-amber-500" : "text-slate-200"}>★</span>
                    ))}
                  </div>
                  <p className="text-ink text-sm leading-relaxed mb-5">「{t.quote}」</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-border">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-200 to-teal-300 flex items-center justify-center font-display font-bold text-emerald-800">
                      {t.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-ink">{t.name}</p>
                      <p className="text-xs text-ink-muted truncate">{t.role}</p>
                    </div>
                  </div>
                </div>
              </HoverCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="mt-20">
        <Reveal>
          <div className="glass-card p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 via-transparent to-amber-50/30 pointer-events-none" />
            <div className="relative z-10 max-w-2xl mx-auto">
              <TrendUpIcon size={32} className="mx-auto mb-4 text-emerald-600" />
              <h2 className="font-display text-2xl md:text-3xl font-extrabold text-ink mb-3">
                准备好拿下下一个 offer 了吗？
              </h2>
              <p className="text-ink-muted text-sm md:text-base mb-7 leading-relaxed">
                从简历优化到面试实战，一套 AI 工作流帮你系统提升求职竞争力。
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/resume" className="btn-primary-lg inline-flex items-center justify-center gap-2">
                  <SparkleIcon size={18} />
                  开始简历优化
                </Link>
                <Link to="/interview" className="btn-secondary !py-3.5 !px-7 !text-base !rounded-[0.9rem] inline-flex items-center justify-center gap-2">
                  <MicIcon size={18} />
                  开启模拟面试
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}