import axios, { type AxiosError } from 'axios';
import type { BillingStatus, UsageData, AdminStats, AdminUser, AdminJob } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api',
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.replace('/login');
    }
    return Promise.reject(error);
  },
);

// ── Billing ──────────────────────────────────────────────────────────────────

export const billingApi = {
  getStatus: () => api.get<BillingStatus>('/billing/status'),
  createCheckoutSession: (priceId: string) =>
    api.post<{ checkoutUrl: string }>('/billing/create-checkout-session', { price_id: priceId }),
  createPortalSession: () =>
    api.post<{ portalUrl: string }>('/billing/create-portal-session'),
};

// ── Usage ─────────────────────────────────────────────────────────────────────

export const usageApi = {
  get: () => api.get<UsageData>('/reunions/usage'),
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const adminApi = {
  getStats: () => api.get<AdminStats>('/admin/stats'),
  getUsers: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<AdminUser[]>('/admin/users', { params }),
  getUser: (id: number) => api.get<AdminUser>(`/admin/users/${id}`),
  overridePlan: (id: number, planTier: string) =>
    api.patch(`/admin/users/${id}/plan`, { plan_tier: planTier }),
  resetUsage: (id: number) => api.post(`/admin/users/${id}/reset-usage`),
  getJobs: (params?: { page?: number; limit?: number }) =>
    api.get<AdminJob[]>('/admin/jobs', { params }),
};

// ── Profile ───────────────────────────────────────────────────────────────────

export const profileApi = {
  update: (body: {
    nom?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }) =>
    api.patch<{ nom: string; email: string; token: string | null }>('/auth/profile', body),
};

// ── Tools ─────────────────────────────────────────────────────────────────────

const toolsAxios = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api',
  timeout: 600_000, // 10 min — audio/video can be large
});

toolsAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

toolsAxios.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.replace('/login');
    }
    return Promise.reject(error);
  },
);

export const toolsApi = {
  audioToText: (file: File, onProgress?: (pct: number) => void) => {
    const fd = new FormData();
    fd.append('file', file);
    return toolsAxios.post<{ text: string; language: string }>('/tools/audio-to-text', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total ?? 1))),
    });
  },
  videoToText: (file: File, onProgress?: (pct: number) => void) => {
    const fd = new FormData();
    fd.append('file', file);
    return toolsAxios.post<{ text: string; language: string }>('/tools/video-to-text', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total ?? 1))),
    });
  },
  pdfToText: (file: File, onProgress?: (pct: number) => void) =>
    toolsAxios.post<{ text: string; page_count: number; remaining_today: number | null }>(
      '/tools/pdf-to-text',
      (() => { const fd = new FormData(); fd.append('file', file); return fd; })(),
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total ?? 1))),
      },
    ),
  pdfToTextStatus: () =>
    toolsAxios.get<{ unlimited: boolean; remaining_today: number | null; limit: number | null }>(
      '/tools/pdf-to-text/status',
    ),
  translatePdf: (file: File, targetLanguage: string, onProgress?: (pct: number) => void) => {
    const fd = new FormData();
    fd.append('file', file);
    return toolsAxios.post<{ translated_text: string; source_language: string }>(
      `/tools/translate-pdf?target_language=${targetLanguage}`,
      fd,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total ?? 1))),
      },
    );
  },
};

export default api;
