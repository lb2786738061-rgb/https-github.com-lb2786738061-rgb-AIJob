import { Link } from "react-router-dom";
import type { EnterpriseCompany, InterviewSession } from "../api/client";
import { interviewerRoleLabel } from "../lib/interviewDisplay";

const DIFFICULTY_NAMES: Record<string, string> = {
  easy: "热身",
  standard: "标准",
  hard: "终面",
};

function sessionScore(session: InterviewSession): number | null {
  const values = [
    session.scoreLogic,
    session.scoreProfessional,
    session.scoreExpression,
    session.scoreMatch,
    session.scoreConfidence,
  ].filter((n): n is number => n != null);
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

interface SessionHistoryProps {
  sessions: InterviewSession[];
  companies?: Pick<EnterpriseCompany, "id" | "name">[];
}

export default function SessionHistory({ sessions, companies = [] }: SessionHistoryProps) {
  const completed = sessions.filter((s) => s.status === "completed");

  if (completed.length === 0) return null;

  return (
    <div className="glass-card p-5">
      <h3 className="font-display font-semibold text-sm mb-3 text-ink">历史面试记录</h3>
      <ul className="space-y-1">
        {completed.slice(0, 10).map((s) => {
          const score = sessionScore(s);
          return (
          <li key={s.id}>
            <Link
              to={`/interview/${s.id}/report`}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-brand-50 text-sm transition-colors group"
            >
              <span className="text-ink-muted group-hover:text-ink">
                {interviewerRoleLabel(s.interviewerRole, { companies })}
                {s.difficulty && DIFFICULTY_NAMES[s.difficulty] ? (
                  <span className="text-ink-faint ml-1">· {DIFFICULTY_NAMES[s.difficulty]}</span>
                ) : null}
                <span className="text-ink-faint ml-2">
                  {new Date(s.startedAt).toLocaleDateString("zh-CN")}
                </span>
              </span>
              {score != null && (
                <span className="font-display font-bold text-brand-700">{score}分</span>
              )}
            </Link>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
