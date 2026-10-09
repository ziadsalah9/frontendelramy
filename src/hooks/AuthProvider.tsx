import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, LoginResponse, UserRole } from '../types';
import { setToken, clearToken, setStoredUser, getStoredUser } from '../api/client';
import { AuthContext } from './useAuth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('mafroshat_token'));

  const [user, setUser] = useState<User | null>(() => {
    const saved = getStoredUser();
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.role) {
        const roleStr = String(parsed.role).toUpperCase();
        parsed.role = roleStr.includes('ADMIN') ? 'ADMIN' : 'EMPLOYEE';
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const login = (data: LoginResponse) => {
    // Normalise the role from the login response. The backend sends a
    // plain enum name ("ADMIN" / "EMPLOYEE"), but older payloads used a
    // different casing or a "roles" field, so match on the substring.
    const rawRole = data.role ? String(data.role).toUpperCase() : '';
    const normalizedRole: UserRole = rawRole.includes('ADMIN') ? 'ADMIN' : 'EMPLOYEE';

    const userData: User = {
      id: data.userId,
      username: data.username,
      fullName: data.fullName,
      role: normalizedRole,
      active: true,
      branchId: data.branchId ?? undefined,
      branchName: data.branchName ?? undefined,
    };

    queryClient.clear();
    setToken(data.token);
    setStoredUser(JSON.stringify(userData));

    setTokenState(data.token);
    setUser(userData);
  };

  const logout = () => {
    // Drop every cached response: the next user on this tab (maybe an
    // employee) must not see the previous admin's data, e.g. cost prices.
    queryClient.clear();
    clearToken();
    setTokenState(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
