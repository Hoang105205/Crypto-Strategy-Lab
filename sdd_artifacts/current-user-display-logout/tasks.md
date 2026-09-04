# Tasks: Current User Display and Logout

**Input**: Design documents from `sdd_artifacts/current-user-display-logout/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/auth-logout.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (display), US2 (logout), US3 (a11y)
- Exact file paths included. No new dependencies, no Prisma migration (data-model.md).

---

## Phase 1: Contract First (Constitution II + V)

**Purpose**: Update the authoritative KB contract BEFORE implementation.

- [X] T001 [P] Update `kb/contracts/auth.yaml` — mark `POST /api/auth/logout` as IMPLEMENTED in NestJS (JWT-guarded acknowledgement; response `{ message: string }`; `401` on invalid/expired token); correct the `GET /api/auth/me` note to reflect controller path `api/auth` (FR-011, D1/D2/D3)

---

## Phase 2: Foundation

**Purpose**: Backend endpoint + FE REST method that US2 depends on.

**⚠️ CRITICAL**: US2 (logout) cannot function until this phase is complete.

- [X] T002 [Foundation] Modify `workspace/apps/backend/src/auth/auth.controller.ts` — change `@Controller('auth')` → `@Controller('api/auth')`; add `@Post('logout')` handler using `@CurrentUser() userId` (audit `Logger`) returning `{ message: 'Logged out successfully' }`; keep class-level `@UseGuards(SupabaseJwtGuard, RequireAuth)` (FR-008, D2/D3)
- [X] T003 [P] [Foundation] Add `workspace/apps/backend/src/auth/auth.controller.spec.ts` — assert `logout()` returns the message; `PATH_METADATA === 'api/auth'`; `GUARDS_METADATA` includes `SupabaseJwtGuard` & `RequireAuth` (mirror `leaderboard.controller.spec.ts`)
- [X] T004 [P] [Foundation] Modify `workspace/apps/frontend/src/services/api-client.ts` — export `interface LogoutResponse { message: string }`; add `apiClient.logout(): Promise<LogoutResponse>` → `apiRequest('/api/auth/logout', { method: 'POST' })` (contracts/auth-logout.md, D4)

**Checkpoint**: `POST /api/auth/logout` reachable; FE can call it. US1 can proceed independently.

---

## Phase 3: User Story 1 - Recognize the Active Account (Priority: P1) 🎯 MVP

**Goal**: Far-right top-nav profile section shows the current user's name/email on every authenticated route.
**Independent Test**: Sign in → any route shows identity top-right; anonymous shows nothing.

- [X] T005 [US1] Create `workspace/apps/frontend/src/components/auth/user-nav-section.tsx` (`'use client'`) — consume `useAuth()`; render `null` when anonymous, a placeholder chip while `loading`, else an avatar-initials chip + primary label (`user_metadata.display_name ?? name ?? full_name ?? email`) with muted email subline when a name exists; derive initials; use only existing `@theme` tokens (D5/D6)
- [X] T006 [US1] Modify `workspace/apps/frontend/src/components/common/app-shell.tsx` — render `<UserNavSection />` in the header right cluster, OUTSIDE `<nav id="primary-navigation">` (preserve existing nav assertions) (depends T005, FR-001)
- [X] T007 [P] [US1] Modify `workspace/apps/frontend/src/components/common/app-shell.spec.tsx` — add `vi.mock("../../contexts/auth-context", …)` returning `{ user: null, loading: false, session: null, signIn, signUp, signOut }` so AppShell renders without an `AuthProvider`; keep all 4 existing assertions green
- [X] T008 [US1] Add display tests to `workspace/apps/frontend/src/components/auth/user-nav-section.spec.tsx` — authed (name/email shown), anonymous (renders nothing), loading (placeholder, no identifying text), long-email truncation class present (depends T005)

**Checkpoint**: US1 functional — identity visible top-right; existing AppShell tests pass.

---

## Phase 4: User Story 2 - Log Out Securely and Return to Login (Priority: P1)

**Goal**: Log Out calls BE, runs `signOut()`, redirects to `/login`; resilient to BE failure.
**Independent Test**: Click Log Out → POST fires → session cleared → `/login`.

- [X] T009 [US2] Extend `workspace/apps/frontend/src/components/auth/user-nav-section.tsx` — add dropdown (account header + full-width **Log Out** `<button>`) and the logout handler: `setLoggingOut(true)` → `try { await apiClient.logout() } catch {}` → `await signOut()` → `router.replace('/login')`; disable control while in flight (depends T004, T005; FR-005/006/007/009/010, D4)
- [X] T010 [US2] Add logout tests to `workspace/apps/frontend/src/components/auth/user-nav-section.spec.tsx` — mock `../../services/api-client` + `next/navigation`; assert happy path (logout→signOut→replace order), graceful degradation (logout rejects → still signOut+redirect), disabled while in flight (depends T009)

**Checkpoint**: US2 functional — secure logout + redirect, resilient to BE errors.

---

## Phase 5: User Story 3 - Accessible, On-Brand Profile Control (Priority: P2)

**Goal**: Keyboard/SR-accessible dropdown with visible focus; on-brand dark tokens; no yellow fill.
**Independent Test**: Tab → focus ring + accessible name; Escape closes dropdown.

- [X] T011 [US3] Refine `workspace/apps/frontend/src/components/auth/user-nav-section.tsx` — `aria-haspopup="menu"`, `aria-expanded`, `aria-label="Account menu for <email>"`, accessible Log Out name, `Escape` + outside-click close, focus ring `ring-info`, `{colors.surface-card-dark}`/`hairline-dark` surfaces (depends T009; FR-004, D6)
- [X] T012 [US3] Add a11y tests to `workspace/apps/frontend/src/components/auth/user-nav-section.spec.tsx` — `aria-expanded` toggles, Escape closes, toggle has accessible name, Log Out is a focusable button (depends T011)

---

## Phase 6: Polish, KB Sync & Verify

**Purpose**: Doc consistency + quality gates (Constitution V; SC-006).

- [X] T013 [P] Modify `kb/modules/auth.md` — add `POST /api/auth/logout` to §6 API Surface and `UserNavSection` to the §2 Frontend component table (FR-012)
- [X] T014 Run `npx tsc --noEmit` for backend and frontend — 0 errors (SC-006). ✅ Frontend exit 0. Backend: 0 errors in `auth/`; remaining errors are pre-existing (stale Prisma client `SearchLoopControl` + `userId` drift in dashboard/events/leaderboard/loop/queue specs), confirmed outside this feature's changeset via `git status`. Rebuilt `libs/shared` to clear stale-dist errors.
- [X] T015 Run `npm run test` in `workspace/apps/backend` (jest) and `workspace/apps/frontend` (vitest) — ✅ backend `auth.controller` 4/4; frontend `user-nav-section` 11/11 + `app-shell` 7/7 (18 total).
- [ ] T016 Execute `sdd_artifacts/current-user-display-logout/quickstart.md` validation scenarios 1–5 (manual/dev-server) — PENDING: requires a live dev server + Supabase env; deferred to manual QA.

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (T001)**: none — contract first.
- **Phase 2 (T002–T004)**: after Phase 1; T002 blocks US2. T003/T004 are [P].
- **Phase 3 (US1: T005–T008)**: T005 → T006; T007 [P]; T008 after T005. Independent of Phase 2 (display only).
- **Phase 4 (US2: T009–T010)**: needs T004 + T005.
- **Phase 5 (US3: T011–T012)**: needs T009.
- **Phase 6 (T013–T016)**: after all stories; T013 [P]; T014/T015/T016 sequential gates.

### Parallel Opportunities
- T001 [P]; T003 & T004 [P]; T007 [P]; T013 [P].
- US1 (T005–T008) can proceed in parallel with Phase 2 backend work (different files/apps).

---

## Implementation Strategy

### MVP First (US1 + US2 are both P1)
1. Phase 1 contract → Phase 2 foundation (BE endpoint + api-client).
2. Phase 3 US1 (display) → validate identity visible.
3. Phase 4 US2 (logout) → validate secure logout + redirect.
4. Phase 5 US3 (a11y) → Phase 6 KB sync + verify gates.

**Total**: 16 tasks — Phase 1: 1 · Phase 2: 3 · Phase 3: 4 · Phase 4: 2 · Phase 5: 2 · Phase 6: 4. **[P] count**: 5.
