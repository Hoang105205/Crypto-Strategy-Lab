'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/auth-context';
import { apiClient } from '../../services/api-client';

/**
 * Far-right user profile section of the top navigation bar.
 *
 * Shows the current Supabase user's display name / email and a "Log Out" action
 * inside an accessible dropdown. Logout calls POST /api/auth/logout best-effort,
 * then supabase.auth.signOut() (the authoritative session invalidation), then
 * redirects to /login.
 *
 * See: kb/contracts/auth.yaml, kb/DESIGN.md ({component.top-nav-dark}),
 *      sdd_artifacts/current-user-display-logout (spec/plan/contracts)
 */

const DISPLAY_NAME_KEYS = ['display_name', 'name', 'full_name'] as const;

/** Pick the first present, non-empty display-name candidate from user_metadata. */
function pickDisplayName(metadata: Record<string, unknown>): string | null {
  for (const key of DISPLAY_NAME_KEYS) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

/** Up to two initials — from the display name when present, else the email local-part. */
function getInitials(displayName: string | null, email: string): string {
  if (displayName) {
    const parts = displayName.split(/\s+/).filter(Boolean);
    const initials = parts
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('');
    if (initials) return initials.toUpperCase();
  }
  const local = email.split('@')[0] ?? email;
  return (local.slice(0, 2) || '?').toUpperCase();
}

export function UserNavSection() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on outside click or Escape (only while open).
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  // Session still resolving — render a placeholder, never the logged-out state (US1 AS-2).
  if (loading) {
    return (
      <div
        data-testid="user-nav-placeholder"
        role="status"
        aria-label="Loading account"
        className="flex items-center gap-2 px-2 py-1.5"
      >
        <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-surface-elevated" />
        <span className="hidden h-3 w-24 animate-pulse rounded bg-surface-elevated sm:block" />
      </div>
    );
  }

  // Anonymous (incl. /login, /register) — render nothing (US1 AS-3, FR-003).
  if (!user) return null;

  const email = user.email ?? '';
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const displayName = pickDisplayName(metadata);
  const primaryLabel = displayName ?? email;
  const initials = getInitials(displayName, email);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      // Best-effort acknowledgement; a 401/5xx/network failure must never block logout.
      await apiClient.logout();
    } catch {
      // Graceful degradation (FR-009): fall through to local sign-out + redirect.
    }
    await signOut();
    router.replace('/login');
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Account menu for ${email}`}
        data-testid="user-nav-toggle"
        className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-sm font-semibold text-body">
          {initials}
        </span>
        <span className="hidden min-w-0 max-w-[160px] flex-col items-start leading-tight sm:flex">
          <span className="w-full truncate text-sm font-semibold text-body">
            {primaryLabel}
          </span>
          {displayName && email && (
            <span className="w-full truncate text-xs text-muted">{email}</span>
          )}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Account menu"
          data-testid="user-nav-menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-hairline-dark bg-surface-card shadow-xl"
        >
          <div className="border-b border-hairline-dark px-4 py-3">
            <p className="truncate text-sm font-semibold text-body">
              {primaryLabel}
            </p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={isLoggingOut}
            data-testid="user-nav-logout"
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-body transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-info disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="h-4 w-4 shrink-0 text-muted"
            >
              <path
                d="M7.5 16.25H4.375A.625.625 0 013.75 15.625V4.375a.625.625 0 01.625-.625H7.5M13.75 12.5L16.25 10l-2.5-2.5M16.25 10H7.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {isLoggingOut ? 'Logging out...' : 'Log Out'}
          </button>
        </div>
      )}
    </div>
  );
}
