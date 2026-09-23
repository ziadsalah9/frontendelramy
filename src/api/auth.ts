import api from './client';
import type { LoginRequest, LoginResponse, AuthUser, UserRole } from '@/types';
import { setToken, setStoredUser } from './client';

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function extractUserFromToken(token: string, fallback?: Partial<AuthUser>): AuthUser {
  const decoded = decodeJwt(token);
  const role = (decoded?.['role'] as string) || (decoded?.['roles'] as string) || fallback?.role || 'EMPLOYEE';
  return {
    id: Number(decoded?.['id'] ?? decoded?.['sub'] ?? fallback?.id ?? 0),
    username: String(decoded?.['username'] ?? decoded?.['sub'] ?? fallback?.username ?? ''),
    fullName: String(decoded?.['fullName'] ?? decoded?.['name'] ?? fallback?.fullName ?? decoded?.['username'] ?? decoded?.['sub'] ?? ''),
    role: (role as UserRole) ?? 'EMPLOYEE',
    branchId: decoded?.['branchId'] ? Number(decoded['branchId']) : fallback?.branchId,
    active: true,
  };
}

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/api/auth/login', credentials);
    setToken(data.token);

    let user = data.user;
    if (!user) {
      user = extractUserFromToken(data.token);
    }
    setStoredUser(JSON.stringify(user));

    return { ...data, user };
  },
  async getCurrentUser(): Promise<AuthUser> {
    const { data } = await api.get<AuthUser>('/api/auth/me');
    setStoredUser(JSON.stringify(data));
    return data;
  },
};
