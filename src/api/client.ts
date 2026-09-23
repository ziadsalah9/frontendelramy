import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import type { ApiError } from '@/types';

//export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://trial-sprite-b3gfu.sprites.app/';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8086';
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
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;

    if (status === 401) {
      clearToken();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (status === 403) {
      toast.error('ليس لديك صلاحية للقيام بهذا الإجراء');
    }

    return Promise.reject(error);
  }
);

// --- Error Extraction Utility ---
export function extractApiError(error: unknown): ApiError {
  const axiosError = error as AxiosError<{ message?: string; errors?: Record<string, string>; error?: string }>;
  const status = axiosError.response?.status ?? 0;

  let message = 'حدث خطأ غير متوقع';
  let fieldErrors: Record<string, string> | undefined;

  if (status === 0) {
    message = 'تعذر الاتصال بالخادم. تأكد من تشغيل الخادم على المنفذ 8086';
  } else if (status === 400) {
    message = axiosError.response?.data?.message ?? 'البيانات المدخلة غير صحيحة';
    fieldErrors = axiosError.response?.data?.errors;
  } else if (status === 401) {
    message = 'اسم المستخدم أو كلمة المرور غير صحيحة';
  } else if (status === 403) {
    message = 'لا تملك صلاحية للوصول إلى هذا المورد';
  } else if (status === 404) {
    message = 'المورد المطلوب غير موجود';
  } else if (status >= 500) {
    message = 'حدث خطأ في الخادم. حاول مرة أخرى لاحقاً';
  } else if (axiosError.response?.data?.message) {
    message = axiosError.response.data.message;
  } else if (axiosError.response?.data?.error) {
    message = axiosError.response.data.error;
  }

  return { message, status, fieldErrors };
}

export default apiClient;
// import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
// import type { ApiError } from '@/types';

// export const API_BASE_URL = 'http://localhost:8086';

// const TOKEN_KEY = 'mafroshat_token';
// const USER_KEY = 'mafroshat_user';

// export function getToken(): string | null {
//   return localStorage.getItem(TOKEN_KEY);
// }

// export function setToken(token: string): void {
//   localStorage.setItem(TOKEN_KEY, token);
// }

// export function clearToken(): void {
//   localStorage.removeItem(TOKEN_KEY);
//   localStorage.removeItem(USER_KEY);
// }

// export function getStoredUser(): string | null {
//   return localStorage.getItem(USER_KEY);
// }

// export function setStoredUser(user: string): void {
//   localStorage.setItem(USER_KEY, user);
// }

// const api = axios.create({
//   baseURL: API_BASE_URL,
//   headers: { 'Content-Type': 'application/json' },
//   timeout: 30000,
// });

// api.interceptors.request.use(
//   (config: InternalAxiosRequestConfig) => {
//     const token = getToken();
//     if (token && config.headers) {
//       config.headers.Authorization = `Bearer ${token}`;
//     }
//     return config;
//   },
//   (error) => Promise.reject(error)
// );

// api.interceptors.response.use(
//   (response) => response,
//   (error: AxiosError) => {
//     if (error.response?.status === 401) {
//       clearToken();
//       if (window.location.pathname !== '/login') {
//         window.location.href = '/login';
//       }
//     }
//     return Promise.reject(error);
//   }
// );

// export function extractApiError(error: unknown): ApiError {
//   const axiosError = error as AxiosError<{ message?: string; errors?: Record<string, string>; error?: string }>;
//   const status = axiosError.response?.status ?? 0;

//   let message = 'حدث خطأ غير متوقع';
//   let fieldErrors: Record<string, string> | undefined;

//   if (status === 0) {
//     message = 'تعذر الاتصال بالخادم. تأكد من تشغيل الخادم على المنفذ 8086';
//   } else if (status === 400) {
//     message = axiosError.response?.data?.message ?? 'البيانات المدخلة غير صحيحة';
//     fieldErrors = axiosError.response?.data?.errors;
//   } else if (status === 401) {
//     message = 'اسم المستخدم أو كلمة المرور غير صحيحة';
//   } else if (status === 403) {
//     message = 'لا تملك صلاحية للوصول إلى هذا المورد';
//   } else if (status === 404) {
//     message = 'المورد المطلوب غير موجود';
//   } else if (status >= 500) {
//     message = 'حدث خطأ في الخادم. حاول مرة أخرى لاحقاً';
//   } else if (axiosError.response?.data?.message) {
//     message = axiosError.response.data.message;
//   } else if (axiosError.response?.data?.error) {
//     message = axiosError.response.data.error;
//   }

//   return { message, status, fieldErrors };
// }

// export default api;
