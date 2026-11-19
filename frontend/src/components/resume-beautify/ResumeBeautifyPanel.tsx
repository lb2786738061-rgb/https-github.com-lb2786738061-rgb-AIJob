import { useState } from "react";
import { api, type ParsedResume } from "../../api/client";
import { exportResumePdf } from "./exportPdf";
import { useToast } from "../Toast";
import { useResumeEditor } from "./editor/useResumeEditor";
import EditorToolbar from "./editor/EditorToolbar";
import AiEnhancePanel from "./editor/AiEnhancePanel";
import ResumePreviewArea from "./editor/ResumePreviewArea";

interface ResumeBeautifyPanelProps {
  parsed: ParsedResume;
  resumeTitle: string;
  targetJobTitle?: string | null;
  resumeId?: number;
  originalFileName?: string | null;
  fileMimeType?: string | null;
  hasStoredFile?: boolean;
  jobDescription?: string;
  embedded?: boolean;
  onEnterBeautify?: () => void;
  onApplyEnhanced?: (newParsed: ParsedResume) => Promise<void> | void;
}

const LIST_SECTIONS: Array<{
  key: "experience" | "projects" | "education" | "skills" | "awards";
  label: string;
}> = [
  { key: "experience", label: "工作经历" },
  { key: "projects", label: "项目经历" },
  { key: "education", label: "教育背景" },
  { key: "skills", label: "专业技能" },
  { key: "awards", label: "荣誉奖项" },
];

