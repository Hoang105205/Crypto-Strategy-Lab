# Research: Current User Display and Logout

All spec assumptions resolved. No `[NEEDS CLARIFICATION]` markers remain.

## Decisions

### D1: Logout endpoint path — `/api/auth/logout` (not literal `/api/logout`)
- **Chosen**: `POST /api/auth/logout`, namespaced under the Auth controller.
- **Rationale**: `kb/contracts/auth.yaml` already reserves `POST /api/auth/logout`, and every other controller embeds `api/` (`api/leaderboard`, `api/strategies`, `api/loop`, `api/dashboard`, `api/market-data`, `api/queue`, `api/news`). Constitution V (KB as truth) + VI (explicit/consistent) ⇒ keep the auth namespace.
- **Alternatives considered**: Literal `/api/logout` from the prompt — rejected (breaks the auth namespace + contract).
- **KB reference**: `kb/contracts/auth.yaml` §endpoints; `kb/modules/auth.md` §6.

### D2: Controller prefix fix — `@Controller('auth')` → `@Controller('api/auth')`
- **Chosen**: Rename the Auth controller path to `api/auth`.
- **Rationale**: No global prefix exists; `@Controller('auth')` currently serves `/auth/me`, contradicting the contract's `/api/auth/me`. The FE will call `/api/auth/logout`, so the controller MUST be at `api/auth`. This also heals the pre-existing `/api/auth/me` mismatch (Constitution V).
- **Verification**: `grep` for `auth/me|auth/logout|api/auth` across `workspace/` returned **0 matches** ⇒ no caller/test breaks. `AuthController` has no existing `.spec.ts`.
- **Alternatives considered**: Add `app.setGlobalPrefix('api')` — rejected (would double-prefix the 7 controllers that already embed `api/`, breaking the whole API).

### D3: Backend semantics — guarded acknowledgement, NOT a token denylist
- **Chosen**: `@Post('logout')` under class-level `@UseGuards(SupabaseJwtGuard, RequireAuth)`; logs the `userId` (audit) and returns `{ message: 'Logged out successfully' }`. Invalid/expired token ⇒ `401` (from `RequireAuth`).
- **Rationale**: Supabase JWTs are **stateless**, verified via JWKS (`SupabaseService.verifyToken` → `client.auth.getUser`). The backend holds **no session store**, so it cannot revoke a JWT without a denylist. Authoritative revocation is `supabase.auth.signOut()` (invalidates the refresh token at Supabase + clears `@supabase/ssr` cookies). Constitution IV (Simplicity/YAGNI) ⇒ no Redis denylist for a course project.
- **Alternatives considered**: (a) Redis token denylist checked by `SupabaseJwtGuard` — rejected (over-engineering, new infra, violates IV); (b) unauthenticated no-op endpoint — rejected (contract implies a verified identity; RequireAuth gives a clean 401 the FE already tolerates).
- **KB reference**: `kb/ARCHITECTURE.md` §Security Model; ADR-0015; `kb/modules/auth.md` §4/§7.

### D4: Frontend logout orchestration — component-owned, best-effort BE call
- **Chosen**: `UserNavSection` runs: `setLoggingOut(true)` → `try { await apiClient.logout() } catch { /* graceful degradation */ }` → `await signOut()` → `router.replace('/login')`.
- **Rationale**: Satisfies FR-005/006/007/009/010. The BE call is best-effort so a 401/5xx/network failure never strands the user (US2 AS-3/AS-5). `signOut()` (existing context method wrapping `supabase.auth.signOut()`) clears cookies + local auth state; `router.replace` (not `push`) prevents Back returning to an authed route. `AuthProvider`'s `onAuthStateChange` fires on sign-out, so the leaderboard-live provider's A→anonymous identity-transition runs naturally (DESIGN.md).
- **Alternatives considered**: Put orchestration in `auth-context.tsx` — rejected (context would import the router + api-client, mixing concerns; component already has `useRouter`).
- **KB reference**: `kb/DESIGN.md` §Application Shell (identity transition); `services/api-client.ts` `apiRequest`.

### D5: Identity display source + fallback
- **Chosen**: `const meta = user.user_metadata ?? {}`; `displayName = meta.display_name ?? meta.name ?? meta.full_name ?? null`. Primary label = `displayName ?? user.email`; when a `displayName` exists, show `user.email` as a secondary/muted line. Avatar = initials from `displayName` or the email local-part. Never render `undefined`/`null`.
- **Rationale**: Supabase email/password auth (ADR-0015) often has no name; email is always present (`AuthUser.email` in the contract). FR-002 + Edge Case "Name absent".
- **Alternatives considered**: Fetch profile from `GET /api/auth/me` — rejected (extra round-trip; `AuthProvider` already has the user; that endpoint is debug-only and returns just `{ id }`).

### D6: UI variant — avatar chip + accessible dropdown
- **Chosen**: A right-anchored chip (circular avatar with initials + name/email, muted chevron) that toggles a small dropdown panel (`{colors.surface-card-dark}`, `1px {colors.hairline-dark}`, `{rounded.lg}`) containing: account header (name + email) and a full-width **Log Out** row. Keyboard: `Enter`/`Space` toggles, `Escape` closes, click-outside closes. ARIA: `aria-haspopup="menu"`, `aria-expanded`, `aria-label="Account menu for <email>"`, Log Out is a `<button>` with accessible name.
- **Rationale**: Meets US1/US2/US3 + DESIGN.md (`top-nav-dark` 64px, focus ring `{colors.info-ring}`=`info` token, dark surface tokens, yellow `{colors.primary}` NOT used as a fill). Dropdown keeps the 64px bar uncluttered and scales to narrow viewports (chip truncates with ellipsis).
- **Alternatives considered**: Inline "Log Out" text button beside the name — acceptable per spec but rejected as default (crowds the nav on mobile; dropdown is cleaner/more modern per the prompt's "creative freedom").
- **Design tokens used** (all confirmed present in `globals.css` `@theme`): `bg-canvas-dark`, `bg-surface-card`, `bg-surface-elevated`, `border-hairline-dark`, `text-body`, `text-muted`, `text-muted-strong`, `ring-info` (focus). Note: `body-secondary`/`border`/`info-ring` are NOT theme tokens — avoided.

### D7: Testing strategy — mirror existing repo conventions
- **Chosen**:
  - Backend: `auth.controller.spec.ts` asserts `logout()` return value + `PATH_METADATA === 'api/auth'` + `GUARDS_METADATA` includes `SupabaseJwtGuard` & `RequireAuth` (metadata-assertion style from `leaderboard.controller.spec.ts`).
  - Frontend: `user-nav-section.spec.tsx` mocks `../../services/api-client` (`apiClient.logout`) and `next/navigation` (`useRouter.replace`), and wraps render in a real/mocked `AuthProvider` value; asserts authed/anonymous/loading render, logout call order, graceful degradation, disabled-while-in-flight, and dropdown a11y.
  - Modify `app-shell.spec.tsx`: add `vi.mock("../../contexts/auth-context", …)` (returns `user:null, loading:false`) so AppShell renders `<UserNavSection/>` (→ null) without an `AuthProvider`, keeping all 4 existing assertions green.
- **Rationale**: Established patterns (see `agent_learn` T041 shell/a11y, market-data-frontend React 19 + Vitest isolation). SC-006 requires `tsc --noEmit` clean both apps.
- **KB reference**: `agent_learn/INDEX.md`; existing `app-shell.spec.tsx`, `leaderboard.controller.spec.ts`.
