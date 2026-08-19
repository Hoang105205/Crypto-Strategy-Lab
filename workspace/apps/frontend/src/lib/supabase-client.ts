'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase browser client for frontend auth.
 * Uses cookie-based sessions (HttpOnly) compatible with Next.js App Router.
 *
 * See: kb/contracts/auth.yaml §frontend, ADR-0015
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
