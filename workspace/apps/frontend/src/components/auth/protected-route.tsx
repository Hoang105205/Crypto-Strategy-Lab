'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../../contexts/auth-context';

/**
 * Wraps protected pages — redirects to /login if unauthenticated.
 * Shows a loading spinner while auth state is being determined.
 *
 * See: kb/contracts/auth.yaml §frontend, ADR-0015
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas-dark">
        <div className="text-body-secondary">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
