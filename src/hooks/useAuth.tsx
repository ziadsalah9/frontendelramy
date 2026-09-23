import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthUser } from '@/types';
import { getToken, clearToken, getStoredUser } from '@/api/client';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (token && stored) {
      try {
        setUserState(JSON.parse(stored));
      } catch {
        clearToken();
      }
    }
  }, []);

  const setUser = (u: AuthUser | null) => {
    setUserState(u);
    if (!u) clearToken();
  };

  const logout = () => {
    clearToken();
    setUserState(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!getToken(), setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
