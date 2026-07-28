const API_BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("ep_token");
}

export function setToken(token: string): void {
  localStorage.setItem("ep_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("ep_token");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  opts: { allowStatuses?: number[] } = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok && !opts.allowStatuses?.includes(res.status)) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  auth: {
    signup: (email: string, password: string, name: string, consentAccepted: boolean) =>
      request<{ message: string }>("/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, name, consentAccepted }),
      }),
    login: (email: string, password: string) =>
      request<{ token: string; user: { id: string; email: string; name: string | null } } | { error: string; message?: string }>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }, { allowStatuses: [403] }),
    logout: () => request("/v1/auth/logout", { method: "POST" }),
    google: (credential: string) =>
      request<{ token: string; user: { id: string; email: string; name: string | null }; isNewUser?: boolean }>("/v1/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential }),
      }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request("/v1/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  },

  users: {
    me: () => request<Record<string, unknown>>("/v1/users/me"),
    update: (data: Record<string, unknown>) =>
      request("/v1/users/me", { method: "PATCH", body: JSON.stringify(data) }),
    completeOnboarding: (data: Record<string, unknown>) =>
      request("/v1/users/me/onboarding", { method: "POST", body: JSON.stringify(data) }),
    markWelcomeSeen: () =>
      request("/v1/users/me", { method: "PATCH", body: JSON.stringify({ hasSeenWelcome: true }) }),
    export: async () => {
      const token = getToken();
      const res = await fetch(`${API_BASE}/v1/users/me/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "gravitas-data-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    deleteAccount: () =>
      request<{ message: string }>("/v1/users/me", { method: "DELETE" }),
    recordConsent: () =>
      request<Record<string, unknown>>("/v1/users/me/consent", {
        method: "POST",
        body: JSON.stringify({ consentAccepted: true }),
      }),
  },

  sessions: {
    create: (data: { mode: string; promptText?: string; promptType?: string; recordingContext?: string }) =>
      request<{ id: string; mode: string; processingStatus: string }>("/v1/sessions", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    list: () => request<{ sessions: SessionSummary[] }>("/v1/sessions"),
    get: (id: string) => request<SessionDetail>(`/v1/sessions/${id}`),
    delete: (id: string) => request(`/v1/sessions/${id}`, { method: "DELETE" }),
    upload: (id: string, data: UploadData & { audioBlob?: Blob; videoFrames?: string[] }) => {
      const form = new FormData();
      if (data.audioBlob) {
        const t = data.audioBlob.type;
        const ext = t.includes("wav") ? "wav" : t.includes("mp4") || t.includes("m4a") ? "mp4" : t.includes("ogg") ? "ogg" : "webm";
        form.append("audio", data.audioBlob, `recording.${ext}`);
      }
      if (data.durationSeconds != null) form.append("durationSeconds", String(data.durationSeconds));
      if (data.audioGapEvents != null) form.append("audioGapEvents", String(data.audioGapEvents));
      if (data.faceLostEvents != null) form.append("faceLostEvents", String(data.faceLostEvents));
      if (data.silenceEvents != null) form.append("silenceEvents", String(data.silenceEvents));
      if (data.videoFrames && data.videoFrames.length > 0) {
        form.append("videoFrames", JSON.stringify(data.videoFrames));
      }
      const token = getToken();
      const controller = new AbortController();
      const uploadTimeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);
      return fetch(`${API_BASE}/v1/sessions/${id}/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
        signal: controller.signal,
      }).then(async res => {
        clearTimeout(uploadTimeout);
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
      }).catch(err => {
        clearTimeout(uploadTimeout);
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("Upload timed out — your connection may be slow or the file is too large. Please try again.");
        }
        throw err;
      });
    },
    status: (id: string) =>
      request<{ id: string; processingStatus: string; processingError?: string; transcript?: string | null }>(`/v1/sessions/${id}/status`),
    generateMotivationalMessage: (id: string) =>
      request<{ message: string }>(`/v1/sessions/${id}/motivational-message`, { method: "POST" }),
    progress: () => request<{ sessions: SessionSummary[] }>("/v1/sessions/progress"),
    chart: () => request<{ sessions: ChartSession[] }>("/v1/sessions/chart"),
    testAudio: () => request("/v1/sessions/test-audio", { method: "POST" }),
    testVideo: () => request("/v1/sessions/test-video", { method: "POST" }),
  },

  prompts: {
    list: (category?: string) =>
      request<{ prompts: Prompt[] }>(`/v1/prompts${category ? `?category=${category}` : ""}`),
    random: (category?: string) =>
      request<Prompt>(`/v1/prompts/random${category ? `?category=${category}` : ""}`),
  },
};

export interface SessionSummary {
  id: string;
  mode: string;
  methodologyVersion: string;
  promptText: string | null;
  promptType: string | null;
  recordingContext: string | null;
  durationSeconds: number | null;
  compositeScore: string | null;
  compositeTier: string | null;
  processingStatus: string;
  createdAt: string;
  scoredAt: string | null;
}

export interface DimensionScore {
  id: string;
  sessionId: string;
  dimensionKey: string;
  score: number;
  tier: string;
  rawMetrics: Record<string, unknown> | null;
  strengthText: string | null;
  gapText: string | null;
  nextStepText: string | null;
}

export interface SessionDetail extends SessionSummary {
  dimensionScores: DimensionScore[];
  transcript: string | null;
  audioQualityFlag: boolean | null;
  faceCoverageFlag: boolean | null;
  audioGapEvents: number | null;
  faceLostEvents: number | null;
  silenceEvents: number | null;
  overallFeedback: string | null;
  processingError: string | null;
}

export interface UploadData {
  audioGapEvents?: number;
  faceLostEvents?: number;
  silenceEvents?: number;
  videoDownloaded?: boolean;
  durationSeconds?: number;
  transcript?: string;
}

export interface ChartSession {
  id: string;
  createdAt: string;
  compositeScore: string | null;
  compositeTier: string | null;
  promptText: string | null;
  mode: string;
  dimensions: Record<string, number>;
}

export interface Prompt {
  id: string;
  category: string;
  text: string;
  recommendedDurationSeconds: number;
  sector?: string;
}