export default function ResumeBeautifyPanel({
  parsed,
  resumeTitle,
  targetJobTitle,
  resumeId,
  jobDescription,
  embedded = false,
  onEnterBeautify,
  onApplyEnhanced,
}: ResumeBeautifyPanelProps) {
  const { toast } = useToast();
  const editor = useResumeEditor(parsed);
  const [showLiveEditor, setShowLiveEditor] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  // 导出超清 PDF
  async function handleExportPdf() {
    if (!editor.refs.previewRef.current || editor.exportState.exporting) return;
    editor.exportState.setExporting(true);
    try {
      const page = editor.refs.previewRef.current.querySelector(".resume-page") as HTMLElement | null;
      if (!page) throw new Error("预览排版区域未就绪");
      const safeName = resumeTitle.replace(/[^\w\u4e00-\u9fff-]+/g, "_") || "简历";
      await exportResumePdf(page, `${safeName}-精美强化版.pdf`);
      toast("PDF 导出成功，已开始下载", "success");
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : "PDF 导出失败，请重试", "error");
    } finally {
      editor.exportState.setExporting(false);
    }
  }

  // 保存实时微调草稿
  async function handleSaveLiveDraft() {
    if (!onApplyEnhanced) return;
    setSavingDraft(true);
    try {
      await onApplyEnhanced(editor.draft);
      toast("微调内容已同步保存", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "保存失败，请重试", "error");
    } finally {
      setSavingDraft(false);
    }
  }

  // AI 智能排版
  async function handleAiBeautify() {
    if (!resumeId) {
      toast("请先上传或保存简历后再使用 AI 美化", "info");
      return;
    }
    editor.ai.setBeautifying(true);
    editor.ai.setBeautifyMeta(null);
    try {
      const res = await api.beautifyResume(resumeId, {
        templateId: editor.layout.selectedTemplate,
        targetJobTitle: targetJobTitle || undefined,
        jobDescription: jobDescription || undefined,
        parsed: editor.draft,
      });
      editor.actions.applyBeautifyResult(res);
      if (onApplyEnhanced) {
        await onApplyEnhanced(res.parsed);
      }
      onEnterBeautify?.();
      if (res.source === "rule_based") {
        toast("大模型不可用，已使用规则整理", "error");
      } else {
        toast("AI 美化完成，已更新模板预览", "success");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "AI 美化失败", "error");
    } finally {
      editor.ai.setBeautifying(false);
    }
  }

  // AI 智能强化
  async function handleTriggerEnhance(mode: "quantify" | "jd_tailor" | "comprehensive") {
    if (!resumeId) {
      toast("请先上传或保存简历后再使用强化功能", "info");
      return;
    }
    editor.ai.setEnhancing(true);
    try {
      const res = await api.enhanceResume(resumeId, {
        mode,
        targetJobTitle: targetJobTitle || undefined,
        jobDescription: jobDescription || undefined,
        parsed: editor.draft,
      });
      editor.ai.setEnhanceResult(res);
      editor.tabs.setActiveTab("enhance");
      if (res.source === "rule_based") {
        toast("大模型不可用，已使用规则增强", "error");
      } else {
        toast("AI 智能强化完成，请查看对比效果", "success");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "智能强化失败，请稍后重试", "error");
    } finally {
      editor.ai.setEnhancing(false);
    }
  }

  // 采纳强化结果
  async function handleApplyEnhanced() {
    if (!editor.ai.enhanceResult || !onApplyEnhanced) return;
    editor.ai.setApplying(true);
    try {
      const newParsed: ParsedResume = {
        ...editor.draft,
        layout: undefined,
        sections: {
          ...editor.draft.sections,
          ...editor.ai.enhanceResult.enhancedSections,
        },
      };
      editor.actions.applyEnhanceResult();
      await onApplyEnhanced(newParsed);
      toast("已成功采纳强化内容，并同步更新排版！", "success");
      editor.tabs.setActiveTab("beautify");
    } catch (err) {
      toast(err instanceof Error ? err.message : "采纳失败，请重试", "error");
    } finally {
      editor.ai.setApplying(false);
    }
  }

  return (
    <div className={embedded ? "space-y-6" : "glass-card p-6 space-y-6 animate-fade-up border border-cyan-100/60"}>
      <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 text-white text-xs font-bold shadow-sm">美</span>
            <h2 className="font-display font-extrabold text-xl text-ink">简历美化工作室</h2>
            <span className="tag tag-success">实时预览 · PDF 导出</span>
          </div>
          <p className="text-sm text-ink-muted mt-1 max-w-2xl">
            选择专业模板、调整主题配色与排版密度，支持 AI 智能排版/强化与字段微调，所见即所得导出高清简历 PDF。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-slate-100/80 p-1 rounded-xl flex gap-1 border border-slate-200">
            <button
              type="button"
              onClick={() => editor.tabs.setActiveTab("beautify")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                editor.tabs.activeTab === "beautify"
                  ? "bg-white text-cyan-800 shadow-sm"
                  : "text-ink-muted hover:text-cyan-700"
              }`}
            >
              模板与排版
            </button>
            <button
              type="button"
              onClick={() => editor.tabs.setActiveTab("enhance")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                editor.tabs.activeTab === "enhance"
                  ? "bg-white text-cyan-800 shadow-sm"
                  : "text-ink-muted hover:text-cyan-700"
              }`}
            >
              AI 智能精修
              {editor.ai.enhanceResult && (
                <span className="w-2 h-2 rounded-full bg-orange-500" />
              )}
            </button>
          </div>

          {editor.tabs.activeTab === "beautify" && (
            <>
              <button
                type="button"
                onClick={() => setShowLiveEditor((v) => !v)}
                className={`btn-secondary !text-xs !py-2 !px-3.5 ${
                  showLiveEditor ? "!bg-cyan-50 !border-cyan-300 !text-cyan-800" : ""
                }`}
              >
                {showLiveEditor ? "收起内容微调" : "编辑简历内容"}
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={editor.exportState.exporting}
                className="btn-primary !text-xs !py-2 !px-4"
              >
                {editor.exportState.exporting ? "导出中..." : "下载高清 PDF"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 选项卡内容区 */}
      {editor.tabs.activeTab === "beautify" && (
        <EditorToolbar
          beautifying={editor.ai.beautifying}
          beautifyMeta={editor.ai.beautifyMeta}
          resumeId={resumeId}
          onAiBeautify={handleAiBeautify}
          selectedTemplate={editor.layout.selectedTemplate}
          setSelectedTemplate={editor.layout.setSelectedTemplate}
          selectedThemeColor={editor.layout.selectedThemeColor}
          setSelectedThemeColor={editor.layout.setSelectedThemeColor}
          selectedFontSize={editor.layout.selectedFontSize}
          setSelectedFontSize={editor.layout.setSelectedFontSize}
          selectedDensity={editor.layout.selectedDensity}
          setSelectedDensity={editor.layout.setSelectedDensity}
        />
      )}

      {/* 实时微调编辑器 */}
      {editor.tabs.activeTab === "beautify" && showLiveEditor && (
        <div className="bg-brand-50/40 border border-brand-100 rounded-2xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-brand-100">
            <div>
              <h3 className="text-sm font-bold text-ink">实时微调简历字段</h3>
              <p className="text-xs text-ink-muted">修改下方内容将立即反映在下方 A4 预览画布中，支持调整条目顺序</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={editor.actions.resetDraft}
                className="btn-secondary !text-xs !py-1.5 !px-3"
              >
                还原修改
              </button>
              {onApplyEnhanced && (
                <button
                  type="button"
                  onClick={handleSaveLiveDraft}
                  disabled={savingDraft}
                  className="btn-primary !text-xs !py-1.5 !px-3.5"
                >
                  {savingDraft ? "保存中..." : "保存微调结果"}
                </button>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="form-label !text-xs">联系方式 / 头部信息</label>
              <textarea
                rows={3}
                value={editor.draft.sections.contact ?? ""}
                onChange={(e) => editor.actions.updateSection("contact", e.target.value)}
                className="textarea-field !text-xs"
              />
            </div>
            <div>
              <label className="form-label !text-xs">个人简介 / 个人优势</label>
              <textarea
                rows={3}
                value={editor.draft.sections.summary ?? ""}
                onChange={(e) => editor.actions.updateSection("summary", e.target.value)}
                className="textarea-field !text-xs"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {LIST_SECTIONS.map(({ key, label }) => {
              const items = editor.draft.sections[key] ?? [];
              return (
                <div key={key} className="bg-white rounded-xl p-3 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">{label}（{items.length}）</span>
                    <button
                      type="button"
                      onClick={() => editor.actions.addListItem(key)}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                    >
                      + 新增条目
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex gap-1.5 items-start">
                        <textarea
                          rows={2}
                          value={item}
                          onChange={(e) => editor.actions.updateListItem(key, idx, e.target.value)}
                          className="textarea-field !text-xs flex-1"
                        />
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            type="button"
                            title="上移"
                            disabled={idx === 0}
                            onClick={() => editor.actions.moveListItem(key, idx, -1)}
                            className="px-1.5 py-0.5 text-xs rounded border border-border hover:bg-brand-50 disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            title="下移"
                            disabled={idx === items.length - 1}
                            onClick={() => editor.actions.moveListItem(key, idx, 1)}
                            className="px-1.5 py-0.5 text-xs rounded border border-border hover:bg-brand-50 disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            title="删除"
                            onClick={() => editor.actions.removeListItem(key, idx)}
                            className="px-1.5 py-0.5 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editor.tabs.activeTab === "enhance" && (
        <AiEnhancePanel
          parsed={editor.draft}
          enhancing={editor.ai.enhancing}
          enhanceResult={editor.ai.enhanceResult}
          selectedDiffSection={editor.ai.selectedDiffSection}
          applying={editor.ai.applying}
          onTriggerEnhance={handleTriggerEnhance}
          onApplyEnhanced={handleApplyEnhanced}
          onDiscardEnhanced={() => editor.ai.setEnhanceResult(null)}
          setSelectedDiffSection={editor.ai.setSelectedDiffSection}
        />
      )}

      {editor.tabs.activeTab === "beautify" && (
        <ResumePreviewArea
          previewScale={editor.layout.previewScale}
          setPreviewScale={editor.layout.setPreviewScale}
          parsed={editor.draft}
          resumeTitle={resumeTitle}
          targetJobTitle={targetJobTitle}
          selectedTemplate={editor.layout.selectedTemplate}
          layoutOptions={editor.layout.layoutOptions}
          previewRef={editor.refs.previewRef}
          sheetRef={editor.refs.sheetRef}
        />
      )}
    </div>
  );
}
