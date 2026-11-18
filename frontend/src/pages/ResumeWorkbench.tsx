import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type Resume,
  type StarSuggestion,
  type ParsedResume,
  type UploadResult,
} from "../api/client";
import ScoreRing from "../components/ScoreRing";
import ResumeBeautifyPanel from "../components/resume-beautify/ResumeBeautifyPanel";
import StructuredResumeView from "../components/resume-beautify/StructuredResumeView";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { SparkleIcon, TrashIcon, AlertIcon } from "../components/Icons";

function textareaRows(text: string, min = 2, max = 20): number {
  const lines = text.split("\n").filter(Boolean).length || 1;
  return Math.min(max, Math.max(min, lines + 1));
}

function applyAnalysisResult(
  data: { resume: Resume; starRewrite: { suggestions: StarSuggestion[]; summary: string }; jdMatch?: unknown },
  setters: {
    setResult: (r: Resume) => void;
    setStarSuggestions: (s: StarSuggestion[]) => void;
    setStarSummary: (s: string) => void;
    setJdMatchReport: (s: string) => void;
    setMissingKeywords: (k: string[]) => void;
    setParsedResume: (p: ParsedResume | null) => void;
  }
) {
  setters.setResult(data.resume);
  setters.setStarSuggestions(data.starRewrite.suggestions);
  setters.setStarSummary(data.starRewrite.summary);
  if (data.resume.jdMatchReport) {
    setters.setJdMatchReport(data.resume.jdMatchReport);
  } else if (data.jdMatch && typeof data.jdMatch === "object") {
    const jd = data.jdMatch as { report?: string; missingKeywords?: string[] };
    if (jd.report) setters.setJdMatchReport(jd.report);
    setters.setMissingKeywords(jd.missingKeywords ?? []);
  }
  if (data.resume.missingKeywords) {
    setters.setMissingKeywords(JSON.parse(data.resume.missingKeywords));
  }
  if (data.resume.parsedJson) {
    setters.setParsedResume(JSON.parse(data.resume.parsedJson));
  }
}

function StarEditor({
  resumeId,
  suggestion,
}: {
  resumeId: number;
  suggestion: StarSuggestion;
}) {
  const { toast } = useToast();
  const [fields, setFields] = useState(suggestion);
  const [rewritten, setRewritten] = useState(suggestion.rewritten);
  const [loading, setLoading] = useState(false);

  async function generateRewrite() {
    setLoading(true);
    try {
      const data = await api.starRewrite(resumeId, {
        original: fields.original,
        situation: fields.situation,
        task: fields.task,
        action: fields.action,
        result: fields.result,
      });
      setRewritten(data.rewritten);
      toast("STAR 重写已生成", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "生成失败", "error");
    } finally {
      setLoading(false);
    }
  }

  function copyText() {
    navigator.clipboard.writeText(rewritten);
    toast("已复制到剪贴板", "success");
  }

  return (
    <div className="p-4 bg-brand-50/50 rounded-xl text-sm space-y-3 border border-brand-100">
      <p>
        <span className="font-semibold text-ink-muted">原句：</span>
        {fields.original}
      </p>
      {(["situation", "task", "action", "result"] as const).map((key) => (
        <div key={key}>
          <label className="font-semibold text-brand-700 uppercase text-xs tracking-wide">
            {key[0].toUpperCase()}：
          </label>
          <textarea
            value={fields[key]}
            onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
            rows={2}
            className="textarea-field !text-sm mt-1"
          />
        </div>
      ))}
      <div className="flex gap-2">
        <button
          onClick={generateRewrite}
          disabled={loading}
          className="btn-primary !text-xs !py-1.5 !px-3"
        >
          {loading ? "生成中..." : "生成重写"}
        </button>
        <button onClick={copyText} className="btn-secondary !text-xs !py-1.5 !px-3">
          复制
        </button>
      </div>
      <p className="pt-3 border-t border-brand-100">
        <span className="font-semibold text-brand-800">重写：</span>
        {rewritten}
      </p>
    </div>
  );
}

function notifyAnalysisResult(data: UploadResult, llmEnabled: boolean, toast: (msg: string, type?: "success" | "error" | "info") => void) {
  if (data.analysisSource === "rule_based" && llmEnabled) {
    toast("大模型调用失败，当前结果为规则引擎估算", "error");
    return;
  }
  toast("分析完成", "success");
}

const ANALYSIS_STAGES = [
  "正在提取简历文本与章节结构…",
  "正在调用大模型进行多维度体检评分…",
  "正在比对目标岗位 JD 与缺失关键词…",
  "正在生成 STAR 法则重写建议与智能排版…",
];

