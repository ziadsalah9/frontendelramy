import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getToken } from '@/api/client';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const token = getToken();

  // لو مفيش توكن ارجع لصفحة اللوجن
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // الـ AuthProvider بيقرأ الـ user أوتوماتيك من localStorage
  // لو مفيش يوزر بعد قراءة التوكن ارجع للوجن
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}