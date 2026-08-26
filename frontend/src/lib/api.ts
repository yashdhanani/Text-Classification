/**
 * NeuralText — Typed API Client
 * Axios-based client with JWT refresh, error normalization, and TypeScript types.
 */
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_V1 = `${API_URL}/api/v1`;

// ── Token storage helpers ─────────────────────────────────────────────────────
const TOKEN_KEY = "nt_access_token";
const REFRESH_KEY = "nt_refresh_token";

export const tokenStorage = {
  getAccess: () => (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null),
  getRefresh: () => (typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null),
  setTokens: (access: string, refresh: string) => {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// ── Axios instance ────────────────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: API_V1,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// Request interceptor — attach token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — refresh on 401
let _refreshing = false;
let _queue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (_refreshing) {
        return new Promise((resolve, reject) => {
          _queue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      _refreshing = true;
      try {
        const refresh = tokenStorage.getRefresh();
        if (!refresh) throw new Error("No refresh token");

        const { data } = await axios.post(`${API_V1}/auth/refresh`, { refresh_token: refresh });
        tokenStorage.setTokens(data.access_token, data.refresh_token);
        _queue.forEach((q) => q.resolve(data.access_token));
        _queue = [];
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch (refreshError) {
        _queue.forEach((q) => q.reject(refreshError));
        _queue = [];
        tokenStorage.clear();
        if (typeof window !== "undefined") window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        _refreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ── API Functions ─────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; username: string; full_name: string; password: string }) =>
    api.post("/auth/register", data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data).then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
  logout: (refresh_token: string) => api.post("/auth/logout", { refresh_token }),
  forgotPassword: (email: string) => api.post("/auth/forgot-password", { email }),
  resetPassword: (token: string, new_password: string) =>
    api.post("/auth/reset-password", { token, new_password }),
};

export const projectsApi = {
  list: () =>
    api
      .get("/projects")
      .then((r) => (Array.isArray(r.data) ? r.data : (r.data?.items ?? []))),
  create: (data: { name: string; description?: string; task_type: string }) =>
    api.post("/projects", data).then((r) => r.data),
  get: (id: string) => api.get(`/projects/${id}`).then((r) => r.data),
  update: (id: string, data: object) => api.put(`/projects/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

export const datasetsApi = {
  upload: (formData: FormData) =>
    api.post("/datasets/upload", formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data),
  list: (projectId?: string) =>
    api.get("/datasets", { params: projectId ? { project_id: projectId } : {} }).then((r) => r.data),
  get: (id: string) => api.get(`/datasets/${id}`).then((r) => r.data),
  preview: (id: string, rows = 50) => api.get(`/datasets/${id}/preview`, { params: { rows } }).then((r) => r.data),
  stats: (id: string) => api.get(`/datasets/${id}/stats`).then((r) => r.data),
  split: (id: string, config: object) => api.post(`/datasets/${id}/split`, config).then((r) => r.data),
};

export const trainingApi = {
  createJob: (data: object) => api.post("/training/jobs", data).then((r) => r.data),
  listJobs: (projectId?: string) =>
    api.get("/training/jobs", { params: projectId ? { project_id: projectId } : {} }).then((r) => r.data),
  getJob: (id: string) => api.get(`/training/jobs/${id}`).then((r) => r.data),
  cancelJob: (id: string) => api.post(`/training/jobs/${id}/cancel`),
};

export const modelsApi = {
  list: (projectId?: string) =>
    api.get("/models", { params: projectId ? { project_id: projectId } : {} }).then((r) => r.data),
  get: (id: string) => api.get(`/models/${id}`).then((r) => r.data),
  versions: (id: string) => api.get(`/models/${id}/versions`).then((r) => r.data),
  deploy: (id: string, stage: string, versionId?: string) =>
    api.post(`/models/${id}/deploy`, null, { params: { stage, version_id: versionId } }).then((r) => r.data),
  predict: (id: string, data: { text: string; include_explanation?: boolean }) =>
    api.post(`/models/${id}/predict`, data).then((r) => r.data),
  compare: (versionIds: string[]) =>
    api.post("/models/compare", { model_version_ids: versionIds }).then((r) => r.data),
  batchPredict: (data: object) => api.post(`/models/batch-predict`, data).then((r) => r.data),
};

export const predictApi = {
  predict: (data: { model_id: string; text: string; include_explanation?: boolean }) =>
    api.post("/predict", data).then((r) => r.data),
};

export const apiKeysApi = {
  list: () => api.get("/api-keys").then((r) => r.data),
  create: (data: { name: string; rate_limit_per_minute?: number }) =>
    api.post("/api-keys", data).then((r) => r.data),
  revoke: (id: string) => api.delete(`/api-keys/${id}`),
};

export const dashboardApi = {
  stats: () => api.get("/dashboard/stats").then((r) => r.data),
};

// ── WebSocket helpers ─────────────────────────────────────────────────────────
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export function createTrainingWebSocket(jobId: string, onMessage: (data: object) => void): WebSocket {
  const ws = new WebSocket(`${WS_URL}/api/v1/training/jobs/${jobId}/ws`);
  ws.onmessage = (evt) => {
    try { onMessage(JSON.parse(evt.data)); } catch { /* ignore */ }
  };
  return ws;
}

export function createBatchWebSocket(jobId: string, onMessage: (data: object) => void): WebSocket {
  const ws = new WebSocket(`${WS_URL}/api/v1/models/batch/${jobId}/ws`);
  ws.onmessage = (evt) => {
    try { onMessage(JSON.parse(evt.data)); } catch { /* ignore */ }
  };
  return ws;
}
