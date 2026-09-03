# Feature Specification: Current User Display and Logout

**Feature**: `current-user-display-logout`
**Created**: 2026-09-02
**Status**: Draft
**Input**: User description: "Build a complete 'Current User Display and Logout' feature (FE + BE). Add a user profile section on the far-right of the top navigation bar showing the current logged-in user's name/email, plus a functional Log Out button (inline or dropdown). Clean, modern UI. Backend: create an endpoint (POST /api/logout) to handle session invalidation / token revocation securely. Frontend: call the logout endpoint, clear local state/tokens, and redirect to the login page."

## User Scenarios & Testing

### User Story 1 - Recognize the Active Account (Priority: P1)

A logged-in user lands on any application route (Dashboard, Strategy Builder, Leaderboard, News Feed) and immediately sees, on the far-right of the top navigation bar, who they are signed in as — their display name (when available) and/or email address. This removes the ambiguity of "which account am I using?" during a demo or when multiple people share a machine.

**Why this priority**: Core of the request. Without visible identity, the logout action has no context and the feature delivers no value.
**Independent Test**: Sign in with a known account, load any route, assert the top bar renders the account's email (and name when present) on the far right.

**Acceptance Scenarios**:
1. **Given** an authenticated session with email `trader@example.com`, **When** the user opens any route, **Then** the far-right of the top nav displays `trader@example.com` (or the user's display name if present, with email as secondary/accessible text).
2. **Given** the auth session is still resolving (initial load), **When** the top bar renders, **Then** it shows a non-janky placeholder (e.g., a subtle skeleton/avatar) rather than "null" or a flash of the logged-out state.
3. **Given** no authenticated session (anonymous / auth exempt route such as `/login`), **When** the top bar renders, **Then** the user profile section is not shown (or shows nothing identifying) and no logout control is present.
4. **Given** a user with a long email or display name, **When** rendered on a narrow viewport, **Then** the text truncates gracefully (ellipsis) and the layout does not overflow or push nav links off-screen.

---

### User Story 2 - Log Out Securely and Return to Login (Priority: P1)

A logged-in user clicks the "Log Out" control (either an inline button or an item inside a profile dropdown). The app securely ends the session — notifying the backend, clearing the Supabase session/cookies and any local state — and redirects the user to `/login`. The user's identity is no longer displayed.

**Why this priority**: The second explicit half of the request; equally essential. A visible identity with no way to end the session is incomplete and a security/UX gap.
**Independent Test**: Sign in, click Log Out, assert (a) `POST /api/auth/logout` is called with the Bearer token, (b) `supabase.auth.signOut()` runs, (c) the browser navigates to `/login`, and (d) the previous session cookie no longer authenticates a protected request.

**Acceptance Scenarios**:
1. **Given** an authenticated user, **When** they click "Log Out", **Then** the frontend calls `POST /api/auth/logout` (with the current `Authorization: Bearer <token>`) and then calls `supabase.auth.signOut()` to clear cookies/session.
2. **Given** the logout sequence completes, **When** the session is cleared, **Then** the user is redirected to `/login` and the top-bar identity section no longer shows the previous account.
3. **Given** the backend logout endpoint is unreachable or returns an error, **When** the user clicks "Log Out", **Then** the frontend still completes the local `supabase.auth.signOut()` and redirects to `/login` (graceful degradation — the user is never stranded in a half-logged-out state).
4. **Given** the user has clicked "Log Out", **When** the request is in flight, **Then** the control is disabled (or shows a pending state) to prevent duplicate submissions.
5. **Given** an already-expired/invalid token at logout time, **When** the frontend calls `POST /api/auth/logout`, **Then** the endpoint responds `401` but the frontend still clears local state and redirects (the guard rejecting a stale token must not block logout).

---

### User Story 3 - Accessible, On-Brand Profile Control (Priority: P2)

The profile section and logout control follow the Binance-derived dark design system (`top-nav-dark`) and are fully keyboard/screen-reader accessible: the control has an accessible label, a visible focus ring, and (if a dropdown is used) correct `aria-expanded`/`aria-haspopup` semantics and Escape-to-close.

**Why this priority**: Required by `kb/DESIGN.md` (focus ring, accessible labels) and the constitution's quality bar, but functionally secondary to US1/US2.
**Independent Test**: Tab to the profile control, verify a visible focus ring and accessible name; open the dropdown (if used) with keyboard, press Escape, verify it closes.

**Acceptance Scenarios**:
1. **Given** the profile control, **When** a keyboard user tabs to it, **Then** a visible focus ring (`{colors.info-ring}`) appears and the control has an accessible name (e.g., "Account menu for trader@example.com").
2. **Given** a dropdown variant, **When** it is open, **Then** `aria-expanded="true"`; **When** Escape is pressed or focus leaves, **Then** it closes.
3. **Given** the design system, **When** the section renders, **Then** it uses dark-canvas surface tokens (`{colors.surface-card-dark}` / `{colors.body}` / `{colors.muted}`) and never uses `{colors.primary}` yellow as a large fill (yellow reserved for primary CTAs/brand per DESIGN.md).

---

### Edge Cases
- **Anonymous / exempt routes** (`/login`, `/register`): the profile+logout section must not render (middleware already redirects protected routes; these two are exempt).
- **Session resolving on first paint**: show a placeholder, not the logged-out state, to avoid a flash.
- **Backend logout fails (5xx / network / 401)**: local sign-out + redirect MUST still happen (US2 AS-3, AS-5).
- **Double-click / rapid repeat**: logout control is idempotent — disable while in flight.
- **Long identity text on mobile**: truncate with ellipsis; do not break the 64px nav height or overflow horizontally.
- **Name absent**: Supabase users may have no display name (email/password only). Fall back to email; never render "undefined"/"null".
- **Existing leaderboard-live / identity-transition rules**: on A → anonymous transition the app-level provider already clears the prior viewer's cache (DESIGN.md). Logout must not fight that behavior — clearing the session triggers the provider's identity-transition path naturally.

## Requirements

### Functional Requirements
- **FR-001**: The top navigation bar MUST display a user profile section anchored to the far right, on every authenticated route, within the existing `AppShell` header.
- **FR-002**: The profile section MUST show the current user's email; when a display name is available it MUST be shown as the primary label with email as secondary/accessible text.
- **FR-003**: The profile section MUST NOT render for anonymous sessions (including `/login` and `/register`).
- **FR-004**: The system MUST provide a "Log Out" control (inline button or dropdown item) with an accessible label and visible focus state.
- **FR-005**: On logout, the frontend MUST call the backend endpoint `POST /api/auth/logout` with the current `Authorization: Bearer <token>` header (reusing the existing `apiRequest` boundary).
- **FR-006**: On logout, the frontend MUST call `supabase.auth.signOut()` to clear the cookie-based session, refresh token, and local auth state — this is the authoritative session invalidation.
- **FR-007**: After clearing the session, the frontend MUST redirect the user to `/login`.
- **FR-008**: The backend MUST implement `POST /api/auth/logout` guarded by `SupabaseJwtGuard` (JWT verified), returning `{ message: string }` on success and `401` for an invalid/expired token — matching `kb/contracts/auth.yaml`.
- **FR-009**: Logout MUST be resilient: if `POST /api/auth/logout` fails or returns non-2xx, the frontend MUST still complete `supabase.auth.signOut()` and redirect to `/login`.
- **FR-010**: The logout control MUST be disabled (or show a pending state) while the logout sequence is in flight to prevent duplicate submissions.
- **FR-011**: `kb/contracts/auth.yaml` MUST be updated so `POST /api/auth/logout` reflects that it is now implemented in NestJS as a JWT-guarded acknowledgement endpoint (Constitution II + V).
- **FR-012**: `kb/modules/auth.md` MUST be updated to document the new backend endpoint and the FE profile/logout components (Constitution V — interface change requires doc update).

### Key Entities
- **AuthUser** (existing, `kb/contracts/auth.yaml`): `{ id: UUID, email: string, createdAt }`. The FE additionally reads optional `user_metadata.display_name` / `user_metadata.name` for the display label. No new fields required on the entity.
- **LogoutAcknowledgement** (new, response-only): `{ message: string }` returned by `POST /api/auth/logout`. No persistence.
- **No new Prisma model** — Auth owns no tables (Supabase manages `auth.users`); this feature adds no database schema.

## Success Criteria
- **SC-001**: On any authenticated route, a signed-in user can see their email (and display name when present) in the top-right of the nav without any extra navigation.
- **SC-002**: Clicking "Log Out" results in the user landing on `/login` with no residual authenticated session (a subsequent protected API call with the old cookie/token is rejected).
- **SC-003**: `POST /api/auth/logout` returns `200 { message }` for a valid token and `401` for an invalid/expired token, per contract.
- **SC-004**: Logout completes and redirects even when the backend endpoint is unavailable (graceful degradation), verified by simulating a failed request.
- **SC-005**: The profile section and logout control pass a keyboard-accessibility check (focusable, accessible name, visible focus ring; dropdown closes on Escape).
- **SC-006**: `tsc --noEmit` is clean for both backend and frontend after the change.

## Assumptions
- **Logout endpoint path**: The KB contract already reserves `POST /api/auth/logout` (namespaced under `/api/auth`), so the feature uses that path rather than the literal `/api/logout` from the prompt — consistent with `GET /api/auth/me` and Constitution V (KB as truth).
- **No token denylist**: Because Supabase JWTs are stateless and verified via JWKS, and the backend holds no session store, the endpoint is an *acknowledgement* hook (audit + future extension point). True revocation is achieved by `supabase.auth.signOut()` invalidating the refresh token and clearing cookies. Building a Redis denylist now would violate Constitution IV (Simplicity / YAGNI).
- **Display name source**: Supabase email/password auth may not populate a name; the FE falls back to email. If `user_metadata.display_name` or `.name` exists, it is used as the primary label.
- **UI variant**: A profile "chip" (avatar initials + name/email) that opens a small dropdown containing account info and the "Log Out" item is the default design; an inline button is acceptable. Final choice is made in the Plan/Design phase within DESIGN.md tokens.
- **Redirect mechanism**: Client-side redirect via the router (Next.js App Router) after `signOut()`; the existing server `middleware.ts` continues to protect routes for any subsequent navigation.
- **Scope boundary**: This feature does NOT add profile editing, avatar upload, password change, or "delete account" — display + logout only.

## KB Cross-References
- **Modules affected**:
  - **Auth** (Hoàng) — `kb/modules/auth.md`: add `POST /api/auth/logout` (backend) + FE profile/logout components + wiring.
  - **Frontend** (shell: Phương) — `AppShell` top nav gains the far-right profile section.
- **E2E flows affected**: No `kb/flows/*` scenario is modified; this is an identity/session-lifecycle UI + endpoint slice that sits on top of the existing Supabase auth flow. (The leaderboard identity-transition behavior in DESIGN.md is respected, not changed.)
- **Architecture constraints**: `kb/ARCHITECTURE.md` §Security Model — Supabase Auth (ADR-0015), `@supabase/ssr` cookie sessions, `SupabaseJwtGuard` verifies JWTs. Backend never manages sessions. Modular-monolith: FE↔BE via REST only.
- **Constitution gates**:
  - **II Contract-Driven** — `kb/contracts/auth.yaml` updated before/with implementation (FR-011).
  - **IV Simplicity** — no token denylist; acknowledgement endpoint only.
  - **V KB as Truth** — contract + module doc updated (FR-011, FR-012).
  - **VI Explicit over Implicit** — named constants for the logout path/labels; no magic.
- **Glossary terms**: **Authentication** (Supabase Auth, ADR-0015), **AuthSession** (cookie-based, `@supabase/ssr`).
- **Design system**: `kb/DESIGN.md` — `{component.top-nav-dark}` (64px), `{colors.surface-card-dark}`, `{colors.body}`, `{colors.muted}`, `{colors.info-ring}` focus; yellow `{colors.primary}` reserved for primary CTAs only.
- **Related ADRs**: ADR-0015 (Supabase Auth), ADR-0016 (app-level userId filtering — not modified here).
- **Related past work**: `sdd_artifacts/auth-trade-stats` (parent — login/register/scoping, complete); `agent_learn` T041 (Next 16 shell boundary + accessible navigation) and market-data-frontend (React 19 ref/lint, Tailwind v4 `@theme`).
