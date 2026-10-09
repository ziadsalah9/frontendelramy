import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Guards pages whose whole API surface is ADMIN-only.
 *
 * Hiding the sidebar link is convenience, not security - this is what
 * actually stops an employee from navigating straight to the URL. The
 * backend enforces it too, so this is about not showing a page that
 * could only ever show errors.
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}