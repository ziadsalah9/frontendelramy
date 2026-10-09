import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '@/types';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8090';
const TOKEN_KEY = 'mafroshat_token';
const USER_KEY = 'mafroshat_user';

// --- Auth Storage Helpers ---
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): string | null {
  return localStorage.getItem(USER_KEY);
}

export function setStoredUser(user: string): void {
  localStorage.setItem(USER_KEY, user);
}

// --- Axios Instance Setup ---
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// --- Request Interceptor ---
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Response Interceptor ---
// Only session expiry is handled globally. Every other error is reported
// once, by the page that made the request, via extractApiError - a global
// toast here would show the same failure twice.
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearToken();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// --- Error Extraction Utility ---
// The backend error body is { timestamp, status, error, message }. Its
// `message` is the useful part for 400/404/409, so prefer it there.
export function extractApiError(error: unknown): ApiError {
  const axiosError = error as AxiosError<{ message?: string; errors?: Record<string, string>; error?: string }>;
  const status = axiosError.response?.status ?? 0;
  const serverMessage = axiosError.response?.data?.message;

  let message = 'حدث خطأ غير متوقع';
  let fieldErrors: Record<string, string> | undefined;

  if (status === 0) {
    message = axiosError.code === 'ECONNABORTED'
      ? 'انتهت مهلة الاتصال بالخادم. حاول مرة أخرى'
      : 'تعذر الاتصال بالخادم. تحقق من الاتصال بالشبكة وحاول مرة أخرى';
  } else if (status === 400) {
    message = serverMessage ?? 'البيانات المدخلة غير صحيحة';
    fieldErrors = axiosError.response?.data?.errors;
  } else if (status === 401) {
    message = 'اسم المستخدم أو كلمة المرور غير صحيحة';
  } else if (status === 403) {
    message = axiosError.response?.data?.error === 'Account Disabled'
      ? 'هذا الحساب معطل. تواصل مع مدير النظام'
      : 'ليس لديك صلاحية للقيام بهذا الإجراء';
  } else if (status === 404) {
    message = serverMessage ?? 'المورد المطلوب غير موجود';
  } else if (status === 409) {
    message = serverMessage && serverMessage !== 'Duplicate record'
      ? serverMessage
      : 'هذا السجل موجود بالفعل';
  } else if (status >= 500) {
    message = 'حدث خطأ في الخادم. حاول مرة أخرى لاحقاً';
  } else if (serverMessage) {
    message = serverMessage;
  } else if (axiosError.response?.data?.error) {
    message = axiosError.response.data.error;
  }

  return { message, status, fieldErrors };
}

export default apiClient;

/** Optional inclusive yyyy-MM-dd range for list endpoints. */
export interface DateRangeParams {
  from?: string;
  to?: string;
}

/** Drops empty ends so the server treats them as open. */
export const cleanRange = (r: DateRangeParams) =>
  Object.fromEntries(Object.entries(r).filter(([, v]) => v)) as DateRangeParams;
