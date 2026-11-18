export function filenameStem(name: string | null | undefined): string {
  return (name || "").replace(/\.[^.]+$/, "").trim();
}

export function resumeOptionLabel(resume: {
  resumeTitle?: string | null;
  originalFileName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}): string {
  const title = (resume.resumeTitle || "我的简历").trim();
  const file = filenameStem(resume.originalFileName);
  const stamp = formatResumeDate(resume.updatedAt || resume.createdAt);
  const generic = !title || title === "我的简历";
  const main = generic && file ? file : title;
  return stamp ? `${main} · ${stamp}` : main;
}

function formatResumeDate(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
