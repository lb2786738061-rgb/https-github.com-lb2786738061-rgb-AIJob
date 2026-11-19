import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, type EnterpriseCompany, type Industry, type SessionReport } from "../api/client";
import RadarChart from "../components/RadarChart";
import ScoreRing from "../components/ScoreRing";
import { useToast } from "../components/Toast";
import { industryDisplayName, interviewerRoleLabel } from "../lib/interviewDisplay";
import { ChartIcon } from "../components/Icons";

const ROLE_NAMES: Record<string, string> = {
  hr: "HR 初试官",
  technical: "技术主管深挖官",
  pressure: "业务总监压力面官",
  english: "外企英文面试官",
};

const STAR_NAMES: Record<string, string> = {
  situation: "背景",
  task: "任务",
  action: "行动",
  result: "结果",
};

const VERDICT_CLASS: Record<string, string> = {
  strong_hire: "verdict-strong",
  lean_hire: "verdict-lean",
  hold: "verdict-hold",
  no_hire: "verdict-no",
};

function overallFrom(report: SessionReport): number {
  if (typeof report.overallScore === "number") return report.overallScore;
  return Math.round(
    report.scoreLogic * 0.25
      + report.scoreProfessional * 0.25
      + report.scoreExpression * 0.15
      + report.scoreMatch * 0.2
      + report.scoreConfidence * 0.15
  );
}

function verdictFrom(score: number): { id: string; label: string; detail: string } {
  if (score >= 85) {
    return { id: "strong_hire", label: "建议通过", detail: "这一场已经接近可录用表达，进入下一轮把握较大。" };
  }
  if (score >= 70) {
    return { id: "lean_hire", label: "有条件通过", detail: "方向对，但还有明显缺口。把量化结果和个人贡献练熟再面。" };
  }
  if (score >= 55) {
    return { id: "hold", label: "需要补强", detail: "尚未达到一线面试官的通过线。先把 STAR 四段讲满。" };
  }
  return { id: "no_hire", label: "暂不推荐", detail: "信息量或结构不足。建议从热身难度把 90 秒故事打磨到能脱口而出。" };
}

