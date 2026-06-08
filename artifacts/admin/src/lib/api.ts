const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE.replace(/\/admin$/, "")}/api`;

function clearAuthAndRedirect() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_user");
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  window.location.href = `${base}/login`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("admin_token");
  const res = await fetch(`${API}${path}`, {
    cache: "no-store", // bypass browser HTTP cache so admin data is always fresh
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearAuthAndRedirect();
    }
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; name: string | null; isAdmin: boolean };
}

export function login(email: string, password: string) {
  return request<AuthResponse>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export interface AdminStats {
  totalUsers: number;
  totalSessions: number;
  completedSessions: number;
  avgCompositeScore: number | null;
  totalRecordingSeconds: number;
  audioSessions: number;
  videoSessions: number;
}

export function getStats() {
  return request<AdminStats>("/v1/admin/stats");
}

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  roleTitle: string | null;
  communicationContext: string | null;
  onboardingCompleted: boolean;
  totalRecordingSeconds: number;
  notifyOnUpgrade: boolean;
  isAdmin: boolean;
  createdAt: string;
  completedSessions: number;
  avgScore: number | null;
}

export function getUsers() {
  return request<{ users: UserRow[] }>("/v1/admin/users");
}

export interface SessionRow {
  id: string;
  userId: string;
  mode: string;
  promptText: string | null;
  promptType: string | null;
  durationSeconds: number | null;
  compositeScore: number | null;
  compositeTier: string | null;
  processingStatus: string;
  createdAt: string;
  scoredAt: string | null;
}

export interface UserDetail {
  user: UserRow & { goal: string | null; defaultRecordingContext: string | null; emailSummaries: boolean; updatedAt: string };
  sessions: SessionRow[];
}

export function getUserDetail(id: string) {
  return request<UserDetail>(`/v1/admin/users/${id}`);
}

export interface DimensionScore {
  id: string;
  dimensionKey: string;
  score: number;
  tier: string;
  strengthText: string | null;
  gapText: string | null;
  nextStepText: string | null;
  rawMetrics: Record<string, unknown> | null;
}

export interface SessionDetail {
  session: SessionRow & { transcript: string | null; overallFeedback: string | null; recordingContext: string | null };
  user: { id: string; email: string; name: string | null };
  dimensionScores: DimensionScore[];
}

export function getSessionDetail(id: string) {
  return request<SessionDetail>(`/v1/admin/sessions/${id}`);
}

export function patchUser(id: string, data: { isAdmin?: boolean }) {
  return request<{ id: string; email: string; isAdmin: boolean }>(`/v1/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteUser(id: string) {
  return request<{ deleted: boolean; id: string; email: string }>(`/v1/admin/users/${id}`, {
    method: "DELETE",
  });
}
