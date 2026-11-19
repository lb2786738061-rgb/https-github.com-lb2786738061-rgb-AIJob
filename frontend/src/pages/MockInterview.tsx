import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  api,
  type InterviewDifficulty,
  type InterviewHint,
  type InterviewMessage,
  type InterviewRole,
  type InterviewStage,
  type QuestionEvaluation,
  type Industry,
  type InterviewSession,
  type Resume,
  type TechAgendaItem,
  type EnterpriseCompany,
  type WeakQuestionRecordMeta,
} from "../api/client";
import { useSpeech } from "../hooks/useSpeech";
import { useRecording } from "../hooks/useRecording";
import { useVoiceWebSocket } from "../hooks/useVoiceWebSocket";
import { useToast } from "../components/Toast";
import SessionHistory from "../components/SessionHistory";
import InterviewCoachPanel from "../components/InterviewCoachPanel";
import { resumeOptionLabel } from "../lib/resumeLabel";
import { interviewerRoleLabel, stageTrack } from "../lib/interviewDisplay";
import {
  HrIcon,
  TechIcon,
  PressureIcon,
  EnglishIcon,
  MicIcon,
} from "../components/Icons";

const ROLE_META: Record<string, { Icon: typeof HrIcon; color: string }> = {
  hr: { Icon: HrIcon, color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  technical: { Icon: TechIcon, color: "bg-blue-50 text-blue-700 border-blue-100" },
  pressure: { Icon: PressureIcon, color: "bg-orange-50 text-orange-700 border-orange-100" },
  english: { Icon: EnglishIcon, color: "bg-violet-50 text-violet-700 border-violet-100" },
};

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseEval(raw: string | null): QuestionEvaluation | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuestionEvaluation;
  } catch {
    return null;
  }
}

