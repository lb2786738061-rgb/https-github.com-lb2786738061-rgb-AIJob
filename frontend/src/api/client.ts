const API_BASE = "/api/v1";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  if (options?.headers) {
    Object.assign(headers, options.headers);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

export const api = {
  getHealth: () =>
    fetch("/api/health").then(async (res) => {
      if (!res.ok) throw new Error("Health check failed");
      return res.json() as Promise<{ status: string; llmEnabled: boolean }>;
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: { id: number; email: string; displayName: string } }>(
      "/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }
    ),

  register: (email: string, password: string, displayName: string) =>
    request<{ token: string; user: { id: number; email: string; displayName: string } }>(
      "/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      }
    ),

  getMe: () =>
    request<{
      user: { id: number; displayName: string; planTier: string; email: string };
      quota: QuotaStatus;
      llmEnabled: boolean;
    }>("/user/me"),

  getEnterpriseCompanies: () => request<EnterpriseCompany[]>("/interviews/enterprise/companies"),

  startEnterpriseSession: (data: { companyId: string; resumeId?: number }) =>
    request<{
      session: InterviewSession;
      company: { id: string; name: string };
      openingQuestion: string;
    }>("/interviews/enterprise/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  getVoiceStatus: () =>
    request<{ websocketPath: string; relayEnabled?: boolean }>("/voice/status"),

  getPaymentPlans: () => request<{ plans: Plan[] }>("/payments/plans"),
  checkoutPlan: (planId: string) =>
    request<{ order: PaymentOrder; plan: Plan; paymentHint: string }>("/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    }),
  confirmPayment: (orderId: number) =>
    request<{ order: PaymentOrder; message: string }>(`/payments/confirm/${orderId}`, {
      method: "POST",
    }),
  getPaymentOrders: () => request<{ orders: PaymentOrder[] }>("/payments/orders"),

  getResumes: () => request<Resume[]>("/resumes"),
  getResume: (id: number) => request<Resume>(`/resumes/${id}`),
  getResumeFile: async (id: number): Promise<Blob> => {
    const headers: Record<string, string> = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const res = await fetch(`${API_BASE}/resumes/${id}/file`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Request failed");
    }
    return res.blob();
  },
  getResumePreview: async (id: number): Promise<string> => {
    const headers: Record<string, string> = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const res = await fetch(`${API_BASE}/resumes/${id}/preview`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Request failed");
    }
    return res.text();
  },
  uploadResume: (formData: FormData) =>
    request<UploadResult>("/resumes/upload", { method: "POST", body: formData }),
  analyzeResume: (id: number, data: { jobDescription?: string; targetJobTitle?: string }) =>
    request<UploadResult>(`/resumes/${id}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  patchResume: (id: number, data: { parsedJson?: object; resumeTitle?: string }) =>
    request<Resume>(`/resumes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  deleteResume: (id: number) =>
    request<{ ok: boolean }>(`/resumes/${id}`, { method: "DELETE" }),
  starRewrite: (
    id: number,
    data: { original: string; situation: string; task: string; action: string; result: string }
  ) =>
    request<{ rewritten: string }>(`/resumes/${id}/star-rewrite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  enhanceResume: (
    id: number,
    data: {
      mode: "quantify" | "jd_tailor" | "comprehensive";
      targetJobTitle?: string;
      jobDescription?: string;
      parsed?: ParsedResume;
    }
  ) =>
    request<EnhanceResumeResult>(`/resumes/${id}/enhance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  beautifyResume: (
    id: number,
    data: {
      templateId?: string;
      targetJobTitle?: string;
      jobDescription?: string;
      parsed?: ParsedResume;
    }
  ) =>
    request<BeautifyResumeResult>(`/resumes/${id}/beautify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),


  getInterviewRoles: () => request<InterviewRole[]>("/interviews/roles"),
  getInterviewDifficulties: () =>
    request<InterviewDifficulty[]>("/interviews/difficulties"),
  getIndustries: () => request<Industry[]>("/interviews/industries"),
  getSessions: () => request<InterviewSession[]>("/interviews/sessions"),
  getSession: (id: number) =>
    request<{
      session: InterviewSession;
      messages: InterviewMessage[];
      stage?: InterviewStage;
      maxQuestions?: number;
      techAgenda?: TechAgendaItem[];
      currentTech?: TechAgendaItem | null;
    }>(`/interviews/sessions/${id}`),
  startSession: (data: StartSessionPayload) =>
    request<StartSessionResult>("/interviews/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  submitAnswer: (
    sessionId: number,
    answer: string,
    messageType?: string,
    elapsedSec?: number,
    extra?: { skipped?: boolean }
  ) =>
    request<AnswerResult>(`/interviews/sessions/${sessionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer, messageType, elapsedSec, skipped: extra?.skipped }),
    }),
  getInterviewHint: (sessionId: number) =>
    request<InterviewHint>(`/interviews/sessions/${sessionId}/hint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
  endSession: (sessionId: number, durationSec: number) =>
    request<{ session: InterviewSession; report: SessionReport }>(
      `/interviews/sessions/${sessionId}/end`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSec }),
      }
    ),
  uploadRecording: (sessionId: number, blob: Blob) => {
    const fd = new FormData();
    fd.append("recording", blob, "recording.webm");
    return request<{ recordingUrl: string }>(`/interviews/sessions/${sessionId}/recording`, {
      method: "POST",
      body: fd,
    });
  },
};

export interface QuotaStatus {
  planTier: string;
  resumeDiagnosisUsed: number;
  mockInterviewUsed: number;
  reanalyzeUsed: number;
  enterpriseCredits: number;
  resumeDiagnosisLimit: number | null;
  mockInterviewLimit: number | null;
  mockInterviewMaxSec: number | null;
}

export interface Plan {
  id: string;
  name: string;
  planType?: string;
  priceCents: number;
  priceLabel: string;
  durationDays?: number | null;
  features: string[];
  recommended?: boolean;
}

export interface PaymentOrder {
  id: number;
  planType: string;
  amountCents: number;
  status: string;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface EnterpriseCompany {
  id: string;
  name: string;
  industry: string;
  description: string;
}

export interface Resume {
  id: number;
  resumeTitle: string;
  targetJobTitle: string | null;
  jobDescription: string | null;
  originalFileName?: string | null;
  storedFilePath?: string | null;
  fileMimeType?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  scoreOverall: number | null;
  scoreClarity: number | null;
  scoreCompetitiveness: number | null;
  scoreMatch: number | null;
  scoreProfessionalism: number | null;
  matchPercentage: number | null;
  missingKeywords: string | null;
  jdMatchReport: string | null;
  diagnosisReport: string | null;
  starSuggestions: string | null;
  parsedJson: string | null;
  analysisStatus?: string;
}

export interface StructuredResumeEntry {
  org: string;
  role: string;
  date: string | null;
  bullets: string[];
  isSubLevel?: boolean;
}

export interface StructuredResumeLayout {
  name: string;
  contact: { text: string }[];
  summary?: string;
  experience: StructuredResumeEntry[];
  projects: StructuredResumeEntry[];
  education: StructuredResumeEntry[];
  skills: { groups: { label?: string; items: string[] }[] };
}

export interface ParsedResume {
  rawText: string;
  sections: {
    contact?: string;
    summary?: string;
    education: string[];
    experience: string[];
    skills: string[];
    projects: string[];
  };
  layout?: StructuredResumeLayout;
}

export interface GrammarCheck {
  scoreGrammar: number;
  grammarIssues: string[];
  grammarReport: string;
}

export interface UploadResult {
  resume: Resume;
  diagnosis: unknown;
  jdMatch: unknown;
  starRewrite: { suggestions: StarSuggestion[]; summary: string };
  grammarCheck?: GrammarCheck;
  analysisStatus?: string;
  analysisSource?: "llm" | "rule_based";
}

export interface StarSuggestion {
  original: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  rewritten: string;
}

export interface InterviewRole {
  id: string;
  name: string;
  description: string;
  focus?: string[];
}

export interface InterviewDifficulty {
  id: string;
  name: string;
  description: string;
}

export interface InterviewStage {
  id: string;
  name: string;
  goal: string;
  fromQ: number;
  toQ: number;
  index: number;
  total: number;
}

export interface TechAgendaItem {
  index: number;
  tech: string;
  techId?: string;
  dimension: string;
  label: string;
}

export interface Industry {
  id: string;
  name: string;
}

export interface InterviewSession {
  id: number;
  interviewerRole: string;
  industry: string | null;
  mode: string;
  status: string;
  questionCount: number | null;
  scoreLogic: number | null;
  scoreProfessional: number | null;
  scoreExpression: number | null;
  scoreMatch: number | null;
  scoreConfidence: number | null;
  feedbackSummary: string | null;
  reportJson: string | null;
  startedAt: string;
  endedAt: string | null;
  totalDurationSec: number | null;
  difficulty?: string | null;
  targetJobTitle?: string | null;
  resumeId?: number | null;
}

export interface InterviewMessage {
  id: number;
  role: string;
  content: string;
  messageType: string;
  scoreJson: string | null;
  createdAt: string;
}

export interface StartSessionPayload {
  resumeId?: number;
  interviewerRole: string;
  industry?: string;
  mode?: "text" | "voice";
  difficulty?: string;
  targetJobTitle?: string;
}

export interface StartSessionResult {
  session: InterviewSession;
  openingQuestion: string;
  maxQuestions: number;
  maxDurationSec: number | null;
  stage?: InterviewStage;
  difficulty?: string;
  targetJobTitle?: string;
  techAgenda?: TechAgendaItem[];
  currentTech?: TechAgendaItem | null;
}

export interface AnswerResult {
  evaluation: QuestionEvaluation;
  nextQuestion: string | null;
  questionCount: number;
  isComplete: boolean;
  maxQuestions: number;
  elapsedSec: number;
  stage?: InterviewStage;
  skipped?: boolean;
  techAgenda?: TechAgendaItem[];
  currentTech?: TechAgendaItem | null;
}

export interface StarCoverage {
  situation: boolean;
  task: boolean;
  action: boolean;
  result: boolean;
}

export interface QuestionEvaluation {
  scoreLogic: number;
  scoreProfessional: number;
  scoreExpression: number;
  scoreMatch: number;
  scoreConfidence: number;
  feedback: string;
  modelAnswer: string;
  starCoverage?: StarCoverage;
  missedPoints?: string[];
  strengths?: string[];
  followUpHint?: string;
  keywordsHit?: string[];
}

export interface InterviewHint {
  starOutline: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  talkingPoints: string[];
  warning: string;
}

export interface TranscriptSegment {
  text: string;
  isFiller: boolean;
}

export interface ReportVerdict {
  id: string;
  label: string;
  detail: string;
}

export interface SessionReport {
  scoreLogic: number;
  scoreProfessional: number;
  scoreExpression: number;
  scoreMatch: number;
  scoreConfidence: number;
  overallScore?: number;
  verdict?: ReportVerdict;
  feedbackSummary: string;
  strengths?: string[];
  weaknesses?: string[];
  practicePlan?: string[];
  starCoverage?: Record<string, number>;
  questionReviews: {
    question: string;
    answer: string;
    evaluation: QuestionEvaluation;
  }[];
  transcript?: {
    fullTranscript: string;
    segments: TranscriptSegment[];
    fillerCount: number;
  };
  recordingUrl?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface EnhanceResumeResult {
  enhancedSections: ParsedResume["sections"];
  improvements: string[];
  mode: string;
  source?: "llm" | "rule_based";
  tokenUsage?: TokenUsage | null;
}

export interface BeautifyResumeResult {
  parsed: ParsedResume;
  improvements: string[];
  source: "llm" | "rule_based";
  tokenUsage: TokenUsage | null;
}