export default function InterviewReport() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [report, setReport] = useState<SessionReport | null>(null);
  const [role, setRole] = useState("");
  const [industry, setIndustry] = useState<string | null>(null);
  const [industryName, setIndustryName] = useState<string | null>(null);
  const [targetJob, setTargetJob] = useState<string | null>(null);
  const [resumeId, setResumeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState<EnterpriseCompany[]>([]);
  const [trendsData, setTrendsData] = useState<{
    trends: any[];
    averageScore: number;
    improvement: number;
  } | null>(null);

  useEffect(() => {
    api.getInterviewTrend().then((data) => {
      if (data && data.trends?.length) {
        setTrendsData(data);
      }
    }).catch(() => {});
  }, []);

  const retakeRole = searchParams.get("role") ?? role;
  const retakeResume = searchParams.get("resumeId") ?? (resumeId ? String(resumeId) : "");

  useEffect(() => {
    if (!sessionId) return;
    Promise.all([
      api.getSession(parseInt(sessionId, 10)),
      api.getIndustries().catch(() => [] as Industry[]),
      api.getEnterpriseCompanies().catch(() => [] as EnterpriseCompany[]),
    ])
      .then(([data, industries, companyList]) => {
        setRole(data.session.interviewerRole);
        setIndustry(data.session.industry);
        setIndustryName(industryDisplayName(data.session.industry, industries));
        setTargetJob(data.session.targetJobTitle ?? null);
        setResumeId(data.session.resumeId ?? null);
        setCompanies(companyList);
        if (data.session.reportJson) {
          setReport(JSON.parse(data.session.reportJson));
        } else {
          setError("报告尚未生成，请先完成面试");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "加载失败");
        toast("加载报告失败", "error");
      })
      .finally(() => setLoading(false));
  }, [sessionId, toast]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-9 h-9 rounded-full border-2 border-cyan-200 border-t-cyan-600 animate-spin" />
        <p className="text-ink-faint text-sm font-medium">正在生成/加载复盘报告...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="page-container-narrow text-center py-16">
        <div className="empty-state max-w-lg mx-auto">
          <div className="empty-state-icon flex items-center justify-center">
          <ChartIcon size={48} className="text-cyan-600 opacity-60" />
        </div>
          <p className="font-display font-bold text-lg text-ink mb-1">暂无报告数据</p>
          <p className="text-ink-muted mb-6">{error || "请先完成一场模拟面试后查看复盘报告"}</p>
          <Link to="/interview" className="btn-primary">
            返回模拟面试
          </Link>
        </div>
      </div>
    );
  }

  const overall = overallFrom(report);
  const verdict = report.verdict ?? verdictFrom(overall);
  const radarScores = [
    { label: "逻辑", value: report.scoreLogic },
    { label: "专业", value: report.scoreProfessional },
    { label: "表达", value: report.scoreExpression },
    { label: "匹配", value: report.scoreMatch },
    { label: "自信", value: report.scoreConfidence },
  ];

  const weakRole =
    report.scoreLogic < report.scoreProfessional ? "hr" : "technical";
  const displayRole = ROLE_NAMES[retakeRole] ? retakeRole : weakRole;
  const retakeUrl = `/interview?role=${displayRole}${retakeResume ? `&resumeId=${retakeResume}` : ""}${
    targetJob ? `&job=${encodeURIComponent(targetJob)}` : ""
  }`;

  return (
    <div className="page-container-narrow pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 animate-fade-up">
        <div>
          <p className="section-label mb-1">面试复盘报告</p>
          <h1 className="page-title text-3xl">本场表现与改进建议</h1>
          <p className="page-subtitle mt-1.5">
            面试官：{interviewerRoleLabel(role, { companies })}
            {(industryName || industry) ? ` · 行业：${industryName || industry}` : ""}
            {targetJob ? ` · 岗位：${targetJob}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/practice" className="btn-secondary !text-sm !border-cyan-300 !text-cyan-800">
            去弱题复盘本
          </Link>
          <Link to={retakeUrl} className="btn-secondary !text-sm">
            针对弱项再练
          </Link>
          <Link to="/interview" className="btn-primary !text-sm">
            再来一场
          </Link>
        </div>
      </div>

      <div className={`verdict-banner ${VERDICT_CLASS[verdict.id] ?? "verdict-hold"} mb-6 animate-fade-up relative overflow-hidden`}>
        <div className="absolute right-0 top-0 w-40 h-40 rounded-full bg-white/20 blur-2xl -mr-10 -mt-10" />
        <ScoreRing score={overall} label="综合" size={92} />
        <div className="relative">
          <p className="text-xs font-bold tracking-[0.14em] uppercase opacity-70 mb-1">面试结论</p>
          <p className="font-display text-2xl md:text-3xl font-extrabold">{verdict.label}</p>
          <p className="text-sm mt-1.5 opacity-90 max-w-xl leading-relaxed">{verdict.detail}</p>
        </div>
      </div>

      <div className="glass-card p-7 mb-6 animate-fade-up animate-fade-up-delay-1">
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="font-display font-bold text-lg text-ink">能力雷达与维度得分</h2>
          <span className="tag tag-success">5 维评估</span>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-8 mb-6">
          <div className="bg-cyan-50/40 rounded-2xl p-3 border border-cyan-100/60">
            <RadarChart scores={radarScores} />
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-3 text-sm w-full">
            {radarScores.map((s) => (
              <div key={s.label} className="bg-white p-4 rounded-xl text-center border border-border shadow-sm">
                <p className="text-ink-muted text-xs mb-1 font-semibold">{s.label}</p>
                <p className="font-display text-2xl font-extrabold text-cyan-800">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-50/80 border border-slate-200/70 p-5 rounded-xl">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">综合评语</p>
          <pre className="text-sm text-ink-muted whitespace-pre-wrap font-sans leading-relaxed">
            {report.feedbackSummary}
          </pre>
        </div>
      </div>

      {(!!report.strengths?.length || !!report.weaknesses?.length || !!report.practicePlan?.length) && (
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="glass-card p-5 border-t-4 border-t-cyan-500">
            <h3 className="font-display font-bold text-sm mb-3 text-ink">本场亮点</h3>
            <ul className="space-y-2">
              {(report.strengths?.length ? report.strengths : ["表达基本完整"]).map((item) => (
                <li key={item} className="text-sm text-cyan-900 flex gap-2"><span className="text-cyan-600">●</span><span>{item}</span></li>
              ))}
            </ul>
          </div>
          <div className="glass-card p-5 border-t-4 border-t-orange-400">
            <h3 className="font-display font-bold text-sm mb-3 text-ink">优先补强</h3>
            <ul className="space-y-2">
              {(report.weaknesses?.length ? report.weaknesses : ["补充量化结果"]).map((item) => (
                <li key={item} className="text-sm text-orange-900 flex gap-2"><span className="text-orange-500">●</span><span>{item}</span></li>
              ))}
            </ul>
          </div>
          <div className="glass-card p-5 border-t-4 border-t-slate-500">
            <h3 className="font-display font-bold text-sm mb-3 text-ink">下一场训练计划</h3>
            <ol className="space-y-2 list-decimal pl-4 marker:text-slate-500 marker:font-bold">
              {(report.practicePlan ?? []).map((item) => (
                <li key={item} className="text-sm text-ink-muted leading-relaxed">{item}</li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {report.starCoverage && (
        <div className="glass-card p-5 mb-6">
          <h3 className="font-display font-bold text-sm mb-3 text-ink">STAR 结构覆盖率</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(STAR_NAMES).map(([key, name]) => {
              const val = report.starCoverage?.[key] ?? 0;
              return (
                <div key={key} className="bg-gradient-to-b from-cyan-50/70 to-white rounded-xl p-3.5 border border-cyan-100 text-center">
                  <p className="text-xs text-ink-muted mb-1 font-semibold">{name}</p>
                  <p className="font-display text-xl font-extrabold text-cyan-800">{val}%</p>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-500" style={{ width: `${Math.min(100, Math.max(0, val))}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {report.recordingUrl && (
        <div className="glass-card p-6 mb-6 animate-fade-up animate-fade-up-delay-2">
          <h2 className="font-display font-bold mb-4 text-ink">录音回放</h2>
          <audio controls src={report.recordingUrl} className="w-full" />
        </div>
      )}

      {report.transcript && (
        <div className="glass-card p-6 mb-6 animate-fade-up animate-fade-up-delay-2">
          <h2 className="font-display font-bold mb-1 text-ink">作答逐字稿</h2>
          <p className="text-xs text-ink-faint mb-4">
            检测到 {report.transcript.fillerCount} 处口头禅/卡顿
          </p>
          <p className="text-sm leading-relaxed text-ink-muted">
            {report.transcript.segments.map((seg, i) => (
              <span
                key={i}
                className={seg.isFiller ? "bg-red-100 text-red-700 px-0.5 rounded" : ""}
              >
                {seg.text}
              </span>
            ))}
          </p>
        </div>
      )}

      <h2 className="font-display font-extrabold text-xl mb-5 text-ink animate-fade-up animate-fade-up-delay-3 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-800 inline-flex items-center justify-center text-sm">Q</span>
        逐题复盘
      </h2>
      <div className="space-y-4">
        {report.questionReviews.map((q, i) => {
          const calcScore = Math.round(
            q.evaluation.scoreLogic * 0.25 +
              q.evaluation.scoreProfessional * 0.3 +
              q.evaluation.scoreMatch * 0.25 +
              q.evaluation.scoreExpression * 0.2
          );
          const qScore = q.weakMeta?.overallScore ?? calcScore;
          const isWeak = (q.weakMeta?.status ?? (qScore < 70 ? "weak" : "mastered")) === "weak";
          const nextExamChecked = q.weakMeta?.nextExamEnabled ?? isWeak;

          return (
            <div key={i} className="glass-card p-6 animate-fade-up">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-xs text-cyan-700 font-bold tracking-wide">第 {i + 1} 题</p>
                    <span className={`tag ${isWeak ? "tag-danger" : "tag-success"}`}>
                      {isWeak ? `弱题 (${qScore}分 · 默认下次复考)` : `已掌握 (${qScore}分)`}
                    </span>
                  </div>
                  <p className="font-display font-bold text-lg text-ink leading-snug">{q.question}</p>
                </div>
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-800 bg-cyan-50/70 border border-cyan-200 px-3 py-1.5 rounded-xl cursor-pointer select-none shrink-0">
                  <input
                    type="checkbox"
                    checked={nextExamChecked}
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      const nextReviews = [...report.questionReviews];
                      nextReviews[i] = {
                        ...q,
                        weakMeta: {
                          weakQuestionId: q.weakMeta?.weakQuestionId ?? null,
                          overallScore: qScore,
                          status: isWeak ? "weak" : "mastered",
                          nextExamEnabled: checked,
                        },
                      };
                      setReport({ ...report, questionReviews: nextReviews });
                      try {
                        await api.setPreferenceByQuestion(q.question, checked);
                        toast(
                          checked
                            ? isWeak
                              ? "已开启下次面试优先复考此弱题"
                              : "已勾选「下次再出」，下次面试将以不同问法再现"
                            : "已关闭该题的下次复考偏好",
                          "success"
                        );
                      } catch (err) {
                        toast(err instanceof Error ? err.message : "设置失败", "error");
                      }
                    }}
                    className="rounded border-slate-300 text-cyan-700 focus:ring-cyan-500"
                  />
                  <span>{isWeak ? "下次再考" : "下次再出（换问法）"}</span>
                </label>
              </div>
              <div className="mb-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">你的回答</p>
                <p className="text-sm text-ink-muted bg-slate-50 border border-slate-200/70 p-4 rounded-xl leading-relaxed whitespace-pre-wrap">
                  {q.answer}
                </p>
              </div>
              {q.evaluation.starCoverage && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.entries(STAR_NAMES).map(([key, name]) => {
                    const hit = Boolean(q.evaluation.starCoverage?.[key as keyof typeof q.evaluation.starCoverage]);
                    return (
                      <span key={key} className={`star-chip ${hit ? "star-chip-on" : ""}`}>
                        {hit ? "✓" : "○"} {name}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-xs mb-3">
                {[
                  ["逻辑", q.evaluation.scoreLogic],
                  ["专业", q.evaluation.scoreProfessional],
                  ["匹配", q.evaluation.scoreMatch],
                  ["表达", q.evaluation.scoreExpression],
                ].map(([label, score]) => (
                  <span key={label as string} className="tag tag-success">
                    {label} {score}
                  </span>
                ))}
              </div>
              <p className="text-sm text-cyan-800 mb-3 font-semibold leading-relaxed">{q.evaluation.feedback}</p>
              {!!q.evaluation.missedPoints?.length && (
                <p className="text-xs text-rose-700 mb-3 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  <span className="font-bold">扣分说明：</span>{q.evaluation.missedPoints.join(" · ")}
                </p>
              )}
              <div className="text-sm border-t border-border pt-4 mt-2 bg-cyan-50/30 -mx-2 px-4 pb-1 rounded-b-lg">
                <span className="font-bold text-cyan-900">示范回答：</span>
                <span className="text-ink-muted leading-relaxed">{q.evaluation.modelAnswer}</span>
              </div>
            </div>
          );
        })}
      </div>

      {trendsData && trendsData.trends.length > 1 && (
        <div className="glass-card p-6 mt-10 rounded-2xl animate-fade-up">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
            <div>
              <span className="badge badge-brand mb-1">能力进化轨迹</span>
              <h3 className="font-display font-bold text-xl text-ink">历次面试综合能力成长趋势</h3>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="bg-surface-ground px-3 py-1.5 rounded-lg">
                <span className="text-ink-muted text-xs block">历史均分</span>
                <span className="font-bold text-brand-600 text-base">{trendsData.averageScore}</span>
              </div>
              <div className="bg-surface-ground px-3 py-1.5 rounded-lg">
                <span className="text-ink-muted text-xs block">最近进步幅度</span>
                <span className={`font-bold text-base ${trendsData.improvement >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
                  {trendsData.improvement >= 0 ? `+${trendsData.improvement}` : trendsData.improvement} 分
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {trendsData.trends.slice(-6).map((t, idx) => (
                <div key={t.id || idx} className="p-3 bg-surface-ground rounded-xl text-center flex flex-col justify-between">
                  <span className="text-xs text-ink-muted">第 {idx + 1} 场</span>
                  <div className="my-2">
                    <span className="text-2xl font-bold font-display text-brand-700">{t.scoreOverall}</span>
                    <span className="text-xs text-ink-muted block mt-0.5">{ROLE_NAMES[t.interviewerRole] || t.interviewerRole}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, t.scoreOverall)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}