import type {
  InterviewHint,
  QuestionEvaluation,
  TechAgendaItem,
  WeakQuestionRecordMeta,
} from "../api/client";
import ScoreRing from "./ScoreRing";

const STAR_LABELS: { key: keyof NonNullable<QuestionEvaluation["starCoverage"]>; name: string }[] = [
  { key: "situation", name: "背景" },
  { key: "task", name: "任务" },
  { key: "action", name: "行动" },
  { key: "result", name: "结果" },
];

interface InterviewCoachPanelProps {
  evaluation: QuestionEvaluation | null;
  weakRecord?: WeakQuestionRecordMeta | null;
  onToggleNextExam?: (nextExam: boolean) => void;
  hint: InterviewHint | null;
  hintLoading: boolean;
  onHint: () => void;
  onSwapQuestion?: () => void;
  swappingQuestion?: boolean;
  onSkip: () => void;
  disableActions: boolean;
  currentTech?: TechAgendaItem | null;
}

export default function InterviewCoachPanel({
  evaluation,
  weakRecord,
  onToggleNextExam,
  hint,
  hintLoading,
  onHint,
  onSwapQuestion,
  swappingQuestion = false,
  onSkip,
  disableActions,
  currentTech,
}: InterviewCoachPanelProps) {
  return (
    <aside className="coach-panel overflow-y-auto">
      {currentTech && (
        <div className="mb-3 p-3 rounded-xl bg-brand-50 border border-brand-100">
          <p className="text-[11px] text-ink-faint mb-0.5">本题考点</p>
          <p className="text-sm font-semibold text-brand-800">
            {currentTech.tech} · {currentTech.label}
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">当场教练</p>
        <div className="flex flex-wrap gap-1">
          {onSwapQuestion && (
            <button
              type="button"
              onClick={onSwapQuestion}
              disabled={disableActions || swappingQuestion}
              className="btn-ghost !text-xs !px-2 !py-1 text-cyan-700 font-semibold"
              title="当前未作答题目可更换切入角度"
            >
              {swappingQuestion ? "换题中..." : "换一题"}
            </button>
          )}
          <button
            type="button"
            onClick={onHint}
            disabled={disableActions || hintLoading}
            className="btn-ghost !text-xs !px-2 !py-1"
          >
            {hintLoading ? "提纲生成中" : "要提纲"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={disableActions}
            className="btn-ghost !text-xs !px-2 !py-1 text-ink-muted"
          >
            跳过
          </button>
        </div>
      </div>

      {evaluation ? (
        <>
          <div className="grid grid-cols-4 gap-1 mb-3">
            <ScoreRing score={evaluation.scoreLogic} label="逻辑" size={56} />
            <ScoreRing score={evaluation.scoreProfessional} label="专业" size={56} />
            <ScoreRing score={evaluation.scoreMatch} label="匹配" size={56} />
            <ScoreRing score={evaluation.scoreExpression} label="表达" size={56} />
          </div>

          {weakRecord && (
            <div
              className={`mb-3 p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                weakRecord.status === "weak"
                  ? "bg-rose-50/80 border-rose-200 text-rose-800"
                  : "bg-emerald-50/80 border-emerald-200 text-emerald-800"
              }`}
            >
              <div className="min-w-0">
                <span className="font-bold">
                  {weakRecord.status === "weak"
                    ? `综合 ${weakRecord.overallScore}分 · 已入弱题复盘本`
                    : `综合 ${weakRecord.overallScore}分 · 本题已掌握`}
                </span>
                <p className="text-[11px] opacity-80 mt-0.5">
                  {weakRecord.status === "weak"
                    ? "弱题默认下次面试优先复考"
                    : "勾选后下次面试将以不同问法再现"}
                </p>
              </div>
              {onToggleNextExam && (
                <label className="inline-flex items-center gap-1 cursor-pointer shrink-0 font-semibold select-none">
                  <input
                    type="checkbox"
                    checked={weakRecord.nextExamEnabled}
                    onChange={(e) => onToggleNextExam(e.target.checked)}
                    className="rounded border-slate-300 text-cyan-700 focus:ring-cyan-500"
                  />
                  <span>下次再出</span>
                </label>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 mb-3">
            {STAR_LABELS.map((item) => {
              const hit = Boolean(evaluation.starCoverage?.[item.key]);
              return (
                <span key={item.key} className={`star-chip ${hit ? "star-chip-on" : ""}`}>
                  {hit ? "✓" : "○"} {item.name}
                </span>
              );
            })}
          </div>
          <p className="text-sm text-ink leading-relaxed mb-3">{evaluation.feedback}</p>
          {evaluation.followUpHint && (
            <p className="text-xs text-accent-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
              下一刀：{evaluation.followUpHint}
            </p>
          )}
          {!!evaluation.missedPoints?.length && (
            <div className="mb-3">
              <p className="text-xs text-ink-faint mb-1 font-semibold">扣分说明</p>
              <ul className="space-y-1">
                {evaluation.missedPoints.map((item) => (
                  <li key={item} className="text-xs text-red-700">· {item}</li>
                ))}
              </ul>
            </div>
          )}
          {!!evaluation.strengths?.length && (
            <div className="mb-3">
              <p className="text-xs text-ink-faint mb-1 font-semibold">本轮亮点</p>
              <ul className="space-y-1">
                {evaluation.strengths.map((item) => (
                  <li key={item} className="text-xs text-brand-800">· {item}</li>
                ))}
              </ul>
            </div>
          )}
          {evaluation.modelAnswer && (
            <div className="mb-3 p-3 rounded-xl bg-cyan-50/70 border border-cyan-100">
              <p className="text-xs font-bold text-cyan-800 mb-1">示范回答</p>
              <p className="text-xs text-ink-muted leading-relaxed whitespace-pre-wrap">
                {evaluation.modelAnswer}
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-muted leading-relaxed mb-4">
          先按 STAR 讲完这一题。对当前题不满意可点击上方「换一题」，提交后将实时展示评分、扣分说明与示范回答。
        </p>
      )}

      {hint && (
        <div className="mt-2 pt-3 border-t border-border">
          <p className="text-xs font-semibold text-ink mb-2">答题提纲</p>
          <p className="text-[11px] text-ink-faint mb-2">{hint.warning}</p>
          <ul className="space-y-1.5 text-xs text-ink-muted">
            <li><span className="text-ink font-medium">背景</span> {hint.starOutline.situation}</li>
            <li><span className="text-ink font-medium">任务</span> {hint.starOutline.task}</li>
            <li><span className="text-ink font-medium">行动</span> {hint.starOutline.action}</li>
            <li><span className="text-ink font-medium">结果</span> {hint.starOutline.result}</li>
          </ul>
          {!!hint.talkingPoints.length && (
            <ul className="mt-2 space-y-1">
              {hint.talkingPoints.map((point) => (
                <li key={point} className="text-xs text-brand-800">· {point}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
