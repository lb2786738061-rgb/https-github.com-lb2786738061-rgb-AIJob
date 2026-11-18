import { clearToken, getToken } from "./auth";

export function getBaseUrl(): string {
  return import.meta.env.VITE_API_BASE || "http://localhost:3002/api/v1";
}

function request<T>(path: string, options: UniApp.RequestOptions = {}): Promise<T> {
  const { method = "GET", data, header = {} } = options;
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(header as Record<string, string>),
  };
  if (token) headers.Authorization = "Bearer " + token;

  return new Promise((resolve, reject) => {
    uni.request({
      url: getBaseUrl() + path,
      method,
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

export interface AnswerResult {
  nextQuestion: string | null;
  isComplete: boolean;
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
    evaluation?: { feedback?: string };
  }>;
}

export interface ResumeUploadResult {
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
  getMe: () =>
    request<{ user: AuthUser }>("/user/me"),
  getRoles: () => request<CatalogItem[]>("/interviews/roles"),
  getIndustries: () => request<CatalogItem[]>("/interviews/industries"),
  getEnterpriseCompanies: () =>
    request<CatalogItem[]>("/interviews/enterprise/companies"),
  startEnterpriseSession: (payload: { companyId: string }) =>
    request<{ session: InterviewSession; openingQuestion: string }>(
      "/interviews/enterprise/sessions",
      { method: "POST", data: payload }
    ),
  getSession: (sessionId: number) =>
    request<{ session: InterviewSession; messages: ChatMessage[] }>(
      "/interviews/sessions/" + sessionId
    ),
  startSession: (payload: {
    interviewerRole: string;
    industry?: string;
    mode: "text";
  }) =>
    request<{ session: InterviewSession; openingQuestion: string }>(
      "/interviews/sessions",
      { method: "POST", data: payload }
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
  getPaymentPlans: () => request<{ plans: PaymentPlan[] }>("/payments/plans"),
  checkoutPlan: (planId: string) =>
    request<{ order: PaymentOrder }>("/payments/checkout", {
      method: "POST",
      data: { planId },
    }),
  confirmPayment: (orderId: number) =>
    request<unknown>("/payments/confirm/" + orderId, { method: "POST" }),
};