export default function ResumeWorkbench() {
  const { toast } = useToast();
  const { refreshMe } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [resumeTitle, setResumeTitle] = useState("我的简历");
  const [targetJobTitle, setTargetJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzingStageIdx, setAnalyzingStageIdx] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ id: number; title: string } | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Resume | null>(null);
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [starSuggestions, setStarSuggestions] = useState<StarSuggestion[]>([]);
  const [starSummary, setStarSummary] = useState("");
  const [jdMatchReport, setJdMatchReport] = useState("");
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const [history, setHistory] = useState<Resume[]>([]);
  const [editingSections, setEditingSections] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [llmEnabled, setLlmEnabled] = useState(true);

  const setters = {
    setResult,
    setStarSuggestions,
    setStarSummary,
    setJdMatchReport,
    setMissingKeywords,
    setParsedResume,
  };

  useEffect(() => {
    api.getResumes().then(setHistory).catch(() => { });
    api.getHealth().then((d) => setLlmEnabled(d.llmEnabled)).catch(() => setLlmEnabled(false));
  }, []);

  useEffect(() => {
    if (analyzingStageIdx === null) return;
    const timer = window.setInterval(() => {
      setAnalyzingStageIdx((prev) =>
        prev === null ? null : Math.min(prev + 1, ANALYSIS_STAGES.length - 1)
      );
    }, 3500);
    return () => window.clearInterval(timer);
  }, [analyzingStageIdx !== null]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("请选择简历文件");
      return;
    }
    setLoading(true);
    setAnalyzingStageIdx(0);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("resumeTitle", resumeTitle);
      fd.append("targetJobTitle", targetJobTitle);
      fd.append("jobDescription", jobDescription);
      const data = await api.uploadResume(fd);
      applyAnalysisResult(data, setters);
      api.getResumes().then(setHistory).catch(() => { });
      await refreshMe();
      notifyAnalysisResult(data, llmEnabled, toast);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "上传失败";
      setError(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
      setAnalyzingStageIdx(null);
    }
  }

  async function handleReAnalyze() {
    if (!result) return;
    setLoading(true);
    setAnalyzingStageIdx(1);
    setError("");
    try {
      const data = await api.analyzeResume(result.id, { jobDescription, targetJobTitle });
      applyAnalysisResult(data, setters);
      api.getResumes().then(setHistory).catch(() => { });
      await refreshMe();
      notifyAnalysisResult(data, llmEnabled, toast);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "分析失败";
      toast(msg, "error");
    } finally {
      setLoading(false);
      setAnalyzingStageIdx(null);
    }
  }

  function requestDeleteResume(id: number, title: string, e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmDeleteTarget({ id, title });
  }

  async function confirmDeleteResume() {
    if (!confirmDeleteTarget) return;
    const { id } = confirmDeleteTarget;
    setDeletingId(id);
    try {
      await api.deleteResume(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      if (result?.id === id) {
        setResult(null);
        setParsedResume(null);
        setStarSuggestions([]);
        setStarSummary("");
        setJdMatchReport("");
        setMissingKeywords([]);
      }
      toast("简历已删除", "success");
      setConfirmDeleteTarget(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "删除失败", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function loadResume(id: number) {
    setLoading(true);
    try {
      const resume = await api.getResume(id);
      setResult(resume);
      setJdMatchReport(resume.jdMatchReport ?? "");
      if (resume.starSuggestions) {
        const star = JSON.parse(resume.starSuggestions);
        setStarSuggestions(star.suggestions ?? []);
        setStarSummary(star.summary ?? "");
      }
      if (resume.missingKeywords) {
        setMissingKeywords(JSON.parse(resume.missingKeywords));
      }
      if (resume.parsedJson) {
        setParsedResume(JSON.parse(resume.parsedJson));
      }
      setJobDescription(resume.jobDescription ?? "");
      setTargetJobTitle(resume.targetJobTitle ?? "");
      setResumeTitle(resume.resumeTitle);
    } catch (err) {
      toast(err instanceof Error ? err.message : "加载失败", "error");
    } finally {
      setLoading(false);
    }
  }

  async function saveParsedResume() {
    if (!result || !parsedResume) return;
    setLoading(true);
    try {
      const updated = await api.patchResume(result.id, { parsedJson: parsedResume });
      setResult(updated);
      toast("简历已保存", "success");
      setEditingSections(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "保存失败", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container pb-12">
      <div className="mb-8 animate-fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-label mb-2">简历智能工作台</p>
            <h1 className="page-title">诊断 · 优化 · 美化导出，一步到位</h1>
            <p className="page-subtitle mt-2 max-w-2xl">
              上传简历并填写目标岗位与 JD，获取多维评分、匹配分析、STAR 改写，并使用专业模板实时美化导出 PDF。
            </p>
          </div>
          {result && (
            <div className="flex flex-wrap gap-2">
              <Link to={`/interview?resumeId=${result.id}`} className="btn-secondary !text-sm">
                用此简历去面试
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 resume-workbench-grid">
        <div className="lg:col-span-1 space-y-4">
          <form onSubmit={handleUpload} className="glass-card p-6 space-y-4 animate-fade-up animate-fade-up-delay-1 lg:sticky lg:top-[5.5rem]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-[0.14em] uppercase text-cyan-700">上传与分析</p>
                <h2 className="font-display font-bold text-lg text-ink mt-0.5">创建/更新简历诊断</h2>
              </div>
            </div>
            <div>
              <label className="form-label">简历名称</label>
              <input
                value={resumeTitle}
                onChange={(e) => setResumeTitle(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="form-label">目标岗位</label>
              <input
                value={targetJobTitle}
                onChange={(e) => setTargetJobTitle(e.target.value)}
                placeholder="如：高级前端工程师 / 产品经理"
                className="input-field"
              />
            </div>
            <div>
              <label className="form-label">职位描述 (JD)</label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={5}
                placeholder="粘贴目标岗位 JD，匹配度与优化建议会更准确..."
                className="textarea-field"
              />
            </div>
            <div className="rounded-xl border border-dashed border-cyan-200 bg-cyan-50/30 p-3.5">
              <label className="form-label !mb-1.5">上传简历文件</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-ink-muted file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:bg-cyan-700 file:text-white file:font-semibold file:text-xs hover:file:bg-cyan-800 cursor-pointer"
              />
              <p className="text-xs text-ink-faint mt-2">支持 PDF / Word / TXT · 最大 10MB · 上传后可继续美化与导出</p>
            </div>
            {!llmEnabled && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-relaxed">
                大模型未配置，AI 分析/美化/强化将不可用或降级。请在 <code className="font-semibold">backend/.env</code> 配置 <code className="font-semibold">OPENAI_API_KEY</code> 后重启后端。
              </p>
            )}
            {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
            {analyzingStageIdx !== null && (
              <div className="rounded-xl bg-cyan-50/70 border border-cyan-200 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-cyan-900">
                  <span>{ANALYSIS_STAGES[analyzingStageIdx]}</span>
                  <span>{analyzingStageIdx + 1}/{ANALYSIS_STAGES.length}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-cyan-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-sky-600 rounded-full transition-all duration-500"
                    style={{ width: `${((analyzingStageIdx + 1) / ANALYSIS_STAGES.length) * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-cyan-800/80">通常需要数秒到数十秒，取决于简历长度与模型响应速度。</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !llmEnabled}
              className="btn-primary btn-full !py-3"
            >
              {loading ? "分析中..." : "上传并开始分析"}
            </button>
            {result && (
              <button
                type="button"
                onClick={handleReAnalyze}
                disabled={loading || !llmEnabled}
                className="btn-secondary btn-full"
              >
                基于当前 JD 重新分析
              </button>
            )}
          </form>

          {history.length > 0 && (
            <div className="glass-card p-4">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <h3 className="font-display font-bold text-sm text-ink">历史简历</h3>
                <span className="text-xs text-ink-faint">{history.length} 份</span>
              </div>
              <ul className="space-y-1.5">
                {history.map((r) => (
                  <li
                    key={r.id}
                    className={`flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 transition-colors border ${
                      result?.id === r.id ? "bg-cyan-50/70 border-cyan-200" : "hover:bg-slate-50 border-transparent"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => loadResume(r.id)}
                      className="flex-1 text-left px-1.5 py-1.5 text-sm truncate text-ink-muted hover:text-ink min-w-0"
                    >
                      <span className={`block truncate ${result?.id === r.id ? "font-semibold text-cyan-900" : ""}`}>
                        {r.resumeTitle}
                      </span>
                      <span className="text-[11px] text-ink-faint">
                        {r.targetJobTitle ? `目标：${r.targetJobTitle}` : "未设置目标岗位"}
                        {r.scoreOverall != null ? ` · ${r.scoreOverall}分` : ""}
                      </span>
                    </button>
                    <button
                      type="button"
                      title="删除该简历"
                      disabled={deletingId === r.id}
                      onClick={(e) => requestDeleteResume(r.id, r.resumeTitle, e)}
                      className="px-2 py-1 text-xs rounded-lg text-ink-faint hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 disabled:opacity-40"
                    >
                      {deletingId === r.id ? "..." : "删除"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {result ? (
            <>
              <div className="glass-card p-5 md:p-6 flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-cyan-500">
                <div className="min-w-0">
                  <p className="text-xs font-bold tracking-[0.14em] uppercase text-cyan-700 mb-1">分析完成</p>
                  <p className="font-display font-bold text-xl text-ink truncate">{result.resumeTitle}</p>
                  <p className="text-sm text-ink-muted mt-0.5">
                    {result.targetJobTitle ? `目标岗位：${result.targetJobTitle}` : "未设置目标岗位"}
                    {result.matchPercentage != null ? ` · JD 匹配 ${result.matchPercentage}%` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/interview?resumeId=${result.id}`} className="btn-primary !text-sm">
                    用此简历开始面试
                  </Link>
                </div>
              </div>

              <div className="glass-card p-6">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <h2 className="font-display font-bold text-lg text-ink">简历体检评分</h2>
                  <span className="tag tag-success">多维诊断</span>
                </div>
                <div className="flex flex-wrap gap-6 justify-around bg-gradient-to-b from-slate-50/70 to-white rounded-2xl p-4 border border-slate-100">
                  <ScoreRing score={result.scoreOverall ?? 0} label="综合" size={104} />
                  <ScoreRing score={result.scoreClarity ?? 0} label="清晰度" />
                  <ScoreRing score={result.scoreCompetitiveness ?? 0} label="竞争力" />
                  <ScoreRing score={result.scoreProfessionalism ?? 0} label="专业度" />
                  {result.matchPercentage != null && (
                    <ScoreRing score={result.matchPercentage} label="JD匹配" />
                  )}
                </div>
              </div>

              {parsedResume && (
                <div className="glass-card p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h2 className="font-display font-bold text-ink">简历内容</h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => (editingSections ? saveParsedResume() : setEditingSections(true))}
                        className="text-sm text-brand-600 font-semibold hover:text-brand-700"
                      >
                        {editingSections ? "保存" : "编辑"}
                      </button>
                    </div>
                  </div>

                  {editingSections ? (
                    <div className="space-y-4 text-sm">
                      {(
                        [
                          { key: "contact" as const, label: "联系方式", isList: false },
                          { key: "summary" as const, label: "个人简介", isList: false },
                          { key: "experience" as const, label: "工作经历", isList: true },
                          { key: "skills" as const, label: "专业技能", isList: true },
                          { key: "education" as const, label: "教育背景", isList: true },
                          { key: "projects" as const, label: "项目经历", isList: true },
                        ] as const
                      ).map(({ key, label, isList }) => {
                        const fieldValue = isList
                          ? (parsedResume.sections[key] ?? []).join("\n")
                          : String(parsedResume.sections[key] ?? "");
                        return (
                          <div key={key}>
                            <label className="form-label">{label}</label>
                            <textarea
                              value={fieldValue}
                              onChange={(e) =>
                                setParsedResume({
                                  ...parsedResume,
                                  sections: {
                                    ...parsedResume.sections,
                                    [key]: isList
                                      ? e.target.value.split("\n").filter(Boolean)
                                      : e.target.value,
                                  },
                                })
                              }
                              rows={textareaRows(fieldValue, isList ? 3 : 2)}
                              className="textarea-field"
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <StructuredResumeView
                      parsed={parsedResume}
                      resumeTitle={result.resumeTitle}
                    />
                  )}

                  {parsedResume.rawText && (
                    <div className="mt-6 pt-6 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setShowRawText((v) => !v)}
                        className="text-sm text-brand-600 font-semibold hover:text-brand-700"
                      >
                        {showRawText ? "收起完整原文" : "查看完整原文"}
                      </button>
                      {showRawText && (
                        <pre className="mt-3 text-sm text-ink-muted whitespace-pre-wrap font-sans leading-relaxed bg-brand-50/50 p-4 rounded-xl max-h-96 overflow-auto">
                          {parsedResume.rawText}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}

              {parsedResume && (
                <div className="space-y-3">
                  <div className="glass-card p-4 border border-cyan-100 bg-gradient-to-r from-cyan-50/50 to-white">
                    <p className="text-xs font-bold tracking-[0.14em] uppercase text-cyan-700 mb-1">简历美化与导出</p>
                    <p className="text-sm text-ink-muted">
                      选择专业模板、调整配色与排版密度，使用 AI 智能排版/强化优化表达，并实时预览导出高清 PDF。
                    </p>
                  </div>
                  <ResumeBeautifyPanel
                    parsed={parsedResume}
                    resumeTitle={result.resumeTitle}
                    targetJobTitle={result.targetJobTitle}
                    resumeId={result.id}
                    originalFileName={result.originalFileName}
                    fileMimeType={result.fileMimeType}
                    hasStoredFile={Boolean(result.storedFilePath)}
                    jobDescription={jobDescription}
                    onApplyEnhanced={async (newParsed) => {
                      setParsedResume(newParsed);
                      try {
                        const updated = await api.patchResume(result.id, { parsedJson: newParsed });
                        setResult(updated);
                        api.getResumes().then(setHistory).catch(() => { });
                      } catch (err) {
                        toast(err instanceof Error ? err.message : "保存强化结果失败", "error");
                      }
                    }}
                  />
                </div>
              )}

              {result.diagnosisReport && (
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="font-display font-bold text-lg text-ink">诊断报告</h2>
                    <span className="tag tag-success">AI 体检</span>
                  </div>
                  <pre className="text-sm text-ink-muted whitespace-pre-wrap font-sans leading-relaxed bg-slate-50/80 border border-slate-200/70 p-4 rounded-xl">
                    {result.diagnosisReport}
                  </pre>
                </div>
              )}

              {(jdMatchReport || missingKeywords.length > 0) && (
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="font-display font-bold text-lg text-ink">JD 匹配分析</h2>
                    {result.matchPercentage != null && <span className="tag tag-success">匹配度 {result.matchPercentage}%</span>}
                  </div>
                  {missingKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {missingKeywords.slice(0, 15).map((k) => (
                        <span key={k} className="tag tag-danger">
                          缺失：{k}
                        </span>
                      ))}
                    </div>
                  )}
                  {jdMatchReport && (
                    <pre className="text-sm text-ink-muted whitespace-pre-wrap font-sans leading-relaxed bg-slate-50/80 border border-slate-200/70 p-4 rounded-xl">
                      {jdMatchReport}
                    </pre>
                  )}
                </div>
              )}

              {starSuggestions.length > 0 && (
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <h2 className="font-display font-bold text-lg text-ink">STAR 法则重写建议</h2>
                    <span className="tag tag-success">{starSuggestions.length} 条</span>
                  </div>
                  <p className="text-sm text-ink-muted mb-5">{starSummary}</p>
                  <div className="space-y-4">
                    {starSuggestions.map((s, i) => (
                      <StarEditor key={i} resumeId={result.id} suggestion={s} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state min-h-[24rem] animate-fade-up">
              <div className="empty-state-icon flex items-center justify-center">
                <SparkleIcon size={48} className="text-emerald-600 opacity-60" />
              </div>
              <p className="font-display font-bold text-lg text-ink mb-1">开始你的简历升级</p>
              <p className="text-sm text-ink-muted max-w-md leading-relaxed">
                在左侧上传简历并填写目标岗位/JD，即可获得体检评分、JD 匹配分析、STAR 改写建议，以及<strong className="text-cyan-800">专业模板美化与 PDF 导出</strong>。
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs">
                {["多维诊断评分", "JD 关键词匹配", "STAR 表达优化", "5 款专业模板导出"].map((t) => (
                  <span key={t} className="tag tag-success">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmDeleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-up"
          onClick={() => !deletingId && setConfirmDeleteTarget(null)}
        >
          <div
            className="glass-card p-6 max-w-sm w-full shadow-2xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
                <AlertIcon size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-lg text-ink">确认删除简历？</h3>
                <p className="text-sm text-ink-muted mt-1 leading-relaxed break-words">
                  即将永久删除简历 <span className="font-semibold text-ink">「{confirmDeleteTarget.title}」</span> 及其诊断报告，此操作不可恢复。
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={deletingId !== null}
                onClick={() => setConfirmDeleteTarget(null)}
                className="btn-secondary flex-1 !py-2.5"
              >
                取消
              </button>
              <button
                type="button"
                disabled={deletingId !== null}
                onClick={confirmDeleteResume}
                className="btn-primary flex-1 !py-2.5 !bg-red-600 hover:!bg-red-700 !border-red-600 !text-white !shadow-red-600/20"
              >
                {deletingId !== null ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}