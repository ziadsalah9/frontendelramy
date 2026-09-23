import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getToken, clearToken, getStoredUser } from '@/api/client';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth();
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    const stored = getStoredUser();
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      } catch {
        clearToken();
        return <Navigate to="/login" replace />;
      }
    } else {
      clearToken();
      return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
}
