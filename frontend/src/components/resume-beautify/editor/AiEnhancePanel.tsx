import type { EnhanceResumeResult, ParsedResume } from "../../../api/client";
import { TokenUsageBadge } from "./EditorToolbar";
import { SparkleIcon, TargetIcon, CrownIcon, CheckIcon, WandIcon } from "../../Icons";

interface AiEnhancePanelProps {
  parsed: ParsedResume;
  enhancing: boolean;
  enhanceResult: EnhanceResumeResult | null;
  selectedDiffSection: "experience" | "summary" | "skills";
  applying: boolean;
  onTriggerEnhance: (mode: "quantify" | "jd_tailor" | "comprehensive") => void;
  onApplyEnhanced: () => void;
  onDiscardEnhanced: () => void;
  setSelectedDiffSection: (section: "experience" | "summary" | "skills") => void;
}

export default function AiEnhancePanel({
  parsed,
  enhancing,
  enhanceResult,
  selectedDiffSection,
  applying,
  onTriggerEnhance,
  onApplyEnhanced,
  onDiscardEnhanced,
  setSelectedDiffSection,
}: AiEnhancePanelProps) {
  return (
    <div className="space-y-5 bg-gradient-to-br from-cyan-50/50 via-white to-slate-50/60 rounded-2xl p-5 border border-cyan-100/70 shadow-sm">
      {/* 强化动作选择卡片 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold text-cyan-900 uppercase tracking-wider flex items-center gap-1.5">
            <SparkleIcon size={14} className="text-cyan-700" /> 选择 AI 强化策略
          </label>
          {enhancing && (
            <span className="text-xs text-cyan-700 font-semibold animate-pulse">
              正在进行智能优化与内容增强...
            </span>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {/* 策略 1: 量化强化 */}
          <div className="bg-white rounded-xl p-4 border border-brand-100 flex flex-col justify-between space-y-3 hover:border-brand-400 transition-all shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                  %
                </span>
                <h3 className="font-bold text-sm text-ink">量化成果强化</h3>
              </div>
              <p className="text-xs text-ink-muted mt-2 leading-relaxed">
                全面重构工作与项目经历，注入增长百分比、效率提升、交付规模等具体业务量化指标。
              </p>
            </div>
            <button
              type="button"
              onClick={() => onTriggerEnhance("quantify")}
              disabled={enhancing}
              className="btn-secondary !text-xs !py-1.5 w-full font-semibold"
            >
              {enhancing ? "强化处理中..." : "启动量化强化"}
            </button>
          </div>

          {/* 策略 2: 岗位定向强化 */}
          <div className="bg-white rounded-xl p-4 border border-brand-100 flex flex-col justify-between space-y-3 hover:border-brand-400 transition-all shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <TargetIcon size={14} />
                </span>
                <h3 className="font-bold text-sm text-ink">岗位定向对齐</h3>
              </div>
              <p className="text-xs text-ink-muted mt-2 leading-relaxed">
                对齐目标岗位要求与职位描述（JD），精准嵌入高频技能词与硬核关键字，拉高过筛率。
              </p>
            </div>
            <button
              type="button"
              onClick={() => onTriggerEnhance("jd_tailor")}
              disabled={enhancing}
              className="btn-secondary !text-xs !py-1.5 w-full font-semibold"
            >
              {enhancing ? "强化处理中..." : "对齐目标岗位"}
            </button>
          </div>

          {/* 策略 3: 全维金牌重塑 */}
          <div className="bg-white rounded-xl p-4 border border-brand-200 bg-gradient-to-b from-white to-brand-50/30 flex flex-col justify-between space-y-3 hover:border-brand-500 transition-all shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <CrownIcon size={14} />
                </span>
                <h3 className="font-bold text-sm text-brand-900">全维金牌重塑</h3>
              </div>
              <p className="text-xs text-ink-muted mt-2 leading-relaxed">
                重构高说服力个人简介，经历全面应用黄金 STAR 框架改写，梳理出结构严密的专业技能体系。
              </p>
            </div>
            <button
              type="button"
              onClick={() => onTriggerEnhance("comprehensive")}
              disabled={enhancing}
              className="btn-primary !text-xs !py-1.5 w-full font-semibold"
            >
              {enhancing ? "强化处理中..." : "一键全维重塑"}
            </button>
          </div>
        </div>
      </div>

      {/* 强化结果比对展示区 */}
      {enhanceResult && (
        <div className="mt-4 pt-4 border-t border-brand-100 space-y-4">
          <TokenUsageBadge
            source={enhanceResult.source}
            tokenUsage={enhanceResult.tokenUsage}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200">
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold">
              <CheckIcon size={14} />
              <span>AI 强化完成！已提炼出多项核心亮点，请对比后决定是否采纳。</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onDiscardEnhanced}
                className="btn-ghost !text-xs !py-1 !px-2.5 text-ink-muted hover:text-ink"
              >
                放弃改动
              </button>
              <button
                type="button"
                onClick={onApplyEnhanced}
                disabled={applying}
                className="btn-primary !text-xs !py-1.5 !px-3.5 shadow-sm bg-emerald-600 hover:bg-emerald-700 border-emerald-600 inline-flex items-center gap-1.5"
              >
                {applying ? "应用中..." : (
                  <>
                    <WandIcon size={12} />
                    采纳并应用到简历排版
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 改进亮点清单 */}
          {enhanceResult.improvements?.length > 0 && (
            <div className="bg-white/80 p-3.5 rounded-xl border border-brand-100">
              <h4 className="text-xs font-bold text-brand-900 mb-2">本次强化核心改进点：</h4>
              <ul className="grid sm:grid-cols-2 gap-2 text-xs text-ink-muted">
                {enhanceResult.improvements.map((imp, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">●</span>
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 强化前后对比视窗 */}
          <div className="bg-white rounded-xl p-4 border border-brand-100 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
              <span className="text-xs font-bold text-ink">强化前后内容对照</span>
              <div className="flex gap-1 bg-brand-50 p-0.5 rounded-lg text-xs">
                {(
                  [
                    { key: "experience", label: "工作经历" },
                    { key: "summary", label: "个人简介" },
                    { key: "skills", label: "专业技能" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSelectedDiffSection(tab.key)}
                    className={`px-2.5 py-1 rounded-md transition-all ${selectedDiffSection === tab.key
                      ? "bg-white font-semibold text-brand-700 shadow-xs"
                      : "text-ink-muted"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              {/* 原版内容 */}
              <div className="space-y-2 bg-gray-50/70 p-3 rounded-lg border border-gray-100">
                <div className="font-semibold text-gray-500">【强化前·原版】</div>
                {selectedDiffSection === "experience" && (
                  <ul className="space-y-1.5 list-disc list-inside text-gray-600 leading-relaxed">
                    {(parsed.sections.experience?.length ?? 0) > 0 ? (
                      parsed.sections.experience!.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))
                    ) : (
                      <li className="text-gray-400">（暂无数据）</li>
                    )}
                  </ul>
                )}
                {selectedDiffSection === "summary" && (
                  <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                    {parsed.sections.summary || "（未填写个人简介）"}
                  </p>
                )}
                {selectedDiffSection === "skills" && (
                  <ul className="space-y-1 text-gray-600">
                    {(parsed.sections.skills?.length ?? 0) > 0 ? (
                      parsed.sections.skills!.map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))
                    ) : (
                      <li className="text-gray-400">（暂无技能）</li>
                    )}
                  </ul>
                )}
              </div>

              {/* 强化后内容 */}
              <div className="space-y-2 bg-emerald-50/40 p-3 rounded-lg border border-emerald-200/60">
                <div className="font-semibold text-emerald-800 flex items-center justify-between">
                  <span>【强化后·高光版】</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                    成果量化 & 动词强化
                  </span>
                </div>
                {selectedDiffSection === "experience" && (
                  <ul className="space-y-1.5 list-disc list-inside text-emerald-950 font-medium leading-relaxed">
                    {(enhanceResult.enhancedSections.experience?.length ?? 0) > 0 ? (
                      enhanceResult.enhancedSections.experience!.map((item, i) => (
                        <li key={i} className="bg-white/60 p-1.5 rounded border border-emerald-100">
                          {item}
                        </li>
                      ))
                    ) : (
                      <li className="text-emerald-700/70">（暂无数据）</li>
                    )}
                  </ul>
                )}
                {selectedDiffSection === "summary" && (
                  <p className="text-emerald-950 leading-relaxed whitespace-pre-line bg-white/60 p-2 rounded border border-emerald-100 font-medium">
                    {enhanceResult.enhancedSections.summary || "（暂无数据）"}
                  </p>
                )}
                {selectedDiffSection === "skills" && (
                  <ul className="space-y-1 text-emerald-950 font-medium">
                    {(enhanceResult.enhancedSections.skills?.length ?? 0) > 0 ? (
                      enhanceResult.enhancedSections.skills!.map((item, i) => (
                        <li key={i} className="inline-block bg-white px-2 py-1 rounded border border-emerald-200 mr-1 mb-1">
                          ✓ {item}
                        </li>
                      ))
                    ) : (
                      <li className="text-emerald-700/70">（暂无技能）</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}