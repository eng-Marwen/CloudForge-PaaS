import axios from "axios";
import type { AppRecord, ApplicationForm, ApplicationUpdate, DeploymentStatus, User } from "../pages/types";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

export default api;

export type AuthResponse = { user: User; expiresAt: string };

export const backendApi = {
  health: () => api.get<{ status: string; service: string }>("/health"),
  auth: {
    register: (payload: { username: string; email: string; password: string; confirmPassword: string; phoneNumber?: string }) =>
      api.post<AuthResponse>("/auth/register", payload),
    login: (payload: { email: string; password: string }) =>
      api.post<AuthResponse>("/auth/login", payload),
    logout: () => api.post<{ message: string }>("/auth/logout"),
    deleteAccount: () => api.delete<{ message: string }>("/auth/delete"),
    me: () => api.get<{ user: User }>("/auth/me"),
    updateProfile: (payload: { username?: string; phoneNumber?: string | null }) =>
      api.patch<AuthResponse>("/auth/profile", payload),
  },
  apps: {
    list: (status?: DeploymentStatus) =>
      api.get<{ apps: AppRecord[] }>("/apps", {
        params: status === undefined ? undefined : { status },
      }),
    get: (id: number) => api.get<{ app: AppRecord }>(`/apps/${id}`),
    create: (payload: ApplicationForm) => api.post<{ app: AppRecord }>("/apps", payload),
    update: (id: number, payload: ApplicationUpdate) =>
      api.patch<{ app: AppRecord }>(`/apps/${id}`, payload),
    remove: (id: number) => api.delete(`/apps/${id}`),
  },
};

export function getApiError(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
}
