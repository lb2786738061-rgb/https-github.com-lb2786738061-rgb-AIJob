import type { TokenUsage } from "../../../api/client";
import { COLOR_THEMES, TEMPLATE_OPTIONS } from "../types";
import type { DensityOption, FontSizeOption, TemplateId } from "../types";

export function TokenUsageBadge({
  source,
  tokenUsage,
}: {
  source?: "llm" | "rule_based";
  tokenUsage?: TokenUsage | null;
}) {
  if (source === "rule_based") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
        规则降级 · 未消耗 token
      </span>
    );
  }
  if (!tokenUsage?.totalTokens) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-800 bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1">
      大模型 · 本次 {tokenUsage.totalTokens} tokens（输入 {tokenUsage.promptTokens} / 输出{" "}
      {tokenUsage.completionTokens}）
    </span>
  );
}

interface EditorToolbarProps {
  // AI 状态
  beautifying: boolean;
  beautifyMeta: { source: "llm" | "rule_based"; tokenUsage: TokenUsage | null; improvements: string[] } | null;
  resumeId?: number;
  onAiBeautify: () => void;

  // 布局状态
  selectedTemplate: TemplateId;
  setSelectedTemplate: (id: TemplateId) => void;
  selectedThemeColor: string;
  setSelectedThemeColor: (color: string) => void;
  selectedFontSize: FontSizeOption;
  setSelectedFontSize: (size: FontSizeOption) => void;
  selectedDensity: DensityOption;
  setSelectedDensity: (density: DensityOption) => void;
}

