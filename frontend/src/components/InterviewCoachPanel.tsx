import type { InterviewHint, QuestionEvaluation, TechAgendaItem } from "../api/client";
import ScoreRing from "./ScoreRing";

const STAR_LABELS: { key: keyof NonNullable<QuestionEvaluation["starCoverage"]>; name: string }[] = [
  { key: "situation", name: "背景" },
  { key: "task", name: "任务" },
  { key: "action", name: "行动" },
  { key: "result", name: "结果" },
];

interface InterviewCoachPanelProps {
  evaluation: QuestionEvaluation | null;
  hint: InterviewHint | null;
  hintLoading: boolean;
  onHint: () => void;
  onSkip: () => void;
  disableActions: boolean;
  currentTech?: TechAgendaItem | null;
}

export default function InterviewCoachPanel({
  evaluation,
  hint,
  hintLoading,
  onHint,
  onSkip,
  disableActions,
  currentTech,
}: InterviewCoachPanelProps) {
  return (
    <aside className="coach-panel">
      {currentTech && (
        <div className="mb-3 p-3 rounded-xl bg-brand-50 border border-brand-100">
          <p className="text-[11px] text-ink-faint mb-0.5">本题考点</p>
          <p className="text-sm font-semibold text-brand-800">
            {currentTech.tech} · {currentTech.label}
          </p>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">当场教练</p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onHint}
            disabled={disableActions || hintLoading}
            className="btn-ghost !text-xs !px-2.5 !py-1"
          >
            {hintLoading ? "提纲生成中" : "要提纲"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={disableActions}
            className="btn-ghost !text-xs !px-2.5 !py-1 text-ink-muted"
          >
            跳过本题
          </button>
        </div>
      </div>

      {evaluation ? (
        <>
          <div className="grid grid-cols-4 gap-1 mb-4">
            <ScoreRing score={evaluation.scoreLogic} label="逻辑" size={58} />
            <ScoreRing score={evaluation.scoreProfessional} label="专业" size={58} />
            <ScoreRing score={evaluation.scoreExpression} label="表达" size={58} />
            <ScoreRing score={evaluation.scoreConfidence} label="自信" size={58} />
          </div>
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
              <p className="text-xs text-ink-faint mb-1">缺口</p>
              <ul className="space-y-1">
                {evaluation.missedPoints.map((item) => (
                  <li key={item} className="text-xs text-red-700">· {item}</li>
                ))}
              </ul>
            </div>
          )}
          {!!evaluation.strengths?.length && (
            <div className="mb-3">
              <p className="text-xs text-ink-faint mb-1">亮点</p>
              <ul className="space-y-1">
                {evaluation.strengths.map((item) => (
                  <li key={item} className="text-xs text-brand-800">· {item}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-muted leading-relaxed mb-4">
          先按 STAR 讲完这一题。提交后这里会立刻拆你的结构、缺口和下一刀追问。
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
