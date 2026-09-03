# Implementation Plan: Current User Display and Logout

**Feature**: `current-user-display-logout` | **Date**: 2026-09-02 | **Spec**: spec.md

## Summary
Add a far-right **user profile section** to the existing `AppShell` top navigation that shows the current Supabase user's display name/email, with a **Log Out** action that (1) calls a new JWT-guarded backend endpoint `POST /api/auth/logout`, (2) runs `supabase.auth.signOut()` to clear the cookie session/refresh token, and (3) redirects to `/login`. This is a monolith addition spanning the **Auth** module (backend endpoint) and the **Frontend shell** (nav component + api-client method). No new module, no new Prisma model, no new ADR.

## Technical Context
**Language/Version**: TypeScript — NestJS 11.x (backend), Next.js 16.3.x App Router + React 19 (frontend)
**Primary Dependencies**: `@supabase/ssr` (FE cookie session), `@supabase/supabase-js` (BE token verify), `@nestjs/common`, `next/navigation`
**Storage**: None — Auth owns no Prisma tables (Supabase manages `auth.users`); this feature adds no schema
**Testing**: Jest (backend unit) + Vitest/`@testing-library/react` (frontend unit)
**Target Platform**: Web (modular monolith); FE↔BE via REST only
**Project Type**: web-app (Turborepo monorepo — `workspace/apps/backend`, `workspace/apps/frontend`)
**Performance Goals**: Nav renders identity without extra network round-trips (reads existing `AuthProvider` session state); logout is a single best-effort POST + local sign-out
**Constraints** (Constitution): II Contract-Driven, IV Simplicity (no token denylist), V KB-as-Truth (contract + module doc updated), VI Explicit over Implicit (named constants)

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Architecture Quality | ✅ PASS | Fits existing Auth module + Frontend shell; no new module ⇒ no ADR required |
| II. Contract-Driven | ✅ PASS | `kb/contracts/auth.yaml` already reserves `POST /api/auth/logout`; refined before/with implementation (FR-011) |
| III. Extension Points Demonstrable | ✅ PASS | Backend endpoint is a demonstrable acknowledgement/audit hook (future denylist extension point) |
| IV. Simplicity Over Cleverness | ✅ PASS | No Redis token denylist; `supabase.auth.signOut()` is the authoritative revocation |
| V. Knowledge Base as Truth | ✅ PASS | Contract + `kb/modules/auth.md` updated; also fixes latent `@Controller('auth')` vs `/api/auth/*` mismatch |
| VI. Explicit Over Implicit | ✅ PASS | Named constants for logout path + labels; explicit error swallowing with comment |

## Architecture Decision
**Approach**: Monolith addition — extend the existing **Auth** NestJS module with one guarded endpoint, and extend the **Frontend shell** (`AppShell`) with one client component that consumes the existing `AuthProvider`.

**Rationale**:
- `kb/ARCHITECTURE.md` §Security Model: Supabase Auth (ADR-0015), `@supabase/ssr` cookie sessions, `SupabaseJwtGuard` verifies JWTs, backend never manages sessions. A guarded acknowledgement endpoint is the correct, minimal fit.
- `AuthProvider` (`contexts/auth-context.tsx`) already exposes `user`, `session`, `loading`, and `signOut()`. The new component reuses it (DRY) rather than re-reading Supabase directly.
- The FE REST boundary `apiRequest()` (`services/api-client.ts`) already attaches `Authorization: Bearer <token>`; the new `logout()` method reuses it.

**Modules affected**:
- **Auth** (Hoàng) — `workspace/apps/backend/src/auth/` (controller + new spec)
- **Frontend** (shell: Phương) — `AppShell` header + new `components/auth/user-nav-section.tsx`

**E2E flows affected**: None modified. This is an identity/session-lifecycle slice layered on the existing Supabase auth flow. The DESIGN.md leaderboard identity-transition (A → anonymous) is triggered naturally by `signOut()` and is not altered.

**New modules needed**: None.

### Critical pre-existing finding (must fix)
There is **no NestJS global prefix**; every controller embeds `api/` in its own `@Controller()` path (`api/leaderboard`, `api/strategies`, `api/loop`, …) — **except** `AuthController`, which is `@Controller('auth')`. So its routes are actually served at `/auth/me`, contradicting `kb/contracts/auth.yaml` (`/api/auth/me`). To make the FE call `/api/auth/logout` correctly (and to align code with the KB per Constitution V), **change `@Controller('auth')` → `@Controller('api/auth')`**. Verified: no code or test references `/auth/me`, `/auth/logout`, or `/api/auth/*` (grep clean), so the rename is non-breaking.

## Source Code Structure

### Backend (`workspace/apps/backend/src/auth/`)
- **MODIFY** `auth.controller.ts` — `@Controller('api/auth')`; add `@Post('logout')` handler → `@CurrentUser() userId` (audit log) → return `{ message: 'Logged out successfully' }`. Class-level `@UseGuards(SupabaseJwtGuard, RequireAuth)` already yields `401` for invalid/expired tokens (FR-008, SC-003).
- **ADD** `auth.controller.spec.ts` — unit test: `logout()` returns the message; controller path is `api/auth`; `SupabaseJwtGuard` + `RequireAuth` metadata present on the route (mirrors `leaderboard.controller.spec.ts` metadata-assertion pattern).
- `auth.module.ts` — **no change** (controller already registered).

### Frontend (`workspace/apps/frontend/src/`)
- **ADD** `components/auth/user-nav-section.tsx` (`'use client'`) — reads `useAuth()`; renders nothing when anonymous; a subtle placeholder while `loading`; otherwise an avatar-initials chip + display name/email that toggles a small dropdown (`aria-haspopup`, `aria-expanded`, Escape/outside-click closes) containing account info and the **Log Out** item. Logout handler: disable while in flight → `try { await apiClient.logout() } catch { /* graceful */ }` → `await signOut()` → `router.replace('/login')`.
- **MODIFY** `components/common/app-shell.tsx` — render `<UserNavSection />` in the header's right cluster, **outside** `<nav id="primary-navigation">` (keeps existing nav-link assertions intact).
- **MODIFY** `services/api-client.ts` — add `logout(): Promise<LogoutResponse>` → `apiRequest('/api/auth/logout', { method: 'POST' })`; export `interface LogoutResponse { message: string }`.
- **ADD** `components/auth/user-nav-section.spec.tsx` — authed render (email/name), anonymous render (nothing), loading placeholder, logout happy path (apiClient.logout + signOut + redirect), graceful degradation (logout rejects → still signOut + redirect), disabled while in flight, dropdown a11y (aria-expanded, Escape closes).
- **MODIFY** `components/common/app-shell.spec.tsx` — add `vi.mock("../../contexts/auth-context", …)` returning `{ user: null, loading: false, signOut: vi.fn(), … }` so existing AppShell tests render without an `AuthProvider` (established repo mocking convention).
- `contexts/auth-context.tsx` — **no change** (existing `signOut()` reused).

### KB (implementation phase — Constitution II + V)
- **MODIFY** `kb/contracts/auth.yaml` — mark `POST /api/auth/logout` as implemented in NestJS (JWT-guarded acknowledgement, `{ message }`, `401` on invalid token); correct the `GET /api/auth/me` note (controller now `api/auth`).
- **MODIFY** `kb/modules/auth.md` — add the logout endpoint to §6 API Surface and `UserNavSection` to the §2 Frontend component table.

## Complexity Tracking
> No constitution violations. Table intentionally empty — the simplest contract-compliant solution was chosen (acknowledgement endpoint + client-side `signOut()`), with no denylist or session store.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — none — | — | — |
