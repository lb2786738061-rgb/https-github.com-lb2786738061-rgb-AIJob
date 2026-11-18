import type { EnterpriseCompany, InterviewRole, InterviewStage } from "../api/client";

const ROLE_NAMES: Record<string, string> = {
  hr: "HR 初试官",
  technical: "技术主管深挖官",
  pressure: "业务总监压力面官",
  english: "外企英文面试官",
};

const HR_STAGES = [
  { id: "opening", name: "开场破冰" },
  { id: "core", name: "核心深挖" },
  { id: "pressure", name: "压力追问" },
  { id: "close", name: "收尾确认" },
];

const TECH_STAGES = [
  { id: "opening", name: "技术落地" },
  { id: "core", name: "原理深挖" },
  { id: "pressure", name: "故障极限" },
  { id: "close", name: "收尾确认" },
];

export function enterpriseCompanyId(role: string): string | null {
  if (!role.startsWith("enterprise:")) return null;
  return role.slice("enterprise:".length);
}

export function interviewerRoleLabel(
  role: string,
  extras?: {
    roles?: InterviewRole[];
    companies?: Pick<EnterpriseCompany, "id" | "name">[];
  }
): string {
  const companyId = enterpriseCompanyId(role);
  if (companyId) {
    const company = extras?.companies?.find((item) => item.id === companyId);
    return company ? `${company.name}名企冲刺` : "名企冲刺";
  }
  return extras?.roles?.find((item) => item.id === role)?.name ?? ROLE_NAMES[role] ?? role;
}

export function stageTrack(
  role: string,
  current?: Pick<InterviewStage, "id" | "name"> | null
): { id: string; name: string }[] {
  const technical = role === "technical" || role.startsWith("enterprise:");
  const steps = technical ? TECH_STAGES : HR_STAGES;
  return steps.map((step) =>
    current?.id === step.id ? { ...step, name: current.name } : step
  );
}

export function industryDisplayName(
  industryId: string | null | undefined,
  industries: { id: string; name: string }[]
): string | null {
  if (!industryId) return null;
  return industries.find((item) => item.id === industryId)?.name ?? industryId;
}
