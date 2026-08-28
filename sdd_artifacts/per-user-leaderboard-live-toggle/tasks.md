# Tasks: Per-User Leaderboard Live Toggle

**Input**: Design documents in `sdd_artifacts/per-user-leaderboard-live-toggle/`  
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/leaderboard-rest.md`, `contracts/userid-propagation.md`, and `contracts/leaderboard-realtime.md` are complete.

**Task format**: `[ID] [P?] [Story] Description (Depends on: ...)`

- `[P]` means the task can run in parallel with other ready tasks because it owns different files.
- Story labels map to the P1 stories in `spec.md`: `[US1]` scoped REST reads, `[US2]` global loop semantics, `[US3]` frontend live toggle, `[US4]` privacy-safe realtime/lifecycle, and `[US5]` cross-route/identity ownership.
- Every production-code task follows a RED test task. A test task may initially fail for the intended missing behavior, but must compile after its paired implementation.
- Do not add a Prisma migration: `LeaderboardEntry.userId` already exists in `workspace/apps/backend/prisma/schema.prisma`.
- Do not add `userId` to `SearchLoopRun`, `SearchLoopCandidate`, loop commands, or loop repository queries.
- Do not add rooms, a socket-auth handshake, a namespace, client-side privacy filtering, a shared-socket disconnect, database changes, or wire/auth field changes.
- `[X]` on T001-T033 and T043 was re-audited on 2026-08-24 against source/tests plus `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`. T034-T039 are complete. By explicit owner decision on 2026-08-24, T040 is a feature-scoped quality gate: repository-wide lint/format debt outside the exact feature file set is recorded but does not block this feature. T041-T042 remain sequential release validation. T044-T050 are convergence tasks for the cross-route amendment and retain new IDs so historical task identity is not reset.

## Phase 1: Contract and Propagation Foundation

**Purpose**: Lock the public contract first, then propagate the existing nullable owner identity through shared types and the backtest lifecycle.

- [X] T001 [Foundation] Amend `kb/contracts/events.yaml` to make `BacktestCompleted.userId` required and nullable, make `LeaderboardUpdated.triggeredByBacktestResultId` nullable, and state that namespace-wide `LeaderboardUpdated.topK` contains system rows only; cross-reference `sdd_artifacts/per-user-leaderboard-live-toggle/contracts/userid-propagation.md` and `sdd_artifacts/per-user-leaderboard-live-toggle/contracts/leaderboard-realtime.md`. (Depends on: none)
- [X] T002 [P] [Foundation] Add RED compile/runtime contract assertions for `BacktestCompleted.userId`, `LeaderboardEntryPayload.userId`, and nullable `LeaderboardUpdated.triggeredByBacktestResultId` in `workspace/apps/backend/src/queue/backtest.worker.spec.ts`, `workspace/apps/backend/src/leaderboard/leaderboard.repository.spec.ts`, and `workspace/apps/backend/src/dashboard/push.gateway.spec.ts`. (Depends on: T001)
- [X] T003 [Foundation] Update the shared TypeScript contracts in `workspace/libs/shared/src/events/index.ts` and `workspace/libs/shared/src/types/infrastructure.ts` so they exactly match T001 and the feature contracts. (Depends on: T002)
- [X] T004 [P] [US4] Add RED tests in `workspace/apps/backend/src/queue/backtest.worker.spec.ts` and `workspace/apps/backend/src/strategy/ports/backtest-result.port.spec.ts` proving `BacktestRequested.userId` is persisted to `BacktestResult.userId` and copied to `BacktestCompleted.userId` for both a USER UUID and `null` SEARCH_LOOP ownership. (Depends on: T003)
- [X] T005 [US4] Implement the lifecycle propagation in `workspace/apps/backend/src/queue/backtest.worker.ts` and `workspace/apps/backend/src/strategy/ports/backtest-result.port.ts`, preserving `null` rather than substituting an authenticated viewer. (Depends on: T004)
- [X] T006 [P] [US2] Add producer regression tests in `workspace/apps/backend/src/strategy/controllers/tests/strategy.controller.spec.ts` and `workspace/apps/backend/src/loop/strategy-loop.service.spec.ts` proving USER requests publish the authenticated UUID while SEARCH_LOOP requests publish `userId: null`. (Depends on: T003)
- [X] T007 [Foundation] Run the focused shared-contract and propagation specs from T002, T004, and T006; record command output and pass/fail evidence in `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md` before starting scoped leaderboard implementation. (Depends on: T005, T006)

**Checkpoint**: A single nullable `userId` survives `BacktestRequested -> BacktestResult -> BacktestCompleted`; system jobs remain explicitly unowned.

## Phase 2: US1 — Authenticated, Viewer-scoped REST Reads

**Purpose**: Make every leaderboard read surface return only system rows plus the current viewer's private rows, with view-local ranking and anti-enumeration.

- [X] T008 [US1] Add RED repository tests for anonymous, user A, and user B list scopes in `workspace/apps/backend/src/leaderboard/leaderboard.repository.spec.ts`; cover system-only anonymous visibility, `system + own` authenticated visibility, filter-before-best-per-version, filter-before-Top-K, and no A/B leakage. (Depends on: T007)
- [X] T009 [US1] Extend the RED repository suite in `workspace/apps/backend/src/leaderboard/leaderboard.repository.spec.ts` for scoped detail, scoped `updatedAt`, scoped Top-K, and recomputed continuous ranks `1..N` after filtering; assert a viewer cannot address another user's row by ID. (Depends on: T008)
- [X] T010 [US1] Add RED service tests in `workspace/apps/backend/src/leaderboard/leaderboard.service.spec.ts` for anonymous/A/B list, detail, Top-K, and `updatedAt` delegation, plus creation of `LeaderboardEntry.userId` from `BacktestCompleted.userId`. (Depends on: T003)
- [X] T011 [P] [US1] Add RED controller metadata/delegation tests in `workspace/apps/backend/src/leaderboard/leaderboard.controller.spec.ts` proving every list/detail endpoint uses `SupabaseJwtGuard`, resolves `@CurrentUser()`, and passes `currentUser?.id ?? null` into the service. (Depends on: T003)
- [X] T012 [P] [US1] Add a RED anti-enumeration scenario to `workspace/apps/backend/src/leaderboard/leaderboard.integration.spec.ts` proving user A and user B receive the same not-found response shape for an existing row owned by the other user as for a nonexistent ID. (Depends on: T003)
- [X] T013 [US1] Implement nullable viewer scoping in `workspace/apps/backend/src/leaderboard/leaderboard.repository.ts`: apply `userId IS NULL OR userId = viewerUserId` before best-per-version selection, sorting, Top-K truncation, `updatedAt`, and rank recomputation; map persisted owner identity into `LeaderboardEntryPayload.userId`. (Depends on: T008, T009)
- [X] T014 [US1] Implement scoped service signatures and entry-owner propagation in `workspace/apps/backend/src/leaderboard/leaderboard.service.ts`, including not-found behavior for out-of-scope detail reads. (Depends on: T005, T010, T013)
- [X] T015 [US1] Apply `SupabaseJwtGuard` and `@CurrentUser()` in `workspace/apps/backend/src/leaderboard/leaderboard.controller.ts`, and import/reuse `AuthModule` in `workspace/apps/backend/src/leaderboard/leaderboard.module.ts`; do not create a new auth or leaderboard module. (Depends on: T011, T012, T014)
- [X] T016 [P] [US1] Add RED unit/integration tests in `workspace/apps/backend/src/dashboard/dashboard.service.spec.ts` and `workspace/apps/backend/src/dashboard/dashboard.integration.spec.ts` proving dashboard leaderboard preview and leaderboard `updatedAt` use anonymous/A/B scope while loop and queue summaries remain global. (Depends on: T003)
- [X] T017 [US1] Thread `@CurrentUser()` viewer scope through `workspace/apps/backend/src/dashboard/dashboard.controller.ts` and `workspace/apps/backend/src/dashboard/dashboard.service.ts`, and reuse `AuthModule` in `workspace/apps/backend/src/dashboard/dashboard.module.ts` without changing global loop/queue queries. (Depends on: T014, T016)

**Checkpoint**: List, detail, dashboard Top-K, and `updatedAt` are scoped consistently; ranks are continuous for the current view; private rows are non-enumerable across users.

## Phase 3: US2 — Guarded Controller, Global Search Loop

**Purpose**: Authenticate loop HTTP access without accidentally turning the singleton search loop into a per-user resource.

- [X] T018 [P] [US2] Add RED tests in `workspace/apps/backend/src/loop/loop.controller.spec.ts` and `workspace/apps/backend/src/loop/loop.integration.spec.ts` proving every loop route uses `SupabaseJwtGuard` and `@CurrentUser()`, but anonymous/user A/user B identity never changes `SearchLoopRun` or `SearchLoopCandidate` repository arguments, records, or returned status. (Depends on: T007)
- [X] T019 [US2] Apply `SupabaseJwtGuard` and `@CurrentUser()` to `workspace/apps/backend/src/loop/loop.controller.ts` and reuse `AuthModule` from `workspace/apps/backend/src/loop/loop.module.ts`; intentionally ignore viewer identity after authentication and leave `workspace/apps/backend/src/loop/strategy-loop.repository.ts` globally scoped. (Depends on: T018)

**Checkpoint**: Loop routes are guarded, but every authenticated viewer observes the same system-loop state and no per-user loop storage/query exists.

## Phase 4: US4 — Privacy-safe Namespace-wide Realtime

**Purpose**: Keep the existing unauthenticated shared socket safe by publishing only system leaderboard data and treating the event as an invalidation signal for private views.

- [X] T020 [US4] Add RED publisher tests in `workspace/apps/backend/src/leaderboard/leaderboard.service.spec.ts` proving `LeaderboardUpdated.topK` and its watermark are computed from system entries only, private completion emits no private row or private result ID, and system completion may carry its result ID. (Depends on: T014)
- [X] T021 [P] [US4] Update `workspace/apps/backend/src/dashboard/push.gateway.spec.ts` with exact wire-shape tests for the safe `leaderboard:update` relay, nullable trigger, system-only payload fixtures, and the invariant that the gateway calls `server.emit` without introducing rooms, socket auth, or disconnect behavior. (Depends on: T003)
- [X] T022 [US4] Add a RED end-to-end publisher scenario in `workspace/apps/backend/src/leaderboard/leaderboard.integration.spec.ts` that processes user A and user B completions and spies on the gateway boundary to prove neither private Top-K rows nor private result IDs reach namespace-wide `server.emit`. (Depends on: T012, T014, T021)
- [X] T023 [US4] Implement privacy-safe leaderboard publication in `workspace/apps/backend/src/leaderboard/leaderboard.service.ts`: build global event Top-K/`updatedAt` from `viewerUserId = null`, null the trigger for private completions, and keep `workspace/apps/backend/src/dashboard/push.gateway.ts` as an exact broadcast relay with no invented room protocol. (Depends on: T020, T021, T022)

**Checkpoint**: REST can return `system + own`; namespace-wide realtime can reveal system rows only and acts as a refetch trigger for authenticated private views.

## Phase 5: US3 — Live Toggle and Read-only Loop Panel

**Purpose**: Let the user pause only leaderboard rendering/listening while preserving the shared socket, global loop updates, and race protections.

- [X] T024 [P] [US3] Add RED hook tests in `workspace/apps/frontend/src/hooks/use-leaderboard.spec.tsx` proving `leaderboard:update` is an invalidation/refetch signal rather than trusted row replacement, stale requests lose to `requestGeneration`, and existing watermark ordering remains effective. (Depends on: T023)
- [X] T025 [P] [US3] Update `workspace/apps/frontend/src/hooks/use-leaderboard.ts` to refetch scoped REST data on safe realtime invalidation while retaining sort selection, request-generation protection, and watermark checks. (Depends on: T024)
- [X] T026 [P] [US3] Add RED live-toggle tests in `workspace/apps/frontend/src/hooks/use-dashboard-summary.spec.tsx` for explicit browser-persisted choice (absent = OFF), OFF removing only the exact `leaderboard:update` handler and freezing the last snapshot, re-enable subscribe-before-refetch catch-up, reload/remount persistence, reconnect while ON/OFF, listener deduplication, unmount cleanup, continued loop listeners, and no shared-socket disconnect. (Depends on: T023)
- [X] T027 [P] [US3] Implement `isLeaderboardLive` and a stable leaderboard handler in `workspace/apps/frontend/src/hooks/use-dashboard-summary.ts`; OFF must call only `socket.off('leaderboard:update', sameHandler)`, while re-enable attaches first and then refetches under existing watermark/request-generation protection. (Depends on: T026)
- [X] T028 [P] [US3] Add RED accessibility/component tests in `workspace/apps/frontend/src/components/dashboard/loop-status-panel.spec.tsx` for a labeled keyboard-operable live toggle, visible ON/OFF state, global loop status display, and absence of Start/Pause/Resume/Stop command controls. (Depends on: T023)
- [X] T029 [P] [US3] Refactor `workspace/apps/frontend/src/components/dashboard/loop-status-panel.tsx` into a read-only system-loop status plus controlled live-view toggle; remove command API props and do not call loop command REST endpoints. (Depends on: T028)
- [X] T030 [P] [US3] Add a RED page-wiring test in `workspace/apps/frontend/src/app/page.spec.tsx` proving dashboard state controls the live toggle, command handlers/start-request construction are absent, and loop-status rendering remains independent of leaderboard live state. (Depends on: T023)
- [X] T031 [US3] Wire the controlled live state through `workspace/apps/frontend/src/app/page.tsx` and `workspace/apps/frontend/src/components/dashboard/dashboard-grid.tsx`; remove obsolete command props/useMemo request construction and leave `workspace/apps/frontend/src/services/infrastructure-socket.ts` as the singleton owner. (Depends on: T025, T027, T029, T030)
- [X] T032 [P] [US3] Update component regressions in `workspace/apps/frontend/src/components/dashboard/dashboard-grid.spec.tsx` and `workspace/apps/frontend/src/components/dashboard/leaderboard-preview.spec.tsx` for frozen rows while OFF, caught-up rows after re-enable, and continuous view-local ranks. (Depends on: T031)
- [X] T033 [P] [US3] Add/extend singleton lifecycle regression coverage in `workspace/apps/frontend/src/services/infrastructure-socket.spec.ts` and `workspace/apps/frontend/src/hooks/use-infrastructure-socket.spec.tsx` proving leaderboard listener cleanup never invokes `disconnect()` and does not remove loop/queue listeners owned by other consumers. (Depends on: T027)
- [X] T043 [US3] Persist the explicit Live updates choice under `crypto-strategy-lab:leaderboard-live` in `workspace/apps/frontend/src/hooks/use-leaderboard-live-preference.ts`, default absent/blocked storage to OFF, and make `workspace/apps/frontend/src/hooks/use-dashboard-summary.ts` plus `workspace/apps/frontend/src/hooks/use-leaderboard.ts` honor OFF across reload/reconnect without suppressing their initial REST snapshot; retain remount/direct-load regression tests in both hook specs. (Depends on: T025, T027; requirement amendment 2026-08-24; supersedes T026's former initial-ON assumption.)

**Checkpoint**: Live OFF freezes only the leaderboard snapshot; re-enable catches up without a subscribe/refetch gap; loop status and the singleton connection continue operating.

## Phase 6: US5 — Cross-route Provider Convergence

**Purpose**: Move the already-delivered preference/safe-invalidation behavior from route hooks into one app-level, viewer-safe provider. These are convergence tasks: the preceding `[X]` work remains valid baseline behavior but is not sufficient for US5.

- [X] T044 [US5] Add RED provider lifecycle and persistence tests in `workspace/apps/frontend/src/contexts/leaderboard-live-context.spec.tsx` covering default OFF, explicit ON/OFF restoration, viewer-stamped `crypto-strategy-lab:leaderboard-cache:v1` hydration, OFF freeze through reload/restart, exactly one handler while ON, off-route current-session reconciliation, SCORE plus retained active criterion, subscribe-before-refetch races, reconnect ON/OFF, route-page unmount survival, exact provider cleanup, zero foreign-listener removal, zero shared-socket disconnect, and zero loop lifecycle calls per US3 scenarios 2-9, US4 scenarios 6-9, US5 scenarios 1-8, FR-010..019/022..027, and `sdd_artifacts/per-user-leaderboard-live-toggle/contracts/leaderboard-realtime.md`. (Depends on: T043)
- [X] T045 [US5] Extend the RED provider suite in `workspace/apps/frontend/src/contexts/leaderboard-live-context.spec.tsx` with anonymous/A/B viewer-key fixtures, mismatched/malformed cache-envelope rejection, A->B and A->anonymous render gating, persisted A-cache removal, preference preservation, AbortSignal observation, identity/request generations, and a delayed successful A response that cannot commit for B/anonymous per US5 scenarios 9-14, FR-019..020/028..030, SC-011, and the Identity Transition State Machine in `sdd_artifacts/per-user-leaderboard-live-toggle/data-model.md`. (Depends on: T044)
- [X] T046 [US5] Add optional `AbortSignal` support to leaderboard reads in `workspace/apps/frontend/src/services/api-client.ts` without changing HTTP paths, headers, response fields, current-session lookup, or auth semantics; satisfy the abort/captured-generation contract asserted by T045. (Depends on: T045)
- [X] T047 [US5] Implement `LeaderboardLiveProvider` and `useLeaderboardLive` in `workspace/apps/frontend/src/contexts/leaderboard-live-context.tsx`, using `workspace/apps/frontend/src/hooks/use-leaderboard-live-preference.ts` only as provider-internal preference storage; own viewer-stamped SCORE/active-criterion snapshots, exact handler, subscribe-before-refetch, reconnect reconciliation, persisted cache envelope, render gate, AbortControllers, identity/request generations, watermarks, sort/selection, and provider-only cleanup as specified by `sdd_artifacts/per-user-leaderboard-live-toggle/contracts/leaderboard-realtime.md` and `sdd_artifacts/per-user-leaderboard-live-toggle/data-model.md`. (Depends on: T044, T045, T046)
- [X] T048 [US5] Add RED root/consumer integration tests in `workspace/apps/frontend/src/components/common/app-shell.spec.tsx`, `workspace/apps/frontend/src/hooks/use-dashboard-summary.spec.tsx`, `workspace/apps/frontend/src/hooks/use-leaderboard.spec.tsx`, and `workspace/apps/frontend/src/app/page.spec.tsx` proving canonical Auth -> Infrastructure -> LeaderboardLive -> AppShell ownership, Dashboard SCORE Top-5 composition, `/leaderboard` active-criterion sharing, stable sort/selection, zero page-level `leaderboard:update` registrations, and zero route-unmount cleanup per US5 scenarios 1-8 and FR-011/016/022..027. (Depends on: T047)
- [X] T049 [P] [US5] Mount `LeaderboardLiveProvider` in `workspace/apps/frontend/src/app/layout.tsx` below `AuthProvider`/`InfrastructureProvider` and above `AppShell`, then refactor `workspace/apps/frontend/src/hooks/use-dashboard-summary.ts` and `workspace/apps/frontend/src/app/page.tsx` to consume provider Live state/SCORE Top-5 while retaining independent global loop/queue behavior and removing every Dashboard-owned `leaderboard:update` registration. (Depends on: T048)
- [X] T050 [P] [US5] Refactor `workspace/apps/frontend/src/hooks/use-leaderboard.ts` and `workspace/apps/frontend/src/app/leaderboard/page.tsx` to consume provider-owned active criterion, selection, snapshot, stale/error state, and explicit refetch; remove preference/socket injection and every `/leaderboard`-owned `leaderboard:update` registration while preserving Infrastructure status presentation. (Depends on: T048)

**Checkpoint**: One provider survives route navigation, owns one-or-zero handlers according to explicit preference, maintains authorized cache off-route, and makes prior-identity cache/responses unrenderable.

## Phase 7: Cross-cutting Regression, E2E, and Validation

**Purpose**: Reconcile typed fixtures, prove cross-route/two-user privacy across process boundaries, and close all quality gates. IDs T034-T042 are retained from the original pending release gate for audit history.

- [X] T034 [Regression] Reconcile all affected typed fixtures without weakening the contracts in `workspace/apps/backend/src/queue/bullmq-job.queue.spec.ts`, `workspace/apps/backend/src/queue/queue.integration.spec.ts`, `workspace/apps/backend/src/loop/strategy-loop.service.spec.ts`, `workspace/apps/backend/src/loop/loop.integration.spec.ts`, `workspace/apps/backend/src/dashboard/dashboard.service.spec.ts`, `workspace/apps/backend/src/dashboard/dashboard.integration.spec.ts`, `workspace/apps/frontend/src/contexts/leaderboard-live-context.spec.tsx`, `workspace/apps/frontend/src/hooks/use-leaderboard.spec.tsx`, and `workspace/apps/frontend/src/hooks/use-dashboard-summary.spec.tsx`; fixtures must use explicit UUID or `null`, never `undefined`, and page hooks must remain zero-listener consumers. (Depends on: T017, T019, T023, T049, T050)
- [X] T035 [P] [US1] Add backend E2E coverage in `workspace/apps/backend/test/per-user-leaderboard.e2e-spec.ts` and reuse setup from `workspace/apps/backend/test/app.e2e-spec.ts` for anonymous/user A/user B list, detail anti-enumeration, scoped Top-K/`updatedAt`, continuous ranks, global loop status, and privacy-safe websocket publication. (Depends on: T034)
- [X] T036 [P] [US3] Extend `workspace/apps/frontend/e2e/leaderboard.spec.ts` and `workspace/apps/frontend/e2e/infrastructure-fixture.mjs` for Dashboard -> other route -> `/leaderboard` -> Dashboard navigation, persisted ON/OFF and cache restoration, off-route invalidation with current session, SCORE/active-criterion sharing, re-enable race, reconnect in both states, page-versus-provider cleanup, exact listener counts, anonymous/A/B, A->B/A->anonymous, delayed A response rejection, two-user REST/realtime isolation, and absence of loop commands/shared disconnect; the fixture may delay REST/change deterministic identity but must add no production room/handshake/namespace/filter. (Depends on: T034, T049, T050)
- [X] T037 [Validation] Run the targeted backend unit/integration suites covering `workspace/apps/backend/src/leaderboard/`, `workspace/apps/backend/src/loop/`, `workspace/apps/backend/src/dashboard/`, `workspace/apps/backend/src/queue/`, and `workspace/apps/backend/src/strategy/ports/`; record commands and results in `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`. (Depends on: T035)
- [X] T038 [Validation] Run the targeted frontend suites covering `workspace/apps/frontend/src/contexts/leaderboard-live-context.spec.tsx`, provider consumer hooks, Dashboard/app-shell/page components, `workspace/apps/frontend/src/services/infrastructure-socket.spec.ts`, and `workspace/apps/frontend/src/hooks/use-infrastructure-socket.spec.tsx`; record default-OFF, persistence, navigation, listener-count, reconnect, cleanup, and identity-race results in `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`. (Depends on: T036)
- [X] T039 [Validation] Run TypeScript checks and production builds for `workspace/libs/shared`, `workspace/apps/backend`, and `workspace/apps/frontend` using scripts from `workspace/package.json`; append results to `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`. (Depends on: T037, T038)
- [X] T040 [Validation] Run the configured lint rules plus non-mutating format checks for `workspace/libs/shared` configuration and the exact backend/frontend files owned by `per-user-leaderboard-live-toggle` as enumerated in `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`; require zero lint errors, successful command exits, clean feature-scope diff inspection, and no weakened rules/contracts. Cross-team fixtures touched only for typed convergence are line-audited and covered by their targeted tests; unrelated lint debt elsewhere in those files and repository-wide lint/format debt are diagnostic rather than feature blockers. Inspect `workspace/apps/backend/prisma/schema.prisma` and `workspace/apps/backend/prisma/migrations/` to confirm no migration and no per-user `SearchLoopRun`/`SearchLoopCandidate` change; record all evidence in `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`. (Depends on: T039; feature-scoped gate approved 2026-08-24)
- [ ] T041 [Validation] Run the full backend E2E suite including `workspace/apps/backend/test/per-user-leaderboard.e2e-spec.ts` and the frontend Playwright suite including `workspace/apps/frontend/e2e/leaderboard.spec.ts`; append deterministic pass/fail evidence to `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`. (Depends on: T040)
- [ ] T042 [Validation] Execute and document all 13 scenarios from `sdd_artifacts/per-user-leaderboard-live-toggle/quickstart.md` in `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`, including Dashboard/other-route/`/leaderboard` navigation, reload/restart persistence, off-route current-session reconciliation, SCORE/criterion cache, re-enable/reconnect, page-versus-provider cleanup, anonymous/A/B, A->B/A->anonymous, delayed response rejection, and global-loop non-interference; explicitly verify symmetric A/B non-disclosure. (Depends on: T041)

**Final checkpoint**: All feature-scoped automated gates and full E2E suites pass, the manual two-user matrix is recorded, repository-wide debt outside the feature is separately reported, no Prisma migration exists, and `SearchLoopRun` remains global.

## Dependencies and Execution Order

1. Contract/type foundation: `T001 -> T002 -> T003`.
2. Ownership lifecycle: `T003 -> T004 -> T005`; producer invariants `T003 -> T006`; both close at `T007`.
3. Scoped leaderboard core: RED tasks `T008-T012` precede `T013-T015`; dashboard RED/implementation is `T016 -> T017`.
4. Global-loop guard work is independently test-first as `T018 -> T019` after the foundation checkpoint.
5. Realtime privacy: `T020-T022` must be RED before `T023`; do not implement rooms or a socket auth handshake in this feature.
6. Frontend pairs are `T024 -> T025`, `T026 -> T027`, `T028 -> T029`, and `T030 -> T031`; page wiring waits for all hook/panel implementations.
7. Preference amendment closes at `T043`; provider RED/implementation is `T043 -> T044 -> T045 -> T046 -> T047`.
8. Route-consumer RED coverage `T048` precedes both independent implementation branches `T049` (root/Dashboard) and `T050` (`/leaderboard`).
9. Release convergence waits for both route branches at `T034`; backend/frontend E2E split into `T035` and `T036`, targeted validation splits into `T037` and `T038`, then joins at `T039 -> T040 -> T041 -> T042`.

### Critical Path

`T043 -> T044 -> T045 -> T046 -> T047 -> T048 -> (T049 + T050) -> T034 -> T036 -> T038 -> T039 -> T040 -> T041 -> T042`

The backend release branch `T034 -> T035 -> T037` runs in parallel with `T034 -> T036 -> T038` and joins at T039.

## Parallel Opportunities

- After T003: T004, T006, T011, T012, T016, and T018 touch independent test files.
- After T023: T024, T026, T028, and T030 can be authored in parallel; T025, T027, and T029 can then be implemented in parallel after their own RED tests.
- After T031: T032 and T033 are independent regression suites.
- After T048: T049 and T050 modify disjoint root/Dashboard versus Leaderboard route files and can proceed in parallel.
- After T034: backend E2E T035 and frontend E2E T036 can proceed in parallel.
- `[P]` tasks: 21 of 50.

## Acceptance Coverage

| Story / requirement group | Task coverage |
|---------------------------|---------------|
| US1 scenarios 1-9; FR-001..007/020; SC-001..003 | T001-T017, T034-T035, T037, T041-T042 |
| US2 scenarios 1-5; FR-008..009/017; SC-007..008 | T006-T007, T018-T019, T033, T042 |
| US3 scenarios 1-9; FR-010..018/022; SC-004..007/010 | T024-T033, T043-T044, T048-T050, T036, T038, T041-T042 |
| US4 scenarios 1-9; FR-019..021/027/030; SC-003/006..008/012 | T004-T005, T020-T023, T033, T044-T045, T035-T038, T041-T042 |
| US5 scenarios 1-8; FR-011/014..016/023..027; SC-005..006/009..010/012 | T044, T047-T050, T034, T036, T038, T041-T042 |
| US5 scenarios 9-14; FR-019..020/028..030; SC-011 | T045-T047, T034, T036, T038, T041-T042 |

All 46 acceptance scenarios, 30 functional requirements, and 12 success criteria have an implementation or verification task. Delivered backend behavior remains covered as regression rather than being reimplemented.

## Implementation Strategy

### MVP Slice

Complete T001-T023 first. This yields the smallest privacy-safe backend: scoped REST reads, preserved global loop semantics, and system-only namespace-wide leaderboard invalidations without inventing rooms.

### Frontend Slice

Complete T024-T033 next. Keep one socket singleton; toggle only the `leaderboard:update` listener; attach before catch-up refetch; retain request-generation and watermark protections.

### Cross-route Convergence Slice

Complete T043-T050 test-first. The provider becomes the only cache/listener owner; Dashboard and `/leaderboard` become consumers, and identity generations prevent old-viewer render/commit.

### Release Gate

Complete T034-T042 only after T049 and T050. Release only after route-navigation, reload/restart, reconnect, page/provider cleanup, anonymous/A/B, A->B/A->anonymous, delayed-response rejection, and symmetric REST/realtime non-disclosure are demonstrated.
