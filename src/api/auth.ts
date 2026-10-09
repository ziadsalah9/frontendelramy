import api from './client';
import type { LoginRequest, LoginResponse, AuthUser } from '@/types';
import { setStoredUser } from './client';

// Persisting the token/user is AuthProvider.login's job; this only talks
// to the API.
export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/api/auth/login', credentials);
    return data;
  },

  /** Changes the signed-in user's own password; returns a fresh login (the old token stops working). */
  async changePassword(currentPassword: string, newPassword: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/api/auth/change-password', { currentPassword, newPassword });
    return data;
  },

  async getCurrentUser(): Promise<AuthUser> {
    const { data } = await api.get<AuthUser>('/api/auth/me');
    setStoredUser(JSON.stringify(data));
    return data;
  },
};
