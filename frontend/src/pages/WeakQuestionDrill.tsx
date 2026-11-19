import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type WeakQuestionItem,
  type WeakQuestionPracticeResult,
  type WeakQuestionStats,
} from "../api/client";
import ScoreRing from "../components/ScoreRing";
import { useToast } from "../components/Toast";
import { TargetIcon, SparkleIcon, MicIcon, CheckIcon } from "../components/Icons";

const ROLE_LABELS: Record<string, string> = {
  hr: "HR 初试官",
  technical: "技术主管深挖官",
  pressure: "业务总监压力面官",
  english: "外企英文面试官",
};

function roleDisplay(role: string | null) {
  if (!role) return "模拟面试";
  if (role.startsWith("enterprise:")) {
    return `名企专项 (${role.replace("enterprise:", "")})`;
  }
  return ROLE_LABELS[role] || role;
}

export default function WeakQuestionDrill() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"all" | "weak" | "mastered" | "next_exam">("weak");
  const [roleFilter, setRoleFilter] = useState("");
  const [items, setItems] = useState<WeakQuestionItem[]>([]);
  const [stats, setStats] = useState<WeakQuestionStats>({
    totalCount: 0,
    weakCount: 0,
    masteredCount: 0,
    nextExamCount: 0,
    totalPracticeCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [practicingId, setPracticingId] = useState<number | null>(null);
  const [practiceDrafts, setPracticeDrafts] = useState<Record<number, string>>({});
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [practiceResults, setPracticeResults] = useState<Record<number, WeakQuestionPracticeResult>>({});
  const [expandedModelIds, setExpandedModelIds] = useState<Record<number, boolean>>({});

  async function loadList(currentStatus = statusFilter, currentRole = roleFilter) {
    setLoading(true);
    try {
      const data = await api.getWeakQuestions(currentStatus, currentRole);
      setItems(data.items);
      setStats(data.stats);
    } catch (err) {
      toast(err instanceof Error ? err.message : "加载弱题记录失败", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadList(statusFilter, roleFilter);
  }, [statusFilter, roleFilter]);

  async function handleToggleNextExam(item: WeakQuestionItem, checked: boolean) {
    setItems((prev) =>
      prev.map((x) => (x.id === item.id ? { ...x, nextExamEnabled: checked } : x))
    );
    try {
      const res = await api.updateWeakQuestion(item.id, { nextExamEnabled: checked });
      setItems((prev) => prev.map((x) => (x.id === item.id ? res.item : x)));
      setStats((s) => ({
        ...s,
        nextExamCount: Math.max(0, s.nextExamCount + (checked ? 1 : -1)),
      }));
      toast(
        checked
          ? item.status === "weak"
            ? "已开启「下次再考」，下次面试将优先复考此薄弱题"
            : "已勾选「下次再出」，下次面试将以不同问法再现此考点"
          : "已关闭该题的下次面试再考偏好",
        "success"
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "更新偏好失败", "error");
      void loadList();
    }
  }

  async function handleToggleMasteredStatus(item: WeakQuestionItem) {
    const targetStatus = item.status === "weak" ? "mastered" : "weak";
    const defaultNextExam = targetStatus === "weak";
    try {
      const res = await api.updateWeakQuestion(item.id, {
        status: targetStatus,
        nextExamEnabled: defaultNextExam,
      });
      toast(
        targetStatus === "mastered"
          ? "已标记为「已掌握」，默认不再重复出题（可按需勾选下次再出）"
          : "已移回「弱题待攻克」，默认开启下次面试再考",
        "success"
      );
      setItems((prev) => prev.map((x) => (x.id === item.id ? res.item : x)));
      void loadList();
    } catch (err) {
      toast(err instanceof Error ? err.message : "状态更新失败", "error");
    }
  }

  async function handleSubmitPractice(item: WeakQuestionItem) {
    const draft = (practiceDrafts[item.id] ?? "").trim();
    if (!draft) {
      toast("请先输入您的对照重练回答", "error");
      return;
    }
    setSubmittingId(item.id);
    try {
      const res = await api.practiceWeakQuestion(item.id, draft);
      setPracticeResults((prev) => ({ ...prev, [item.id]: res }));
      setItems((prev) => prev.map((x) => (x.id === item.id ? res.item : x)));
      if (res.masteredNow) {
        toast(
          `恭喜！重练得分 ${res.newScore} 分（提升 +${Math.max(0, res.scoreDelta)} 分），已自动回写为「已掌握」！`,
          "success"
        );
      } else {
        toast(
          `重练评估完成：本次 ${res.newScore} 分，距离达标（70分）还需补强量化成果与细节`,
          "info"
        );
      }
      // 刷新统计数据
      const latest = await api.getWeakQuestions(statusFilter, roleFilter);
      setStats(latest.stats);
    } catch (err) {
      toast(err instanceof Error ? err.message : "再次评估失败", "error");
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleDelete(item: WeakQuestionItem) {
    try {
      await api.deleteWeakQuestion(item.id);
      toast("已移除该题目记录", "success");
      void loadList();
    } catch (err) {
      toast(err instanceof Error ? err.message : "删除失败", "error");
    }
  }

  return (
    <div className="page-container pb-16 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <p className="section-label mb-2">弱题复盘与出题偏好闭环</p>
          <h1 className="page-title text-3xl">攻克薄弱面试题，把每一次失分变成胜势</h1>
          <p className="page-subtitle mt-2 max-w-2xl">
            模拟面试中低于 70 分的回答将自动归入弱题本并默认下次再考；对照示范答案重练达标后自动转为「已掌握」，已掌握题仅在您勾选「下次再出」时以不同问法再现。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/interview" className="btn-primary !text-sm inline-flex items-center gap-1.5">
            <MicIcon size={16} />
            带着复考偏好去面试 →
          </Link>
        </div>
      </div>

      {/* 顶部统计看板 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-up">
        <div className="glass-card p-5 border-l-4 border-l-rose-500">
          <p className="text-xs font-semibold text-ink-muted">待攻克弱题 (&lt;70分)</p>
          <p className="font-display text-3xl font-extrabold text-rose-700 mt-1">
            {stats.weakCount}
          </p>
          <p className="text-[11px] text-ink-faint mt-1">默认加入下次模拟面试优先复考</p>
        </div>
        <div className="glass-card p-5 border-l-4 border-l-emerald-500">
          <p className="text-xs font-semibold text-ink-muted">已掌握题 (≥70分)</p>
          <p className="font-display text-3xl font-extrabold text-emerald-700 mt-1">
            {stats.masteredCount}
          </p>
          <p className="text-[11px] text-ink-faint mt-1">勾选「下次再出」可换问法再现</p>
        </div>
        <div className="glass-card p-5 border-l-4 border-l-cyan-500">
          <p className="text-xs font-semibold text-ink-muted">下次面试待复考</p>
          <p className="font-display text-3xl font-extrabold text-cyan-800 mt-1">
            {stats.nextExamCount}
          </p>
          <p className="text-[11px] text-ink-faint mt-1">与模拟面试出题引擎实时联动</p>
        </div>
        <div className="glass-card p-5 border-l-4 border-l-amber-500">
          <p className="text-xs font-semibold text-ink-muted">累计对照重练</p>
          <p className="font-display text-3xl font-extrabold text-amber-700 mt-1">
            {stats.totalPracticeCount} <span className="text-sm font-normal">次</span>
          </p>
          <p className="text-[11px] text-ink-faint mt-1">重练达标 70 分自动转为已掌握</p>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: "weak", label: `错题 / 弱题 (${stats.weakCount})` },
              { id: "all", label: `全部记录 (${stats.totalCount})` },
              { id: "mastered", label: `已掌握 (${stats.masteredCount})` },
              { id: "next_exam", label: `下次再考已开启 (${stats.nextExamCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === tab.id
                  ? "bg-cyan-700 text-white shadow-sm"
                  : "bg-slate-100 text-ink-muted hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input-field !py-1.5 !px-3 !text-xs !w-auto"
          >
            <option value="">全部面试官角色</option>
            <option value="technical">技术主管深挖官</option>
            <option value="hr">HR 初试官</option>
            <option value="pressure">业务总监压力面官</option>
            <option value="english">外企英文面试官</option>
          </select>
        </div>
      </div>

      {/* 列表内容 */}
      {loading ? (
        <div className="glass-card p-12 text-center text-sm text-ink-muted">
          正在加载弱题复盘记录...
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state py-16">
          <div className="empty-state-icon flex items-center justify-center">
            <TargetIcon size={44} className="text-cyan-600 opacity-70" />
          </div>
          <p className="font-display font-bold text-lg text-ink mb-1">
            {statusFilter === "weak" ? "太棒了！当前暂无待攻克弱题" : "暂无符合筛选条件的答题记录"}
          </p>
          <p className="text-sm text-ink-muted max-w-md mb-6">
            在模拟面试中作答后，系统会自动将每道题的评分、扣分说明与示范答案同步到这里，供您针对性复盘练习。
          </p>
          <div className="flex gap-3 justify-center">
            {statusFilter !== "all" && (
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className="btn-secondary !text-sm"
              >
                查看全部记录
              </button>
            )}
            <Link to="/interview" className="btn-primary !text-sm">
              去开启一场模拟面试
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const isWeak = item.status === "weak";
            const isPracticing = practicingId === item.id;
            const showModel = expandedModelIds[item.id] ?? isWeak;
            const practiceRes = practiceResults[item.id];

            return (
              <div
                key={item.id}
                className={`glass-card p-6 border-l-4 transition-all ${
                  isWeak ? "border-l-rose-500" : "border-l-emerald-500"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`tag ${isWeak ? "tag-danger" : "tag-success"}`}>
                        {isWeak ? "弱题待攻克" : "已掌握"}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                        {roleDisplay(item.interviewerRole)}
                      </span>
                      {item.targetJobTitle && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-800 font-medium">
                          岗位：{item.targetJobTitle}
                        </span>
                      )}
                      {item.practiceCount > 0 && (
                        <span className="text-xs text-amber-700 font-semibold">
                          已重练 {item.practiceCount} 次
                        </span>
                      )}
                    </div>
                    <h3 className="font-display font-bold text-lg text-ink leading-snug">
                      {item.question}
                    </h3>
                  </div>

                  {/* 下次是否再考联动开关 */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <label
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer select-none transition-colors ${
                        item.nextExamEnabled
                          ? "bg-cyan-50 border-cyan-300 text-cyan-900"
                          : "bg-slate-50 border-slate-200 text-ink-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.nextExamEnabled}
                        onChange={(e) => void handleToggleNextExam(item, e.target.checked)}
                        className="rounded border-slate-300 text-cyan-700 focus:ring-cyan-500"
                      />
                      <span>
                        {isWeak ? "下次面试优先再考" : "下次再出（换不同问法）"}
                      </span>
                    </label>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => void handleToggleMasteredStatus(item)}
                        className="text-cyan-700 hover:text-cyan-900 font-medium"
                      >
                        {isWeak ? "标记为已掌握" : "移回弱题本"}
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item)}
                        className="text-ink-faint hover:text-rose-600"
                      >
                        移除
                      </button>
                    </div>
                  </div>
                </div>

                {/* 四维得分与原回答 */}
                <div className="grid md:grid-cols-[auto_1fr] gap-5 items-start bg-slate-50/80 border border-slate-200/70 rounded-2xl p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <ScoreRing score={item.scoreOverall} label="综合分" size={72} />
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                        <span className="text-ink-faint">逻辑：</span>
                        <span className="font-bold text-ink">{item.scoreLogic}</span>
                      </div>
                      <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                        <span className="text-ink-faint">专业：</span>
                        <span className="font-bold text-ink">{item.scoreProfessional}</span>
                      </div>
                      <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                        <span className="text-ink-faint">匹配：</span>
                        <span className="font-bold text-ink">{item.scoreMatch}</span>
                      </div>
                      <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                        <span className="text-ink-faint">表达：</span>
                        <span className="font-bold text-ink">{item.scoreExpression}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 min-w-0">
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-1">上次作答记录</p>
                      <p className="text-sm text-ink-muted bg-white p-3 rounded-xl border border-slate-200/60 whitespace-pre-wrap leading-relaxed">
                        {item.lastAnswer || "（未作答）"}
                      </p>
                    </div>
                    {item.deductionNotes && (
                      <p className="text-xs text-rose-700 bg-rose-50/80 border border-rose-100 rounded-xl px-3 py-2 leading-relaxed whitespace-pre-wrap">
                        {item.deductionNotes}
                      </p>
                    )}
                  </div>
                </div>

                {/* 示范答案与对照练习操作栏 */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedModelIds((prev) => ({
                          ...prev,
                          [item.id]: !showModel,
                        }))
                      }
                      className="btn-secondary !text-xs !py-1.5 !px-3"
                    >
                      {showModel ? "收起示范答案" : "查看满分示范答案"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isPracticing) {
                          setPracticingId(null);
                        } else {
                          setPracticingId(item.id);
                          if (!practiceDrafts[item.id] && item.lastAnswer && item.lastAnswer !== "（本题跳过）") {
                            setPracticeDrafts((prev) => ({
                              ...prev,
                              [item.id]: item.lastAnswer || "",
                            }));
                          }
                        }
                      }}
                      className="btn-primary !text-xs !py-1.5 !px-3.5 inline-flex items-center gap-1"
                    >
                      <SparkleIcon size={14} />
                      {isPracticing ? "收起对照练习" : "对照重练并再次评估"}
                    </button>
                  </div>
                </div>

                {/* 示范答案展开区 */}
                {showModel && item.modelAnswer && (
                  <div className="mt-4 p-4 rounded-xl bg-cyan-50/70 border border-cyan-200/80">
                    <p className="text-xs font-bold text-cyan-900 mb-1.5">
                      满分示范回答（建议对照 STAR 四要素：背景 - 任务 - 你的行动 - 量化结果）
                    </p>
                    <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                      {item.modelAnswer}
                    </p>
                  </div>
                )}

                {/* 对照练习与再次评估抽屉 */}
                {isPracticing && (
                  <div className="mt-4 p-4 rounded-2xl bg-brand-50/50 border border-brand-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-brand-900">
                        对照重练 · 提交后 AI 将重新评分并回写掌握状态（≥70 分自动转为已掌握）
                      </p>
                      <span className="text-[11px] text-ink-faint">
                        {(practiceDrafts[item.id] ?? "").trim().length} 字
                      </span>
                    </div>
                    <textarea
                      rows={4}
                      value={practiceDrafts[item.id] ?? ""}
                      onChange={(e) =>
                        setPracticeDrafts((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      placeholder="对照上方示范答案与扣分项，重新组织你的回答（建议写清：当时业务背景 + 你独立负责的行动与技术取舍 + 最终可量化的数字指标）..."
                      className="textarea-field !bg-white !text-sm"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPracticingId(null)}
                        className="btn-secondary !text-xs !py-2 !px-3.5"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        disabled={submittingId === item.id}
                        onClick={() => void handleSubmitPractice(item)}
                        className="btn-primary !text-xs !py-2 !px-4"
                      >
                        {submittingId === item.id ? "正在重新评估..." : "提交并再次评估"}
                      </button>
                    </div>

                    {practiceRes && (
                      <div
                        className={`mt-3 p-4 rounded-xl border text-sm ${
                          practiceRes.masteredNow
                            ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                            : "bg-amber-50 border-amber-200 text-amber-950"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <p className="font-bold flex items-center gap-1.5">
                            <CheckIcon size={16} />
                            再次评估结果：{practiceRes.previousScore} 分 → {practiceRes.newScore} 分（
                            {practiceRes.scoreDelta >= 0
                              ? `+${practiceRes.scoreDelta}`
                              : practiceRes.scoreDelta}{" "}
                            分）
                          </p>
                          <span className={`tag ${practiceRes.masteredNow ? "tag-success" : "tag-warning"}`}>
                            {practiceRes.masteredNow ? "已达标 · 已回写为已掌握" : "仍需补强 (<70分)"}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed opacity-90">
                          {practiceRes.evaluation.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