function TemplateThumb({ id, active }: { id: TemplateId; active: boolean }) {
  const ink = active ? "#1d4ed8" : "#94a3b8";
  return (
    <div
      aria-hidden="true"
      className="h-[54px] rounded-md overflow-hidden mb-2 border"
      style={{
        background: "#f8fafc",
        borderColor: active ? "#bfdbfe" : "#e5e7eb",
      }}
    >
      {id === "classic" && (
        <>
          <div style={{ height: "7px", background: ink, margin: "8px 16px 0", opacity: 0.9 }} />
          <div style={{ height: "3px", background: ink, margin: "6px 22px 0", opacity: 0.35 }} />
          <div style={{ height: "2px", background: ink, margin: "8px 10px 0", opacity: 0.2 }} />
          <div style={{ height: "2px", background: ink, margin: "4px 10px 0", opacity: 0.2 }} />
        </>
      )}
      {id === "modern" && (
        <div style={{ display: "flex", height: "100%" }}>
          <div style={{ width: "34%", background: ink }} />
          <div style={{ flex: 1, padding: "8px 6px" }}>
            <div style={{ height: "3px", background: ink, width: "70%", opacity: 0.35 }} />
            <div style={{ height: "2px", background: ink, marginTop: "6px", opacity: 0.18 }} />
            <div style={{ height: "2px", background: ink, marginTop: "4px", opacity: 0.18 }} />
          </div>
        </div>
      )}
      {id === "minimal" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 8px 0" }}>
            <div style={{ width: "38%", height: "8px", background: ink, opacity: 0.7 }} />
            <div style={{ width: "28%", height: "4px", background: ink, opacity: 0.25, marginTop: "4px" }} />
          </div>
          <div style={{ height: "1px", background: ink, margin: "8px 8px 0", opacity: 0.2 }} />
          <div style={{ height: "2px", background: ink, margin: "8px 8px 0", opacity: 0.16 }} />
        </>
      )}
      {id === "timeline" && (
        <div style={{ display: "flex", gap: "6px", padding: "8px", height: "100%", boxSizing: "border-box" }}>
          <div style={{ width: "4px", background: ink, borderRadius: "2px" }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", border: `2px solid ${ink}` }} />
              <div style={{ flex: 1, height: "3px", background: ink, opacity: 0.25, marginTop: "3px" }} />
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", border: `2px solid ${ink}`, opacity: 0.5 }} />
              <div style={{ flex: 1, height: "3px", background: ink, opacity: 0.18, marginTop: "3px" }} />
            </div>
          </div>
        </div>
      )}
      {id === "grid" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", height: "100%", padding: "8px", gap: "6px", boxSizing: "border-box" }}>
          <div>
            <div style={{ height: "3px", background: ink, opacity: 0.45 }} />
            <div style={{ height: "2px", background: ink, marginTop: "6px", opacity: 0.2 }} />
          </div>
          <div style={{ background: ink, opacity: 0.25 }} />
          <div>
            <div style={{ height: "3px", background: ink, opacity: 0.45 }} />
            <div style={{ height: "2px", background: ink, marginTop: "6px", opacity: 0.2 }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function EditorToolbar({
  beautifying,
  beautifyMeta,
  resumeId,
  onAiBeautify,
  selectedTemplate,
  setSelectedTemplate,
  selectedThemeColor,
  setSelectedThemeColor,
  selectedFontSize,
  setSelectedFontSize,
  selectedDensity,
  setSelectedDensity,
}: EditorToolbarProps) {
  return (
    <div className="space-y-5 bg-gradient-to-b from-white to-slate-50/60 rounded-2xl p-5 border border-slate-200/70 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/70">
        <div>
          <p className="text-sm font-bold text-ink flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-cyan-100 text-cyan-800 inline-flex items-center justify-center text-[11px]">AI</span>
            智能排版与结构优化
          </p>
          <p className="text-xs text-ink-muted mt-1">
            基于简历内容重新抽取并整理字段，套用所选模板生成更专业的版式结构（内容以当前草稿为准）。
          </p>
        </div>
        <button
          type="button"
          onClick={onAiBeautify}
          disabled={beautifying || !resumeId}
          className="btn-primary !text-xs !py-2.5 !px-4"
        >
          {beautifying ? "正在智能整理..." : "AI 一键排版优化"}
        </button>
      </div>

      {beautifyMeta && (
        <div className="space-y-2">
          <TokenUsageBadge source={beautifyMeta.source} tokenUsage={beautifyMeta.tokenUsage} />
          {beautifyMeta.improvements.length > 0 && (
            <ul className="text-xs text-ink-muted list-disc list-inside space-y-0.5">
              {beautifyMeta.improvements.slice(0, 5).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 模板选择 */}
      <div>
        <div className="flex items-center justify-between mb-2.5 gap-3">
          <label className="text-xs font-bold text-ink uppercase tracking-wider">
            选择专业模板
          </label>
          <span className="text-xs text-cyan-700 font-semibold text-right">
            {TEMPLATE_OPTIONS.find((t) => t.id === selectedTemplate)?.name} · {TEMPLATE_OPTIONS.find((t) => t.id === selectedTemplate)?.description}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          {TEMPLATE_OPTIONS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTemplate(t.id)}
              className={`p-2.5 rounded-xl text-left border transition-all group ${selectedTemplate === t.id
                ? "border-cyan-500 bg-cyan-50/60 shadow-sm ring-1 ring-cyan-200"
                : "border-border bg-white hover:border-cyan-200 hover:shadow-sm"
                }`}
            >
              <TemplateThumb id={t.id} active={selectedTemplate === t.id} />
              <div className="font-bold text-sm text-ink">{t.name}</div>
              <div className="text-[11px] text-ink-faint mt-0.5 leading-snug min-h-[2.2em]">{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 配色与排版微调 */}
      <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200/70">
        <div>
          <label className="text-xs font-bold text-ink-muted block mb-2">主题配色</label>
          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                title={theme.name}
                onClick={() => setSelectedThemeColor(theme.primary)}
                className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center border-2 ${selectedThemeColor === theme.primary
                  ? "scale-110 border-slate-700 shadow-sm ring-2 ring-cyan-100"
                  : "border-white hover:scale-105 shadow-sm"
                  }`}
                style={{ backgroundColor: theme.primary }}
              >
                {selectedThemeColor === theme.primary && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-ink-faint mt-1.5">建议与目标行业/岗位风格匹配（金融/咨询可选深蓝灰，互联网可选青蓝）</p>
        </div>

        <div>
          <label className="text-xs font-bold text-ink-muted block mb-2">字号大小</label>
          <div className="flex rounded-xl bg-white p-1 border border-slate-200 shadow-sm">
            {(
              [
                { id: "small", label: "紧凑" },
                { id: "normal", label: "标准" },
                { id: "large", label: "醒目" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedFontSize(item.id)}
                className={`flex-1 py-1.5 text-xs rounded-lg font-semibold transition-all ${selectedFontSize === item.id
                  ? "bg-cyan-700 text-white shadow-sm"
                  : "text-ink-muted hover:text-ink hover:bg-slate-50"
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-ink-muted block mb-2">排版密度</label>
          <div className="flex rounded-xl bg-white p-1 border border-slate-200 shadow-sm">
            {(
              [
                { id: "compact", label: "高密度" },
                { id: "normal", label: "平衡" },
                { id: "relaxed", label: "舒展" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedDensity(item.id)}
                className={`flex-1 py-1.5 text-xs rounded-lg font-semibold transition-all ${selectedDensity === item.id
                  ? "bg-cyan-700 text-white shadow-sm"
                  : "text-ink-muted hover:text-ink hover:bg-slate-50"
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

