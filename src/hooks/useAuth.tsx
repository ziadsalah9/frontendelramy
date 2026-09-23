import React, { createContext, useContext, useState } from 'react';
import { User, LoginResponse, UserRole } from '../types';
import { setToken, clearToken, setStoredUser, getStoredUser } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (data: LoginResponse) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
    // 1️⃣ طباعة البيانات القادمة من الباك إند كما هي
    console.log('🔴 API Response Received:', data);

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

    // 2️⃣ طباعة البيانات بعد تحويلها وتجهيزها للحفظ
    console.log('🟢 Processed User Object:', userData);

    setToken(data.token);
    setStoredUser(JSON.stringify(userData));

    setTokenState(data.token);
    setUser(userData);
  };

  const logout = () => {
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
// import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
// import type { AuthUser } from '@/types';
// import { getToken, clearToken, getStoredUser } from '@/api/client';

// interface AuthContextValue {
//   user: AuthUser | null;
//   isAuthenticated: boolean;
//   setUser: (user: AuthUser | null) => void;
//   logout: () => void;
// }

// const AuthContext = createContext<AuthContextValue | null>(null);

// export function AuthProvider({ children }: { children: ReactNode }) {
//   const [user, setUserState] = useState<AuthUser | null>(null);

//   useEffect(() => {
//     const token = getToken();
//     const stored = getStoredUser();
//     if (token && stored) {
//       try {
//         setUserState(JSON.parse(stored));
//       } catch {
//         clearToken();
//       }
//     }
//   }, []);

//   const setUser = (u: AuthUser | null) => {
//     setUserState(u);
//     if (!u) clearToken();
//   };

//   const logout = () => {
//     clearToken();
//     setUserState(null);
//     window.location.href = '/login';
//   };

//   return (
//     <AuthContext.Provider value={{ user, isAuthenticated: !!getToken(), setUser, logout }}>
//       {children}
//     </AuthContext.Provider>
//   );
// }

// export function useAuth() {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error('useAuth must be used within AuthProvider');
//   return ctx;
// }
