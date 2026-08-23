# Tasks: Per-user Leaderboard and Live Toggle

**Input**: Design documents in `sdd_artifacts/per-user-leaderboard-live-toggle/`  
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/leaderboard-rest.md`, `contracts/userid-propagation.md`, and `contracts/leaderboard-realtime.md` are complete.

**Task format**: `[ID] [P?] [Story] Description (Depends on: ...)`

- `[P]` means the task can run in parallel with other ready tasks because it owns different files.
- Story labels map to the P1 stories in `spec.md`: `[US1]` scoped REST reads, `[US2]` global loop semantics, `[US3]` frontend live toggle, and `[US4]` privacy-safe realtime/lifecycle.
- Every production-code task follows a RED test task. A test task may initially fail for the intended missing behavior, but must compile after its paired implementation.
- Do not add a Prisma migration: `LeaderboardEntry.userId` already exists in `workspace/apps/backend/prisma/schema.prisma`.
- Do not add `userId` to `SearchLoopRun`, `SearchLoopCandidate`, loop commands, or loop repository queries.

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

- [ ] T008 [US1] Add RED repository tests for anonymous, user A, and user B list scopes in `workspace/apps/backend/src/leaderboard/leaderboard.repository.spec.ts`; cover system-only anonymous visibility, `system + own` authenticated visibility, filter-before-best-per-version, filter-before-Top-K, and no A/B leakage. (Depends on: T007)
- [ ] T009 [US1] Extend the RED repository suite in `workspace/apps/backend/src/leaderboard/leaderboard.repository.spec.ts` for scoped detail, scoped `updatedAt`, scoped Top-K, and recomputed continuous ranks `1..N` after filtering; assert a viewer cannot address another user's row by ID. (Depends on: T008)
- [ ] T010 [US1] Add RED service tests in `workspace/apps/backend/src/leaderboard/leaderboard.service.spec.ts` for anonymous/A/B list, detail, Top-K, and `updatedAt` delegation, plus creation of `LeaderboardEntry.userId` from `BacktestCompleted.userId`. (Depends on: T003)
- [ ] T011 [P] [US1] Add RED controller metadata/delegation tests in `workspace/apps/backend/src/leaderboard/leaderboard.controller.spec.ts` proving every list/detail endpoint uses `SupabaseJwtGuard`, resolves `@CurrentUser()`, and passes `currentUser?.id ?? null` into the service. (Depends on: T003)
- [ ] T012 [P] [US1] Add a RED anti-enumeration scenario to `workspace/apps/backend/src/leaderboard/leaderboard.integration.spec.ts` proving user A and user B receive the same not-found response shape for an existing row owned by the other user as for a nonexistent ID. (Depends on: T003)
- [ ] T013 [US1] Implement nullable viewer scoping in `workspace/apps/backend/src/leaderboard/leaderboard.repository.ts`: apply `userId IS NULL OR userId = viewerUserId` before best-per-version selection, sorting, Top-K truncation, `updatedAt`, and rank recomputation; map persisted owner identity into `LeaderboardEntryPayload.userId`. (Depends on: T008, T009)
- [ ] T014 [US1] Implement scoped service signatures and entry-owner propagation in `workspace/apps/backend/src/leaderboard/leaderboard.service.ts`, including not-found behavior for out-of-scope detail reads. (Depends on: T005, T010, T013)
- [ ] T015 [US1] Apply `SupabaseJwtGuard` and `@CurrentUser()` in `workspace/apps/backend/src/leaderboard/leaderboard.controller.ts`, and import/reuse `AuthModule` in `workspace/apps/backend/src/leaderboard/leaderboard.module.ts`; do not create a new auth or leaderboard module. (Depends on: T011, T012, T014)
- [ ] T016 [P] [US1] Add RED unit/integration tests in `workspace/apps/backend/src/dashboard/dashboard.service.spec.ts` and `workspace/apps/backend/src/dashboard/dashboard.integration.spec.ts` proving dashboard leaderboard preview and leaderboard `updatedAt` use anonymous/A/B scope while loop and queue summaries remain global. (Depends on: T003)
- [ ] T017 [US1] Thread `@CurrentUser()` viewer scope through `workspace/apps/backend/src/dashboard/dashboard.controller.ts` and `workspace/apps/backend/src/dashboard/dashboard.service.ts`, and reuse `AuthModule` in `workspace/apps/backend/src/dashboard/dashboard.module.ts` without changing global loop/queue queries. (Depends on: T014, T016)

**Checkpoint**: List, detail, dashboard Top-K, and `updatedAt` are scoped consistently; ranks are continuous for the current view; private rows are non-enumerable across users.

## Phase 3: US2 — Guarded Controller, Global Search Loop

**Purpose**: Authenticate loop HTTP access without accidentally turning the singleton search loop into a per-user resource.

- [ ] T018 [P] [US2] Add RED tests in `workspace/apps/backend/src/loop/loop.controller.spec.ts` and `workspace/apps/backend/src/loop/loop.integration.spec.ts` proving every loop route uses `SupabaseJwtGuard` and `@CurrentUser()`, but anonymous/user A/user B identity never changes `SearchLoopRun` or `SearchLoopCandidate` repository arguments, records, or returned status. (Depends on: T007)
- [ ] T019 [US2] Apply `SupabaseJwtGuard` and `@CurrentUser()` to `workspace/apps/backend/src/loop/loop.controller.ts` and reuse `AuthModule` from `workspace/apps/backend/src/loop/loop.module.ts`; intentionally ignore viewer identity after authentication and leave `workspace/apps/backend/src/loop/strategy-loop.repository.ts` globally scoped. (Depends on: T018)

**Checkpoint**: Loop routes are guarded, but every authenticated viewer observes the same system-loop state and no per-user loop storage/query exists.

## Phase 4: US4 — Privacy-safe Namespace-wide Realtime

**Purpose**: Keep the existing unauthenticated shared socket safe by publishing only system leaderboard data and treating the event as an invalidation signal for private views.

- [ ] T020 [US4] Add RED publisher tests in `workspace/apps/backend/src/leaderboard/leaderboard.service.spec.ts` proving `LeaderboardUpdated.topK` and its watermark are computed from system entries only, private completion emits no private row or private result ID, and system completion may carry its result ID. (Depends on: T014)
- [ ] T021 [P] [US4] Update `workspace/apps/backend/src/dashboard/push.gateway.spec.ts` with exact wire-shape tests for the safe `leaderboard:update` relay, nullable trigger, system-only payload fixtures, and the invariant that the gateway calls `server.emit` without introducing rooms, socket auth, or disconnect behavior. (Depends on: T003)
- [ ] T022 [US4] Add a RED end-to-end publisher scenario in `workspace/apps/backend/src/leaderboard/leaderboard.integration.spec.ts` that processes user A and user B completions and spies on the gateway boundary to prove neither private Top-K rows nor private result IDs reach namespace-wide `server.emit`. (Depends on: T012, T014, T021)
- [ ] T023 [US4] Implement privacy-safe leaderboard publication in `workspace/apps/backend/src/leaderboard/leaderboard.service.ts`: build global event Top-K/`updatedAt` from `viewerUserId = null`, null the trigger for private completions, and keep `workspace/apps/backend/src/dashboard/push.gateway.ts` as an exact broadcast relay with no invented room protocol. (Depends on: T020, T021, T022)

**Checkpoint**: REST can return `system + own`; namespace-wide realtime can reveal system rows only and acts as a refetch trigger for authenticated private views.

## Phase 5: US3 — Live Toggle and Read-only Loop Panel

**Purpose**: Let the user pause only leaderboard rendering/listening while preserving the shared socket, global loop updates, and race protections.

- [ ] T024 [P] [US3] Add RED hook tests in `workspace/apps/frontend/src/hooks/use-leaderboard.spec.tsx` proving `leaderboard:update` is an invalidation/refetch signal rather than trusted row replacement, stale requests lose to `requestGeneration`, and existing watermark ordering remains effective. (Depends on: T023)
- [ ] T025 [P] [US3] Update `workspace/apps/frontend/src/hooks/use-leaderboard.ts` to refetch scoped REST data on safe realtime invalidation while retaining sort selection, request-generation protection, and watermark checks. (Depends on: T024)
- [ ] T026 [P] [US3] Add RED live-toggle tests in `workspace/apps/frontend/src/hooks/use-dashboard-summary.spec.tsx` for initial ON, OFF removing only the exact `leaderboard:update` handler and freezing the last snapshot, re-enable subscribe-before-refetch catch-up, no lost event during catch-up, reconnect while ON/OFF, listener deduplication, unmount cleanup, continued loop listeners, and no shared-socket disconnect. (Depends on: T023)
- [ ] T027 [P] [US3] Implement `isLeaderboardLive` and a stable leaderboard handler in `workspace/apps/frontend/src/hooks/use-dashboard-summary.ts`; OFF must call only `socket.off('leaderboard:update', sameHandler)`, while re-enable attaches first and then refetches under existing watermark/request-generation protection. (Depends on: T026)
- [ ] T028 [P] [US3] Add RED accessibility/component tests in `workspace/apps/frontend/src/components/dashboard/loop-status-panel.spec.tsx` for a labeled keyboard-operable live toggle, visible ON/OFF state, global loop status display, and absence of Start/Pause/Resume/Stop command controls. (Depends on: T023)
- [ ] T029 [P] [US3] Refactor `workspace/apps/frontend/src/components/dashboard/loop-status-panel.tsx` into a read-only system-loop status plus controlled live-view toggle; remove command API props and do not call loop command REST endpoints. (Depends on: T028)
- [ ] T030 [P] [US3] Add a RED page-wiring test in `workspace/apps/frontend/src/app/page.spec.tsx` proving dashboard state controls the live toggle, command handlers/start-request construction are absent, and loop-status rendering remains independent of leaderboard live state. (Depends on: T023)
- [ ] T031 [US3] Wire the controlled live state through `workspace/apps/frontend/src/app/page.tsx` and `workspace/apps/frontend/src/components/dashboard/dashboard-grid.tsx`; remove obsolete command props/useMemo request construction and leave `workspace/apps/frontend/src/services/infrastructure-socket.ts` as the singleton owner. (Depends on: T025, T027, T029, T030)
- [ ] T032 [P] [US3] Update component regressions in `workspace/apps/frontend/src/components/dashboard/dashboard-grid.spec.tsx` and `workspace/apps/frontend/src/components/dashboard/leaderboard-preview.spec.tsx` for frozen rows while OFF, caught-up rows after re-enable, and continuous view-local ranks. (Depends on: T031)
- [ ] T033 [P] [US3] Add/extend singleton lifecycle regression coverage in `workspace/apps/frontend/src/services/infrastructure-socket.spec.ts` and `workspace/apps/frontend/src/hooks/use-infrastructure-socket.spec.tsx` proving leaderboard listener cleanup never invokes `disconnect()` and does not remove loop/queue listeners owned by other consumers. (Depends on: T027)

**Checkpoint**: Live OFF freezes only the leaderboard snapshot; re-enable catches up without a subscribe/refetch gap; loop status and the singleton connection continue operating.

## Phase 6: Cross-cutting Regression, E2E, and Validation

**Purpose**: Reconcile typed fixtures, prove two-user privacy across process boundaries, and close all quality gates.

- [ ] T034 [Regression] Reconcile all affected typed fixtures without weakening the contracts in `workspace/apps/backend/src/queue/bullmq-job.queue.spec.ts`, `workspace/apps/backend/src/queue/queue.integration.spec.ts`, `workspace/apps/backend/src/loop/strategy-loop.service.spec.ts`, `workspace/apps/backend/src/loop/loop.integration.spec.ts`, `workspace/apps/backend/src/dashboard/dashboard.service.spec.ts`, `workspace/apps/backend/src/dashboard/dashboard.integration.spec.ts`, `workspace/apps/frontend/src/hooks/use-leaderboard.spec.tsx`, and `workspace/apps/frontend/src/hooks/use-dashboard-summary.spec.tsx`; fixtures must use explicit UUID or `null`, never `undefined`. (Depends on: T017, T019, T023, T031)
- [ ] T035 [P] [US1] Add backend E2E coverage in `workspace/apps/backend/test/per-user-leaderboard.e2e-spec.ts` and reuse setup from `workspace/apps/backend/test/app.e2e-spec.ts` for anonymous/user A/user B list, detail anti-enumeration, scoped Top-K/`updatedAt`, continuous ranks, global loop status, and privacy-safe websocket publication. (Depends on: T034)
- [ ] T036 [P] [US3] Extend `workspace/apps/frontend/e2e/leaderboard.spec.ts` and `workspace/apps/frontend/e2e/infrastructure-fixture.mjs` for realtime ON/OFF/frozen snapshot/re-enable catch-up, reconnect in both toggle states, exact listener cleanup, absence of loop command calls, and two-user REST/realtime isolation. (Depends on: T032, T033, T034)
- [ ] T037 [Validation] Run the targeted backend unit/integration suites covering `workspace/apps/backend/src/leaderboard/`, `workspace/apps/backend/src/loop/`, `workspace/apps/backend/src/dashboard/`, `workspace/apps/backend/src/queue/`, and `workspace/apps/backend/src/strategy/ports/`; record commands and results in `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`. (Depends on: T035)
- [ ] T038 [Validation] Run the targeted frontend hook/component/page suites covering `workspace/apps/frontend/src/hooks/`, `workspace/apps/frontend/src/components/dashboard/`, `workspace/apps/frontend/src/app/page.spec.tsx`, `workspace/apps/frontend/src/services/infrastructure-socket.spec.ts`, and `workspace/apps/frontend/src/hooks/use-infrastructure-socket.spec.tsx`; record commands and results in `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`. (Depends on: T036)
- [ ] T039 [Validation] Run TypeScript checks and production builds for `workspace/libs/shared`, `workspace/apps/backend`, and `workspace/apps/frontend` using scripts from `workspace/package.json`; append results to `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`. (Depends on: T037, T038)
- [ ] T040 [Validation] Run configured lint/format checks from `workspace/package.json`, then inspect `workspace/apps/backend/prisma/schema.prisma` and `workspace/apps/backend/prisma/migrations/` to confirm no migration and no per-user `SearchLoopRun`/`SearchLoopCandidate` change; record the audit in `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`. (Depends on: T039)
- [ ] T041 [Validation] Run the full backend E2E suite including `workspace/apps/backend/test/per-user-leaderboard.e2e-spec.ts` and the frontend Playwright suite including `workspace/apps/frontend/e2e/leaderboard.spec.ts`; append deterministic pass/fail evidence to `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`. (Depends on: T040)
- [ ] T042 [Validation] Execute and document the manual two-browser/two-token matrix from `sdd_artifacts/per-user-leaderboard-live-toggle/quickstart.md` in `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`: anonymous, user A, user B, list, detail, Top-K/`updatedAt`, realtime ON/OFF/re-enable, reconnect, and unmount cleanup; explicitly verify user A private data appears in neither REST nor realtime for user B and vice versa. (Depends on: T041)

**Final checkpoint**: All automated gates pass, the manual two-user matrix is recorded, no Prisma migration exists, and `SearchLoopRun` remains global.

## Dependencies and Execution Order

1. Contract/type foundation: `T001 -> T002 -> T003`.
2. Ownership lifecycle: `T003 -> T004 -> T005`; producer invariants `T003 -> T006`; both close at `T007`.
3. Scoped leaderboard core: RED tasks `T008-T012` precede `T013-T015`; dashboard RED/implementation is `T016 -> T017`.
4. Global-loop guard work is independently test-first as `T018 -> T019` after the foundation checkpoint.
5. Realtime privacy: `T020-T022` must be RED before `T023`; do not implement rooms or a socket auth handshake in this feature.
6. Frontend pairs are `T024 -> T025`, `T026 -> T027`, `T028 -> T029`, and `T030 -> T031`; page wiring waits for all hook/panel implementations.
7. E2E and validation begin only after fixture reconciliation at `T034`, then converge through `T039-T042`.

## Parallel Opportunities

- After T003: T004, T006, T011, T012, T016, and T018 touch independent test files.
- After T023: T024, T026, T028, and T030 can be authored in parallel; T025, T027, and T029 can then be implemented in parallel after their own RED tests.
- After T031: T032 and T033 are independent regression suites.
- After T034: backend E2E T035 and frontend E2E T036 can proceed in parallel.
- `[P]` tasks: 19 of 42.

## Implementation Strategy

### MVP Slice

Complete T001-T023 first. This yields the smallest privacy-safe backend: scoped REST reads, preserved global loop semantics, and system-only namespace-wide leaderboard invalidations without inventing rooms.

### Frontend Slice

Complete T024-T033 next. Keep one socket singleton; toggle only the `leaderboard:update` listener; attach before catch-up refetch; retain request-generation and watermark protections.

### Release Gate

Complete T034-T042. Release only after both user directions are demonstrated: user A cannot observe user B private data and user B cannot observe user A private data over either REST or realtime.
