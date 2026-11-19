import { clearToken, getToken } from "./auth";

export function getBaseUrl(): string {
  return import.meta.env.VITE_API_BASE || "http://localhost:3002/api/v1";
}

interface CustomRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  data?: string | Record<string, unknown> | ArrayBuffer;
  header?: Record<string, string>;
}

function request<T>(path: string, options: CustomRequestOptions = {}): Promise<T> {
  const { method = "GET", data, header = {} } = options;
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...header,
  };
  if (token) headers.Authorization = "Bearer " + token;

  return new Promise((resolve, reject) => {
    uni.request({
      url: getBaseUrl() + path,
      method: method as UniApp.RequestOptions["method"],
      data,
      header: headers,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
          return;
        }
        if (res.statusCode === 401) clearToken();
        const body = res.data as { error?: string } | undefined;
        reject(new Error(body?.error || "请求失败"));
      },
      fail(err) {
        reject(new Error(err.errMsg || "网络错误"));
      },
    });
  });
}

export function uploadResume(
  filePath: string,
  formData: Record<string, string>
): Promise<ResumeUploadResult> {
  const token = getToken();
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: getBaseUrl() + "/resumes/upload",
      filePath,
      name: "file",
      formData,
      header: token ? { Authorization: "Bearer " + token } : {},
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(res.data as string));
          } catch {
            reject(new Error("响应解析失败"));
          }
          return;
        }
        try {
          const body = JSON.parse(res.data as string);
          reject(new Error(body.error || "上传失败"));
        } catch {
          reject(new Error("上传失败"));
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || "上传失败"));
      },
    });
  });
}

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  planTier?: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  description?: string;
}

export interface ResumeSections {
  contact?: string;
  summary?: string;
  advantage?: string;
  education?: string[];
  experience?: string[];
  skills?: string[];
  skill?: string[];
  projects?: string[];
  project?: string[];
  awards?: string[];
  award?: string[];
}

export interface ResumeItem {
  id: number;
  resumeTitle: string;
  targetJobTitle?: string | null;
  jobDescription?: string | null;
  scoreOverall?: number | null;
  scoreClarity?: number | null;
  scoreCompetitiveness?: number | null;
  scoreProfessionalism?: number | null;
  matchPercentage?: number | null;
  diagnosisReport?: string | null;
  parsedJson?: string | null;
  analysisStatus?: string;
}