export default function MockInterview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [roles, setRoles] = useState<InterviewRole[]>([]);
  const [difficulties, setDifficulties] = useState<InterviewDifficulty[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [companies, setCompanies] = useState<EnterpriseCompany[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [selectedResume, setSelectedResume] = useState<number | undefined>();
  const [difficulty, setDifficulty] = useState("standard");
  const [targetJobTitle, setTargetJobTitle] = useState("");
  const [experienceYears, setExperienceYears] = useState("1-3年");
  const [jobDescription, setJobDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<5 | 15 | 30>(15);
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [swappingQuestion, setSwappingQuestion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lastEval, setLastEval] = useState<QuestionEvaluation | null>(null);
  const [lastWeakRecord, setLastWeakRecord] = useState<WeakQuestionRecordMeta | null>(null);
  const [questionCount, setQuestionCount] = useState(1);
  const [maxQuestions, setMaxQuestions] = useState(8);
  const [stage, setStage] = useState<InterviewStage | null>(null);
  const [hint, setHint] = useState<InterviewHint | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [techAgenda, setTechAgenda] = useState<TechAgendaItem[]>([]);
  const [currentTech, setCurrentTech] = useState<TechAgendaItem | null>(null);
  const [maxDurationSec, setMaxDurationSec] = useState<number | null>(900);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const startedAtRef = useRef(Date.now());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { isListening, transcript, isSupported, startListening, stopListening, speak } =
    useSpeech();
  const { startRecording, stopRecording } = useRecording();
  const voiceToken = localStorage.getItem("careerai_token");

  const handleVoiceAnswerResult = (data: import("../api/client").AnswerResult) => {
    setLastEval(data.evaluation);
    if (data.weakQuestionRecord !== undefined) {
      setLastWeakRecord(data.weakQuestionRecord ?? null);
    }
    setQuestionCount(data.questionCount);
    setMaxQuestions(data.maxQuestions || maxQuestions);
    if (data.stage) setStage(data.stage);
    if (data.techAgenda) setTechAgenda(data.techAgenda);
    if (data.currentTech !== undefined) setCurrentTech(data.currentTech ?? null);
    setHint(null);
    if (data.nextQuestion) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: data.nextQuestion!,
          messageType: mode,
          scoreJson: null,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    if (data.isComplete) {
      toast("面试已完成，正在生成报告...", "info");
      void endInterview();
    }
    setLoading(false);
  };

  const { connected: voiceConnected, sendAnswer: sendVoiceAnswer } = useVoiceWebSocket({
    sessionId: mode === "voice" ? sessionId : null,
    token: voiceToken,
    onAnswerResult: handleVoiceAnswerResult,
    onQuestion: (text) => speak(text),
    onError: (msg) => toast(msg, "error"),
  });

  useEffect(() => {
    api.getInterviewRoles().then(setRoles).catch(() => {});
    api.getInterviewDifficulties().then(setDifficulties).catch(() => {});
    api.getIndustries().then(setIndustries).catch(() => {});
    api.getEnterpriseCompanies().then(setCompanies).catch(() => {});
    api.getResumes().then(setResumes).catch(() => {});
    api.getSessions().then(setSessions).catch(() => {});
    const resumeId = searchParams.get("resumeId");
    if (resumeId) setSelectedResume(parseInt(resumeId, 10));
    const roleParam = searchParams.get("role");
    if (roleParam) setSelectedRole(roleParam);
    const jobParam = searchParams.get("job");
    if (jobParam) setTargetJobTitle(jobParam);

    const existingSessionId = searchParams.get("sessionId");
    if (existingSessionId) {
      const sid = parseInt(existingSessionId, 10);
      api
        .getSession(sid)
        .then((data) => {
          setSessionId(data.session.id);
          setMessages(data.messages);
          setQuestionCount(data.session.questionCount ?? 1);
          setMaxQuestions(data.maxQuestions ?? 8);
          setStage(data.stage ?? null);
          setTechAgenda(data.techAgenda ?? []);
          setCurrentTech(data.currentTech ?? null);
          setSelectedRole(data.session.interviewerRole);
          if (data.session.difficulty) setDifficulty(data.session.difficulty);
          if (data.session.targetJobTitle) setTargetJobTitle(data.session.targetJobTitle);
          startedAtRef.current = new Date(data.session.startedAt).getTime();
          const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
          setLastEval(parseEval(lastUser?.scoreJson ?? null));
        })
        .catch((err) => toast(err instanceof Error ? err.message : "加载会话失败", "error"));
    }
  }, [searchParams, toast]);

  useEffect(() => {
    if (!resumes.length) return;
    if (!selectedResume || !resumes.some((r) => r.id === selectedResume)) {
      setSelectedResume(resumes[0].id);
    }
  }, [resumes, selectedResume]);

  useEffect(() => {
    if (!selectedResume || !resumes.length) return;
    const resume = resumes.find((item) => item.id === selectedResume);
    if (resume?.targetJobTitle) {
      setTargetJobTitle((current) => current || resume.targetJobTitle || "");
    }
    if (resume?.jobDescription) {
      setJobDescription((current) => current || resume.jobDescription || "");
    }
  }, [selectedResume, resumes]);

  useEffect(() => {
    if (!sessionId || paused) return;
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionId, paused]);

  useEffect(() => {
    if (transcript) setAnswer(transcript);
  }, [transcript]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && mode === "voice") {
      speak(last.content);
    }
  }, [messages, mode, speak]);

  async function startInterview() {
    if (!selectedRole) {
      toast("请先选择面试官角色", "error");
      return;
    }
    if (!selectedResume) {
      toast("创建模拟面试必须关联一份简历，请先上传或选择一份简历", "error");
      return;
    }
    setLoading(true);
    try {
      const data = await api.startSession({
        interviewerRole: selectedRole,
        resumeId: selectedResume,
        industry: selectedIndustry || undefined,
        mode,
        difficulty,
        targetJobTitle: targetJobTitle.trim() || undefined,
        experienceYears: experienceYears || undefined,
        jobDescription: jobDescription.trim() || undefined,
        durationMinutes,
      });
      setSessionId(data.session.id);
      setQuestionCount(1);
      setMaxQuestions(data.maxQuestions);
      setMaxDurationSec(data.maxDurationSec ?? durationMinutes * 60);
      setStage(data.stage ?? null);
      setTechAgenda(data.techAgenda ?? []);
      setCurrentTech(data.currentTech ?? null);
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      setPaused(false);
      setHint(null);
      setMessages([
        {
          id: 0,
          role: "assistant",
          content: data.openingQuestion,
          messageType: mode,
          scoreJson: null,
          createdAt: new Date().toISOString(),
        },
      ]);
      setLastEval(null);
      setLastWeakRecord(null);
      if (mode === "voice") startRecording();
      toast("面试已开始。所有出题均紧扣你的关联简历与目标岗位。", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "启动失败", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSwapQuestion() {
    if (!sessionId || swappingQuestion || loading) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant") {
      toast("当前题已作答，仅当前未答题目支持换一题", "info");
      return;
    }
    setSwappingQuestion(true);
    try {
      const excluded = messages.filter((m) => m.role === "assistant").map((m) => m.content);
      const data = await api.swapQuestion(sessionId, excluded);
      setMessages((prev) => {
        if (!prev.length) return prev;
        const copy = [...prev];
        copy[copy.length - 1] = {
          ...copy[copy.length - 1],
          content: data.question,
        };
        return copy;
      });
      setHint(null);
      toast("已为您更换一道不同切入角度的新面试题", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "换题失败", "error");
    } finally {
      setSwappingQuestion(false);
    }
  }

  async function handleToggleNextExam(nextExam: boolean) {
    if (!lastWeakRecord) return;
    setLastWeakRecord({ ...lastWeakRecord, nextExamEnabled: nextExam });
    try {
      if (lastWeakRecord.weakQuestionId) {
        await api.updateWeakQuestion(lastWeakRecord.weakQuestionId, {
          nextExamEnabled: nextExam,
        });
      }
      toast(
        nextExam
          ? "已开启「下次面试再出」，下次将以不同问法考察该考点"
          : "已关闭该题的下次复考偏好",
        "success"
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "更新出题偏好失败", "error");
    }
  }

  async function submitAnswer(skipped = false) {
    if (!sessionId || paused) return;
    if (!skipped && !answer.trim()) return;
    if (maxDurationSec && elapsedSec >= maxDurationSec) {
      toast("已达本场设定时长上限，正在生成复盘报告...", "info");
      await endInterview();
      return;
    }

    setLoading(true);
    const content = skipped ? "（本题跳过）" : answer;
    const userMsg: InterviewMessage = {
      id: Date.now(),
      role: "user",
      content,
      messageType: mode,
      scoreJson: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setAnswer("");
    try {
      if (!skipped && mode === "voice" && voiceConnected && sendVoiceAnswer(userMsg.content, elapsedSec)) {
        return;
      }
      const data = await api.submitAnswer(sessionId, userMsg.content, mode, elapsedSec, { skipped });
      handleVoiceAnswerResult(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "提交失败", "error");
      setLoading(false);
    }
  }

  async function requestHint() {
    if (!sessionId) return;
    setHintLoading(true);
    try {
      const data = await api.getInterviewHint(sessionId);
      setHint(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "提纲生成失败", "error");
    } finally {
      setHintLoading(false);
    }
  }

  async function endInterview() {
    if (!sessionId) return;
    setLoading(true);
    setShowEndConfirm(false);
    try {
      const durationSec = elapsedSec || Math.round((Date.now() - startedAtRef.current) / 1000);
      const blob = await stopRecording();
      if (blob && blob.size > 0) {
        await api.uploadRecording(sessionId, blob).catch(() => {});
      }
      await api.endSession(sessionId, durationSec);
      navigate(`/interview/${sessionId}/report`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "结束失败", "error");
    } finally {
      setLoading(false);
    }
  }

  if (sessionId) {
    const timeWarning = maxDurationSec && elapsedSec >= maxDurationSec - 60;
    const roleName = interviewerRoleLabel(selectedRole, { roles, companies });
    const canSwapCurrent =
      messages.length > 0 && messages[messages.length - 1].role === "assistant" && !loading && !paused;
    return (
      <div className="page-container py-6 flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4 glass-card p-4 md:p-5">
          <div className="min-w-0">
            <p className="section-label mb-1">面试进行中 · 已关联简历出题</p>
            <h1 className="font-display text-xl md:text-2xl font-extrabold text-ink truncate">
              {roleName || "模拟面试"}
              {targetJobTitle ? ` · ${targetJobTitle}` : ""}
            </h1>
            <p className="text-sm text-ink-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-cyan-800">第 {questionCount}/{maxQuestions} 题</span>
              <span>· {formatTime(elapsedSec)}{maxDurationSec ? ` / ${formatTime(maxDurationSec)}` : ""}</span>
              {paused && <span className="tag tag-warning">已暂停</span>}
              {mode === "voice" && (
                <span className={voiceConnected ? "text-cyan-700 font-medium" : "text-ink-faint"}>
                  · {voiceConnected ? "语音通道已连接" : "语音通道连接中..."}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              disabled={loading}
              className="btn-secondary !text-xs !py-2 !px-3.5"
            >
              {paused ? "继续作答" : "暂停面试"}
            </button>
            {canSwapCurrent && (
              <button
                type="button"
                onClick={() => void handleSwapQuestion()}
                disabled={swappingQuestion}
                className="btn-secondary !text-xs !py-2 !px-3.5 !border-cyan-300 !text-cyan-800"
              >
                {swappingQuestion ? "换题中..." : "换一题"}
              </button>
            )}
            <button
              onClick={() => setShowEndConfirm(true)}
              disabled={loading}
              className="btn-danger"
            >
              结束面试
            </button>
          </div>
        </div>

        <div className="interview-stage-track mb-4">
          {stageTrack(selectedRole, stage).map((item) => (
            <div
              key={item.id}
              className={`interview-stage-step ${stage?.id === item.id ? "is-active" : ""}`}
            >
              {item.name}
            </div>
          ))}
        </div>
        {stage?.goal && (
          <p className="text-xs text-ink-muted mb-3">{stage.goal}</p>
        )}

        {techAgenda.length > 0 && (
          <div className="tech-agenda mb-4">
            <p className="text-xs text-ink-faint mb-2">本场按简历技术栈出题</p>
            <div className="flex flex-wrap gap-1.5">
              {techAgenda.map((item) => {
                const active = currentTech?.index === item.index;
                return (
                  <span
                    key={`${item.tech}-${item.dimension}-${item.index}`}
                    className={`star-chip ${active ? "star-chip-on" : ""}`}
                  >
                    {item.index}. {item.tech} · {item.label}
                  </span>
                );
              })}
            </div>
            {currentTech && (
              <p className="text-xs text-brand-800 mt-2">
                正在考察：{currentTech.tech} · {currentTech.label}
              </p>
            )}
          </div>
        )}

        {timeWarning && (
          <div className="mb-3 p-3.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-800 text-sm font-medium">
            面试时间即将达到上限，请尽快完成作答并生成复盘报告。
          </div>
        )}

        <div className="flex-1 min-h-0 grid lg:grid-cols-[minmax(0,1fr)_300px] gap-4">
          <div className="flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto space-y-4 mb-3 pr-1">
              {messages.map((m, idx) => {
                const isCurrentUnanswered =
                  idx === messages.length - 1 && m.role === "assistant" && !loading && !paused;
                return (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[84%] px-4 py-3 text-sm ${m.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant"}`}>
                      {m.role === "assistant" && (
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-xs text-ink-faint font-medium">面试官</span>
                          {isCurrentUnanswered && (
                            <button
                              type="button"
                              onClick={() => void handleSwapQuestion()}
                              disabled={swappingQuestion}
                              className="text-xs text-cyan-700 hover:text-cyan-900 font-semibold underline"
                            >
                              {swappingQuestion ? "换题中..." : "换一题"}
                            </button>
                          )}
                        </div>
                      )}
                      {m.content}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={paused}
                  rows={3}
                  placeholder={
                    paused
                      ? "面试已暂停，点击右上角「继续作答」恢复..."
                      : selectedRole === "english"
                        ? "Answer with situation, action, and a number..."
                        : mode === "voice"
                          ? "语音输入或手动输入。尽量包含背景、行动和结果。"
                          : "输入你的回答。建议 120 字以上，带一个可核对的结果。"
                  }
                  className="textarea-field w-full !resize-none !rounded-xl"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitAnswer(false);
                    }
                  }}
                />
                <p className="text-[11px] text-ink-faint mt-1 text-right">{answer.trim().length} 字</p>
              </div>
              {mode === "voice" && isSupported && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={paused}
                  className={`px-4 h-12 rounded-xl text-sm font-medium transition-colors ${
                    isListening ? "bg-red-100 text-red-700" : "bg-brand-50 text-brand-700 border border-brand-200"
                  }`}
                >
                  {isListening ? "停止" : <MicIcon size={16} />}
                </button>
              )}
              <button
                onClick={() => submitAnswer(false)}
                disabled={loading || paused || !answer.trim()}
                className="btn-primary !px-5 !rounded-xl h-12"
              >
                发送
              </button>
            </div>
          </div>

          <InterviewCoachPanel
            evaluation={lastEval}
            weakRecord={lastWeakRecord}
            onToggleNextExam={(nextExam) => void handleToggleNextExam(nextExam)}
            hint={hint}
            hintLoading={hintLoading}
            onHint={() => void requestHint()}
            onSwapQuestion={canSwapCurrent ? () => void handleSwapQuestion() : undefined}
            swappingQuestion={swappingQuestion}
            onSkip={() => void submitAnswer(true)}
            disableActions={loading || paused}
            currentTech={currentTech}
          />
        </div>

        {showEndConfirm && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3 className="font-display font-bold text-lg mb-2">确认结束面试？</h3>
              <p className="text-sm text-ink-muted mb-5">
                结束后将生成复盘报告，当前进度无法恢复。
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowEndConfirm(false)} className="btn-secondary flex-1">
                  继续面试
                </button>
                <button onClick={endInterview} className="btn-danger flex-1 !bg-red-600 !text-white !border-red-600">
                  确认结束
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-container-narrow pb-12 space-y-6">
      <div className="animate-fade-up">
        <p className="section-label mb-2">全真模拟面试</p>
        <h1 className="page-title text-3xl">像真实面试一样练，带着复盘报告走出来</h1>
        <p className="page-subtitle mt-2 max-w-2xl">
          选择面试官角色、难度与目标岗位，系统将围绕你的简历与技术栈进行追问，并在结束后生成可执行的改进建议。
        </p>
      </div>

      <div className="glass-card p-7 space-y-7 animate-fade-up animate-fade-up-delay-1">
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <label className="form-label !mb-0">选择面试官角色</label>
            <span className="text-xs text-ink-faint">建议先从 HR/标准难度热身</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRole(r.id)}
                className={`role-card ${selectedRole === r.id ? "role-card-selected" : ""}`}
              >
                <p className="font-semibold text-ink flex items-center gap-2">
                  {(() => {
                    const meta = ROLE_META[r.id];
                    if (meta) {
                      const Icon = meta.Icon;
                      return (
                        <span className={`w-7 h-7 rounded-lg border inline-flex items-center justify-center ${meta.color}`}>
                          <Icon size={16} />
                        </span>
                      );
                    }
                    return (
                      <span className="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-100 inline-flex items-center justify-center">
                        <MicIcon size={16} className="text-cyan-700" />
                      </span>
                    );
                  })()}
                  {r.name}
                </p>
                <p className="text-xs text-ink-muted mt-2 leading-relaxed">{r.description}</p>
                {!!r.focus?.length && (
                  <p className="text-[11px] text-cyan-800 mt-2 font-semibold">{r.focus.join(" · ")}</p>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="form-label">面试难度</label>
            <div className="grid grid-cols-3 gap-2">
              {(difficulties.length ? difficulties : [
                { id: "easy", name: "热身", description: "友好引导" },
                { id: "standard", name: "标准", description: "一线面试官" },
                { id: "hard", name: "高压", description: "深挖质疑" },
              ]).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setDifficulty(item.id)}
                  className={`role-card !p-3 ${difficulty === item.id ? "role-card-selected" : ""}`}
                >
                  <p className="font-semibold text-sm text-ink">{item.name}</p>
                  <p className="text-[11px] text-ink-muted mt-0.5">{item.description}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">互动模式</label>
            <div className="flex gap-2">
              {(["text", "voice"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    mode === m
                      ? "bg-cyan-700 text-white border-cyan-700 shadow-md shadow-cyan-700/20"
                      : "bg-white/80 text-cyan-800 border-cyan-200 hover:bg-cyan-50"
                  }`}
                >
                  {m === "text" ? "文字作答" : "语音对话"}
                </button>
              ))}
            </div>
            {mode === "voice" && !isSupported && (
              <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center justify-between gap-2">
                <span>当前浏览器不支持原生语音识别，可在面试中使用文字输入（推荐 Chrome/Edge）。</span>
                <button
                  type="button"
                  onClick={() => setMode("text")}
                  className="font-semibold underline shrink-0"
                >
                  切回文字
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="form-label">关联简历（必填 · 基于简历经历与目标岗位出题）</label>
          <p className="text-xs text-ink-muted mb-2">
            系统将紧扣您简历中的个人优势、项目经历与技术栈进行针对性提问与追问，禁止无关随机刷题。
          </p>
          {resumes.length > 0 ? (
            <select
              value={selectedResume ?? resumes[0]?.id ?? ""}
              onChange={(e) =>
                setSelectedResume(e.target.value ? parseInt(e.target.value, 10) : undefined)
              }
              className="input-field"
            >
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {resumeOptionLabel(r)}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-amber-900">您尚未上传简历，无法开启模拟面试</p>
                <p className="text-xs text-amber-800 mt-0.5">
                  模拟面试必须关联一份简历以便按您的经历与岗位精准出题。
                </p>
              </div>
              <Link to="/resume" className="btn-primary !text-xs !py-2 !px-4 shrink-0">
                去上传简历 →
              </Link>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">目标岗位</label>
            <input
              value={targetJobTitle}
              onChange={(e) => setTargetJobTitle(e.target.value)}
              placeholder="如：高级前端工程师 / Java 后端开发"
              className="input-field"
            />
          </div>
          <div>
            <label className="form-label">方向 / 行业</label>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="input-field"
            >
              <option value="">不限行业</option>
              {industries.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">工作年限</label>
            <div className="grid grid-cols-4 gap-2">
              {["应届/校招", "1-3年", "3-5年", "5年以上"].map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setExperienceYears(yr)}
                  className={`role-card !p-2.5 text-center ${
                    experienceYears === yr ? "role-card-selected" : ""
                  }`}
                >
                  <p className="font-semibold text-xs text-ink">{yr}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">面试时长</label>
            <div className="grid grid-cols-3 gap-2">
              {([5, 15, 30] as const).map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className={`role-card !p-2.5 text-center ${
                    durationMinutes === mins ? "role-card-selected" : ""
                  }`}
                >
                  <p className="font-semibold text-xs text-ink">{mins} 分钟</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="form-label">岗位 JD（可选，默认继承关联简历 JD）</label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={3}
            placeholder="粘贴目标岗位职责与要求，面试官将结合 JD 要求与您的简历经历交叉追问..."
            className="textarea-field !text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link
            to="/practice"
            className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 underline"
          >
            查看我的弱题复盘本与下次再考偏好 →
          </Link>
        </div>

        <button
          onClick={startInterview}
          disabled={!selectedRole || !selectedResume || resumes.length === 0 || loading}
          className="btn-primary btn-full !py-3.5 !text-base !rounded-xl"
        >
          {loading ? "正在结合简历与复考偏好准备面试题..." : "开始模拟面试 →"}
        </button>
      </div>

      <SessionHistory sessions={sessions} companies={companies} />
    </div>
  );
}