export interface InterviewSession {
  id: number;
  status: string;
  startedAt?: string;
  totalDurationSec?: number;
  reportJson?: string | Record<string, unknown> | null;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface QuestionEvaluation {
  scoreLogic: number;
  scoreProfessional: number;
  scoreExpression: number;
  scoreMatch: number;
  scoreConfidence: number;
  feedback: string;
  modelAnswer: string;
  missedPoints?: string[];
  strengths?: string[];
}

export interface WeakQuestionRecordMeta {
  weakQuestionId: number | null;
  overallScore: number;
  status: "weak" | "mastered";
  nextExamEnabled: boolean;
  deductionNotes?: string;
}

export interface AnswerResult {
  evaluation?: QuestionEvaluation;
  weakQuestionRecord?: WeakQuestionRecordMeta | null;
  nextQuestion: string | null;
  isComplete: boolean;
}

export interface WeakQuestionItem {
  id: number;
  question: string;
  lastAnswer: string | null;
  modelAnswer: string | null;
  interviewerRole: string | null;
  targetJobTitle: string | null;
  scoreOverall: number;
  scoreLogic: number;
  scoreProfessional: number;
  scoreMatch: number;
  scoreExpression: number;
  deductionNotes: string | null;
  status: "weak" | "mastered";
  nextExamEnabled: boolean;
  practiceCount: number;
}

export interface WeakQuestionStats {
  totalCount: number;
  weakCount: number;
  masteredCount: number;
  nextExamCount: number;
  totalPracticeCount: number;
}

export interface SessionReport {
  scoreLogic?: number;
  scoreProfessional?: number;
  scoreExpression?: number;
  scoreMatch?: number;
  scoreConfidence?: number;
  feedbackSummary?: string;
  questionReviews?: Array<{
    question: string;
    answer: string;
    evaluation?: {
      feedback?: string;
      modelAnswer?: string;
      scoreLogic?: number;
      scoreProfessional?: number;
      scoreMatch?: number;
      scoreExpression?: number;
    };
  }>;
}

export interface ResumeUploadResult {
  resume?: ResumeItem;
  diagnosis?: {
    scoreOverall?: number;
    scoreClarity?: number;
    scoreCompetitiveness?: number;
    scoreProfessionalism?: number;
    diagnosisReport?: string;
  };
  grammarCheck?: {
    scoreGrammar?: number;
    grammarIssues?: string[];
  };
  jdMatch?: { matchPercentage?: number };
}

export interface PaymentPlan {
  id: string;
  name: string;
  priceLabel: string;
}

export interface PaymentOrder {
  id: number;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      data: { email, password },
    }),
  register: (email: string, password: string, displayName: string) =>
    request<{ token: string; user: AuthUser }>("/auth/register", {
      method: "POST",
      data: { email, password, displayName },
    }),
  getMe: () => request<{ user: AuthUser }>("/user/me"),
  uploadResume,
  getResumes: () => request<ResumeItem[]>("/resumes"),
  getResume: (id: number) => request<ResumeItem>("/resumes/" + id),
  patchResume: (
    id: number,
    data: { parsedJson?: object; resumeTitle?: string; targetJobTitle?: string }
  ) =>
    request<ResumeItem>("/resumes/" + id, {
      method: "PATCH",
      data,
    }),
  getRoles: () => request<CatalogItem[]>("/interviews/roles"),
  getIndustries: () => request<CatalogItem[]>("/interviews/industries"),
  getEnterpriseCompanies: () =>
    request<CatalogItem[]>("/interviews/enterprise/companies"),
  startEnterpriseSession: (payload: { companyId: string; resumeId?: number }) =>
    request<{ session: InterviewSession; openingQuestion: string }>(
      "/interviews/enterprise/sessions",
      { method: "POST", data: payload }
    ),
  getSession: (sessionId: number) =>
    request<{ session: InterviewSession; messages: ChatMessage[] }>(
      "/interviews/sessions/" + sessionId
    ),
  startSession: (payload: {
    resumeId: number;
    interviewerRole: string;
    industry?: string;
    targetJobTitle?: string;
    experienceYears?: string;
    durationMinutes?: number;
    jobDescription?: string;
    mode: "text";
  }) =>
    request<{ session: InterviewSession; openingQuestion: string }>(
      "/interviews/sessions",
      { method: "POST", data: payload }
    ),
  swapQuestion: (sessionId: number, excludedQuestions: string[] = []) =>
    request<{ question: string; messageId: number }>(
      "/interviews/sessions/" + sessionId + "/swap-question",
      { method: "POST", data: { excludedQuestions } }
    ),
  submitAnswer: (sessionId: number, answer: string, elapsedSec: number) =>
    request<AnswerResult>("/interviews/sessions/" + sessionId + "/answer", {
      method: "POST",
      data: { answer, messageType: "text", elapsedSec },
    }),
  endSession: (sessionId: number, durationSec: number) =>
    request<{ session: InterviewSession; report: SessionReport }>(
      "/interviews/sessions/" + sessionId + "/end",
      { method: "POST", data: { durationSec } }
    ),
  getWeakQuestions: (status = "all", role = "") =>
    request<{ items: WeakQuestionItem[]; stats: WeakQuestionStats }>(
      `/interviews/weak-questions?status=${encodeURIComponent(status)}&role=${encodeURIComponent(role)}`
    ),
  updateWeakQuestion: (
    id: number,
    data: { nextExamEnabled?: boolean; status?: "weak" | "mastered" }
  ) =>
    request<{ item: WeakQuestionItem }>("/interviews/weak-questions/" + id, {
      method: "PATCH",
      data,
    }),
  practiceWeakQuestion: (id: number, answer: string) =>
    request<{
      item: WeakQuestionItem;
      evaluation: QuestionEvaluation;
      previousScore: number;
      newScore: number;
      scoreDelta: number;
      masteredNow: boolean;
    }>("/interviews/weak-questions/" + id + "/practice", {
      method: "POST",
      data: { answer },
    }),
  deleteWeakQuestion: (id: number) =>
    request<{ ok: boolean }>("/interviews/weak-questions/" + id, {
      method: "DELETE",
    }),
  getPaymentPlans: () => request<{ plans: PaymentPlan[] }>("/payments/plans"),
  checkoutPlan: (planId: string) =>
    request<{ order: PaymentOrder }>("/payments/checkout", {
      method: "POST",
      data: { planId },
    }),
  confirmPayment: (orderId: number) =>
    request<unknown>("/payments/confirm/" + orderId, { method: "POST" }),
};
