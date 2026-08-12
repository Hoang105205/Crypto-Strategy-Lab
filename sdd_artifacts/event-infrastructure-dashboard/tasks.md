# Tasks: Event Infrastructure Dashboard

**Feature**: `event-infrastructure-dashboard`  
**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, and all files in `contracts/`  
**Authoritative context**: `kb/CONSTITUTION.md`, `kb/ARCHITECTURE.md`, `kb/MODULES.md`, `kb/modules/event-infrastructure.md`, and the Strategy Backtest, Leaderboard Update, and Strategy Search Loop flows  
**Task format**: `[ID] [P?] [Story] Description`

- **[P]** means the task can run in parallel with other tasks in the same phase because it edits different files and has no unresolved dependency on them.
- **[Foundation]** is cross-story work required before an independently testable user story can ship.
- Every implementation task must preserve module boundaries: Event Infrastructure consumes shared tokens/ports and never imports another module's implementation or directly accesses Strategy-owned tables.

---

## Phase 0: Contract and Persistence Foundation

**Purpose**: Reconcile authoritative contracts before code and establish BullMQ/Redis configuration, shared types, public ports, persistence fields, and the frontend test harness required by every subfeature.

- [ ] **T001** [Foundation] Reconcile `kb/contracts/events.yaml`, ADR-0013, `kb/modules/event-infrastructure.md`, `kb/MODULES.md`, and affected flows: BullMQ queue `backtest`, Redis AOF, producer UUID as BullMQ `jobId`, priorities `USER=1`/`SEARCH_LOOP=10` with equal-priority FIFO, three attempts with delays `[1000, 4000]`, bounded retention, stalled/idempotent recovery, terminal-only `BacktestFailed`, and Strategy-owned ports. This task blocks T002-T049.
- [ ] **T002** [Foundation] Update `workspace/libs/shared/src/events/index.ts`, `workspace/libs/shared/src/interfaces/infrastructure.ts`, `workspace/libs/shared/src/types/infrastructure.ts`, and `workspace/libs/shared/src/types/enums.ts` to mirror the reconciled event-bus and queue contracts: version-1 envelopes, cleanup subscriptions, required `jobId`, source/loop correlation rules, `QueueStats`, dead-letter types, terminal payloads, ranking criteria, Loop status/config, and `winRate` constrained to `[0,1]`. Depends on T001; satisfies data-model invariants and `contracts/event-bus.md` plus `contracts/job-queue-worker.md`.
- [ ] **T003** [P] [Foundation] Add Strategy-owned public boundary types `IStrategyExecutionPort`, `IBacktestResultPort`, and their input/result models to `workspace/libs/shared/src/interfaces/strategy.ts` and `workspace/libs/shared/src/types/strategy.ts`, then add centralized DI symbols to `workspace/apps/backend/src/shared/tokens.ts`; do not add Event Infrastructure Prisma access to `StrategyVersion` or `BacktestResult`. Depends on T001 and implements research D6.
- [ ] **T004** [P] [Foundation] Update `workspace/apps/backend/prisma/schema.prisma` and create `workspace/apps/backend/prisma/migrations/20260811_event_infrastructure_dashboard/migration.sql` to add `LeaderboardEntry.executedAt`, unique non-null `SearchLoopCandidate.jobId`, `SearchLoopCandidate.updatedAt`, and non-null `SearchLoopRun.stopOnNoImprovementIterations` defaulting to 50, with safe backfill/empty-table guards described in `data-model.md`; obtain Hoang's schema-owner review before applying. Depends on T001.
- [ ] **T005** [P] [Foundation] Add Vitest 2, jsdom, and React Testing Library scripts/dependencies in `workspace/apps/frontend/package.json`, create `workspace/apps/frontend/vitest.config.ts` and `workspace/apps/frontend/src/test/setup.ts`, and verify one smoke component test runs without changing the existing Market Data test/runtime configuration. Depends on T001 and implements research D14.
- [ ] **T006** [Foundation] Add BullMQ dependencies and validated Redis/BullMQ env schema, then run shared type-check/build and Prisma validation; add contract assertions for required `jobId`, priority/state mappings, Redis-aware `QueueStats`, terminal shape, Strategy ports, and queue/Loop enums. Depends on T002-T005; this is the P0 gate.

**Checkpoint**: The KB, shared TypeScript contracts, Strategy ports, and database schema agree; downstream modules can compile against one source of truth.

---

## Phase 1: Typed Event Bus (US1, P1)

**Goal**: Deliver a typed, isolated, fire-and-forget event bus with complete envelopes and deterministic subscription cleanup.

**Independent test**: Publish every active event through the public token, verify complete envelope/correlation metadata, verify `unsubscribe` is idempotent, and prove one throwing/rejecting subscriber cannot affect the publisher or sibling subscribers.

- [ ] **T007** [US1] Write failing unit tests in `workspace/apps/backend/src/events/event-bus.spec.ts` for all `contracts/event-bus.md` delivery rules: UUID event/correlation IDs, UTC timestamp, version 1, supplied correlation preservation, typed payload delivery, multiple subscribers, sync throw isolation, async rejection isolation, and idempotent cleanup. Depends on T006.
- [ ] **T008** [US1] Implement `workspace/apps/backend/src/events/event-bus.ts` as the `IEventBus` wrapper over EventEmitter2, including fire-and-forget handler wrappers, structured logging, and no exposure of the underlying emitter; make T007 pass. Depends on T007.
- [ ] **T009** [US1] Wire and export the `IEventBus` token from `workspace/apps/backend/src/events/events.module.ts` and register EventEmitter2 only once in `workspace/apps/backend/src/app.module.ts`; keep constructors DI-safe and use `import type` for decorated interface parameters. Depends on T008.
- [ ] **T010** [US1] Replace the Market Data optional/no-op event dependency with the real exported token by updating `workspace/apps/backend/src/market-data/market-data.module.ts`, and add boot/isolation coverage in `workspace/apps/backend/src/events/events.module.spec.ts` without changing `/market-data` REST, namespace, rooms, or channel behavior. Depends on T009.
- [ ] **T011** [US1] Run the Event Bus and Market Data targeted Jest suites plus backend type-check, then record the US1 result and demonstrated EventBus adapter swap seam in `sdd_artifacts/event-infrastructure-dashboard/validation.md`. Depends on T007-T010.

**Checkpoint**: US1 is independently usable by all publishers/subscribers through `IEventBus` only.

---

## Phase 2: Backtest Job Queue and Worker (US2, P1)

**Goal**: Persist producer-generated jobs in BullMQ/Redis, schedule USER work first, execute at concurrency three, recover after restart/stalls, retry deterministically, persist through ports, and dead-letter terminal failures exactly once.

**Independent test**: Against disposable Redis, enqueue USER and SEARCH_LOOP jobs, observe priority/FIFO and concurrency 3, restart NestJS with jobs waiting/delayed, simulate stalled recovery, retry at 1s/4s, and inspect/retry one terminal job through REST.

- [ ] **T012** [US2] Write failing Redis-backed adapter tests in `workspace/apps/backend/src/queue/bullmq-job.queue.spec.ts` for payload validation, UUID-as-BullMQ-ID, explicit duplicate conflict, priority 1/10 and FIFO, BullMQ-to-contract lifecycle/stats mapping, bounded retention, manual retry reset, and stable Redis-unavailable errors. Depends on T011 and `contracts/job-queue-worker.md`.
- [ ] **T013** [P] [US2] Write failing worker/DLQ tests in `backtest.worker.spec.ts` and `dead-letter.repository.spec.ts` with disposable Redis plus fake domain ports/Prisma: success ordering, non-retryable errors, custom 1s/4s backoff, three attempts, result-before-event persistence, stalled recovery idempotency, and exactly-once terminal events/mirror. Depends on T011.
- [ ] **T014** [US2] Create `bullmq.config.ts`, `redis.connection.ts`, and `queue.errors.ts`; validate Redis connection, queue name, concurrency 3, attempts 3, retention age/count, producer fail-fast behavior, persistent worker reconnect, custom backoff, and graceful connection teardown. Depends on T012-T013.
- [ ] **T015** [US2] Implement `bullmq-job.queue.ts` over BullMQ queue `backtest`: preserve producer `jobId`, explicit duplicate detection, priority mapping, status/stats mapping, retention, manual retry/reset, and correlation payload; make T012 pass. Depends on T014.
- [ ] **T016** [US2] Implement `workspace/apps/backend/src/queue/backtest.worker.ts` using only `IMarketDataService.getCandlesRange`, `IStrategyExecutionPort.resolveVersion`, `IBacktester.run`, `IEvaluator.evaluate`, and `IBacktestResultPort.save`; classify retryable versus terminal errors and publish terminal events only after persistence/dead-letter state is durable. Depends on T003, T015, and T013.
- [ ] **T017** [US2] Implement persistent dead-letter inspection/resolution in `workspace/apps/backend/src/queue/dead-letter.repository.ts` against Event Infrastructure-owned `DeadLetterJob`, enforcing one unresolved record per `jobId`, newest-first reads, and atomic resolved/requeued state transitions; make the repository cases in T013 pass. Depends on T004 and T013.
- [ ] **T018** [US2] Implement stable queue REST DTO validation and endpoints in `workspace/apps/backend/src/queue/queue.controller.ts` and `workspace/apps/backend/src/queue/queue.dto.ts` for `GET /api/queue/stats`, `GET /api/queue/dead-letter`, and `POST /api/queue/dead-letter/:jobId/retry`, returning `{error, code}` for `JOB_NOT_FOUND`, `JOB_ALREADY_RESOLVED`, and dependency failures. Depends on T015-T017.
- [ ] **T019** [US2] Wire `BullMqJobQueue`, in-process BullMQ Worker, Redis connections, repositories, controllers, config, shutdown hooks, and tokens in `queue.module.ts`; update USER/SEARCH_LOOP producers to await enqueue then publish observational `BacktestRequested`; assert no enqueue Event subscriber exists. Verify boot, Redis health failure, and clean teardown. Depends on T015-T018.
- [ ] **T020** [US2] Add Redis-backed integration scenarios covering USER priority, three concurrent jobs, restart survival for waiting/delayed work, successful persistence, retry exhaustion/DLQ, stalled recovery without duplicate side effects, Redis outage/recovery, graceful shutdown, REST inspection/retry, and retention; record evidence in `validation.md`. Depends on T019.

**Checkpoint**: US2 runs on the production BullMQ/Redis adapter while domain dependencies remain independently testable through ports.

---

## Phase 3: Realtime Leaderboard (US3, P2)

**Goal**: Observe successful backtests, persist every unique ranking entry, calculate deterministic ranks, expose best-per-version Top-K, and publish updates after successful persistence.

**Independent test**: Publish completed backtests including duplicates and ties, then verify persistence idempotency, the documented formula/tie-breaks, best-per-version Top-10 projection, REST detail, and one realtime update per accepted result.

- [ ] **T021** [US3] Write failing score and service tests in `workspace/apps/backend/src/leaderboard/scoring-policy.spec.ts` and `workspace/apps/backend/src/leaderboard/leaderboard.service.spec.ts` for formula clamping, `[0,1]` win rate, four-decimal tie comparison, Sharpe/MDD/`executedAt` tie-break order, `backtestResultId` idempotency, persist-all/rank-all, best-per-version Top-K, and publish-after-persist. Depends on T020 and `contracts/leaderboard-api.md`.
- [ ] **T022** [P] [US3] Write failing persistence tests in `workspace/apps/backend/src/leaderboard/leaderboard.repository.spec.ts` for unique result insertion, configurable sorting, deterministic global ranks, best entry per Strategy Version, configured K default 10, and detail lookup using mocked Prisma. Depends on T020 and T004.
- [ ] **T023** [US3] Implement the pure ranking formula and comparator in `workspace/apps/backend/src/leaderboard/scoring-policy.ts`, using named weights/limits and exact criteria from `contracts/leaderboard-api.md`; make scoring cases in T021 pass. Depends on T021.
- [ ] **T024** [US3] Implement `workspace/apps/backend/src/leaderboard/leaderboard.repository.ts` for Event Infrastructure-owned `LeaderboardEntry` persistence and deterministic queries without reading Strategy-owned tables; make T022 pass. Depends on T022-T023.
- [ ] **T025** [US3] Implement `workspace/apps/backend/src/leaderboard/leaderboard.service.ts` to subscribe to `BacktestCompleted`, validate metrics, ignore duplicate results, persist/rank, compose detail through `IBacktestResultPort`, and publish one exact-contract `LeaderboardUpdated` only after success. Depends on T024 and T003.
- [ ] **T026** [US3] Implement DTO/query validation, `GET /api/leaderboard`, and `GET /api/leaderboard/:strategyVersionId` in `workspace/apps/backend/src/leaderboard/leaderboard.controller.ts`, then wire controller/service/repository/event subscription and `LEADERBOARD_TOP_K=10` in `workspace/apps/backend/src/leaderboard/leaderboard.module.ts`; return stable invalid-sort, not-found, and dependency-unavailable codes. Depends on T025.
- [ ] **T027** [US3] Add module-boot and REST/event integration coverage in `workspace/apps/backend/src/leaderboard/leaderboard.integration.spec.ts`, run targeted tests/type-check, and append US3 evidence including the scoring-policy swap demonstration to `sdd_artifacts/event-infrastructure-dashboard/validation.md`. Depends on T026.

**Checkpoint**: US3 can be demonstrated from a `BacktestCompleted` event through REST ranking/detail without the Loop or frontend.

---

## Phase 4: Bounded Strategy Search Loop (US4, P2)

**Goal**: Orchestrate one bounded generate-enqueue-observe cycle through public ports/events with pause, resume, stop, late-result, and restart semantics.

**Independent test**: Start one bounded Loop using a fake generator, observe correlated candidate jobs and progress, pause/resume it, reject a concurrent start, and terminate it by each configured stop rule without post-stop generation/progress.

- [ ] **T028** [US4] Write failing repository/state tests in `workspace/apps/backend/src/loop/loop.repository.spec.ts` and `workspace/apps/backend/src/loop/loop-status.service.spec.ts` for transactional one-active-run checks, legal transitions, candidate `jobId` idempotency, ordered candidates, terminal counts, late-result persistence, restart recovery when BullMQ has matching work, and unrecoverable orphan reconciliation to `FAILED/orphaned_after_restart`. Depends on T020 and T004.
- [ ] **T029** [P] [US4] Write failing orchestration/controller tests in `workspace/apps/backend/src/loop/strategy-loop.service.spec.ts` and `workspace/apps/backend/src/loop/loop.controller.spec.ts` for config validation/default 50, producer UUIDs, RANDOM/DOMAIN_GUIDED port selection, epsilon `0.01`, three generation failures, stop-condition ordering, pause/resume/stop behavior, terminal event idempotency by `loopRunId`/`jobId`, no successor after pause/stop, and stable REST errors. Depends on T020.
- [ ] **T030** [US4] Implement Event Infrastructure-owned persistence and transitions in `workspace/apps/backend/src/loop/loop.repository.ts` and `workspace/apps/backend/src/loop/loop-status.service.ts`, using an application mutex plus transactional active-run check and the invariants in `data-model.md`; make T028 pass. Depends on T028.
- [ ] **T031** [US4] Implement `workspace/apps/backend/src/loop/strategy-loop.service.ts` as an event-driven state machine using only `IStrategyGenerator`, `IEventBus`, and `IJobQueue`: generate one candidate, create/preserve `jobId`, consume terminal events idempotently, update best score with epsilon, evaluate bounds in the specified order, and suppress successor/progress after pause or terminal stop. Depends on T030, T029, and T003.
- [ ] **T032** [US4] Implement `workspace/apps/backend/src/loop/loop.controller.ts` and `workspace/apps/backend/src/loop/loop.dto.ts` for start/pause/resume/stop/current/detail endpoints from `contracts/loop-api.md`, including ISO/date-range/backtest validation and stable `INVALID_LOOP_CONFIG`, `LOOP_ALREADY_ACTIVE`, `LOOP_NOT_FOUND`, `INVALID_LOOP_TRANSITION`, and dependency codes. Depends on T031.
- [ ] **T033** [US4] Wire generator/queue/event tokens, repository, status/orchestration services, controller, terminal subscriptions, and startup orphan reconciliation in `workspace/apps/backend/src/loop/loop.module.ts`; import it from `workspace/apps/backend/src/app.module.ts` and add DI/startup coverage in `workspace/apps/backend/src/loop/loop.module.spec.ts`. Depends on T031-T032.
- [ ] **T034** [US4] Add end-to-end Loop scenarios in `workspace/apps/backend/src/loop/loop.integration.spec.ts` for natural completion, each configured bound, one failed candidate continuing, pause/resume, user stop with late result, duplicate terminal event, concurrent start race, generator fatal failure, and restart recovery; run targeted tests/type-check and append US4 evidence plus generator-swap proof to `sdd_artifacts/event-infrastructure-dashboard/validation.md`. Depends on T033.

**Checkpoint**: US4 is independently demonstrable with fake generators/queue and cannot run unbounded.

---

## Phase 5: Dashboard BFF and Infrastructure Realtime Backend (US5, P3)

**Goal**: Compose snapshots and relay Leaderboard/Loop business events on a dedicated namespace while preserving predictable errors and existing Market Data behavior.

**Independent test**: Read one summary snapshot, connect to `/infrastructure`, receive all four documented channels, and verify subscriber/socket failures do not affect backend processing or `/market-data`.

- [ ] **T035** [US5] Write failing BFF/gateway tests in `workspace/apps/backend/src/dashboard/dashboard.service.spec.ts` and `workspace/apps/backend/src/dashboard/push.gateway.spec.ts` for Top-5 composition, active Loop/queue snapshots, partial dependency failures, exact four server channels/payloads, subscriber isolation, connection lifecycle, and no `/market-data` namespace changes. Depends on T027 and T034.
- [ ] **T036** [US5] Implement snapshot composition and `GET /api/dashboard/summary` in `workspace/apps/backend/src/dashboard/dashboard.service.ts` and `workspace/apps/backend/src/dashboard/dashboard.controller.ts`, plus reusable stable error mapping in `workspace/apps/backend/src/shared/infrastructure-error.filter.ts`; return `{error, code}` without stacks or raw dependency messages. Depends on T035 and `contracts/dashboard-realtime.md`.
- [ ] **T037** [US5] Implement `workspace/apps/backend/src/dashboard/push.gateway.ts` on configurable `INFRASTRUCTURE_WS_NAMESPACE=/infrastructure`, subscribe to the four Leaderboard/Loop events, relay exact payloads as `leaderboard:update`, `loop:started`, `loop:progress`, and `loop:stopped`, and clean subscriptions on shutdown; make gateway cases in T035 pass. Depends on T035-T036.
- [ ] **T038** [US5] Wire BFF dependencies, error filter, and gateway in `workspace/apps/backend/src/dashboard/dashboard.module.ts` and `workspace/apps/backend/src/app.module.ts`; add REST/socket/module integration coverage in `workspace/apps/backend/src/dashboard/dashboard.integration.spec.ts`, rerun Market Data gateway regression tests, and append backend US5 evidence to `sdd_artifacts/event-infrastructure-dashboard/validation.md`. Depends on T037.

**Checkpoint**: The backend provides authoritative snapshots plus isolated infrastructure realtime delivery.

---

## Phase 6: Dashboard and Leaderboard Frontend (US5, P3)

**Goal**: Add a responsive application shell, 8/4 dashboard, Loop control/status, queue health, realtime leaderboard preview/full view, drill-down, trade markers, and stale-safe reconnect behavior.

**Independent test**: Render Dashboard and Leaderboard with mocked snapshots/socket events, disconnect/reconnect, retain stale data with visible text state, refetch snapshots, reject older snapshots, and inspect a strategy's metrics/trades.

- [ ] **T039** [US5] Write failing service/hook contract tests in `workspace/apps/frontend/src/services/infrastructure-socket.spec.ts`, `workspace/apps/frontend/src/hooks/use-infrastructure-socket.spec.tsx`, `workspace/apps/frontend/src/hooks/use-dashboard-summary.spec.tsx`, and `workspace/apps/frontend/src/hooks/use-leaderboard.spec.tsx` for typed REST errors, lazy singleton `/infrastructure` socket, cleanup, connection text states, retained last-success data/timestamp, reconnect refetch, and timestamp/revision merge that ignores older snapshots. Depends on T038 and T005.
- [ ] **T040** [US5] Extend `workspace/apps/frontend/src/services/api-client.ts`, create `workspace/apps/frontend/src/services/infrastructure-socket.ts`, and implement `workspace/apps/frontend/src/hooks/use-infrastructure-socket.ts`, `workspace/apps/frontend/src/hooks/use-dashboard-summary.ts`, and `workspace/apps/frontend/src/hooks/use-leaderboard.ts` with the exact Dashboard/Leaderboard/Loop/queue types and reconciliation behavior from `contracts/dashboard-realtime.md`; do not reuse or modify the `/market-data` socket singleton. Depends on T039.
- [ ] **T041** [P] [US5] Create shell/state tests and components in `workspace/apps/frontend/src/components/common/app-shell.spec.tsx`, `workspace/apps/frontend/src/components/common/app-shell.tsx`, `workspace/apps/frontend/src/components/common/infrastructure-provider.tsx`, `workspace/apps/frontend/src/components/common/loading-state.tsx`, and `workspace/apps/frontend/src/components/common/error-boundary.tsx`, then integrate the shell/provider in `workspace/apps/frontend/src/app/layout.tsx`; preserve React 19 ref rules and make state text accessible rather than color-only. Depends on T040.
- [ ] **T042** [P] [US5] Write dashboard interaction/component tests in `workspace/apps/frontend/src/components/dashboard/dashboard-grid.spec.tsx`, `workspace/apps/frontend/src/components/dashboard/loop-status-panel.spec.tsx`, `workspace/apps/frontend/src/components/dashboard/queue-health-card.spec.tsx`, and `workspace/apps/frontend/src/components/dashboard/leaderboard-preview.spec.tsx` for 8/4 responsive layout, start/pause/resume/stop actions, queue counts, Top-5 navigation, loading/error/empty states, disconnect retention, and realtime updates. Depends on T040.
- [ ] **T043** [US5] Implement `workspace/apps/frontend/src/components/dashboard/dashboard-grid.tsx`, `workspace/apps/frontend/src/components/dashboard/loop-status-panel.tsx`, `workspace/apps/frontend/src/components/dashboard/queue-health-card.tsx`, and `workspace/apps/frontend/src/components/dashboard/leaderboard-preview.tsx`, then compose them with the existing Market Data grid in `workspace/apps/frontend/src/app/page.tsx`; make T042 pass without changing completed chart/subscription behavior. Depends on T041-T042.
- [ ] **T044** [US5] Write full Leaderboard/drill-down tests in `workspace/apps/frontend/src/components/leaderboard/leaderboard-table.spec.tsx`, `workspace/apps/frontend/src/components/leaderboard/leaderboard-detail.spec.tsx`, and `workspace/apps/frontend/src/components/chart/trade-markers.spec.tsx` for criterion sorting, rank/metric formatting, Top-K live updates, detail errors, trade marker mapping, empty trades, accessibility, and mobile layout. Depends on T040.
- [ ] **T045** [US5] Implement `workspace/apps/frontend/src/components/leaderboard/leaderboard-table.tsx`, `workspace/apps/frontend/src/components/leaderboard/leaderboard-detail.tsx`, and real trade overlays in `workspace/apps/frontend/src/components/chart/trade-markers.tsx`, then create `workspace/apps/frontend/src/app/leaderboard/page.tsx`; make T044 pass and append frontend US5 evidence to `sdd_artifacts/event-infrastructure-dashboard/validation.md`. Depends on T043-T044.

**Checkpoint**: US5 is independently demonstrable with REST-only fallback and reconnect-safe realtime enhancement.

---

## Phase 7: Cross-Cutting Validation and Handoff

**Purpose**: Prove all five subfeatures work together, protect completed work, and document the extension seams required by the Constitution.

- [ ] **T046** [Foundation] Run all backend unit/integration/module-boot suites, backend lint, shared/backend type-check, Prisma validation, and backend build from `workspace/apps/backend/package.json`; fix regressions only in feature-owned/shared-contract files and record command results in `sdd_artifacts/event-infrastructure-dashboard/validation.md`. Depends on T038.
- [ ] **T047** [P] [Foundation] Run all frontend Vitest suites, lint, type-check, and production build from `workspace/apps/frontend/package.json`, including existing Market Data regressions; record command results and any environment-only limitation in `sdd_artifacts/event-infrastructure-dashboard/validation.md`. Depends on T045.
- [ ] **T048** [Foundation] Execute every quickstart scenario, including disposable Redis, NestJS restart survival, stalled idempotency, Redis outage/recovery, and graceful shutdown; verify SC-001-SC-017 and record evidence/gaps in `validation.md`. Depends on T046-T047.
- [ ] **T049** [Foundation] Update `README.md`, backend/frontend `.env.example`, Docker Compose Redis AOF/healthcheck, module KB, and quickstart with Redis startup/configuration, namespace/channel details, stable errors, retention/backup notes, worker topology constraint, and extension demonstrations. Depends on T048.

---

## Dependencies and Execution Order

### Phase Dependencies

1. **Phase 0** is the blocking contract/schema gate.
2. **Phase 1 (US1)** depends on Phase 0 and provides the Event Bus used by all later backend stories.
3. **Phase 2 (US2)** depends on US1 and supplies terminal backtest events.
4. **Phase 3 (US3)** and **Phase 4 (US4)** both depend on US2 and may proceed in parallel after T020.
5. **Phase 5 (US5 backend)** depends on US3 and US4 because it composes/relays both.
6. **Phase 6 (US5 frontend)** depends on the backend contracts/integration surface from T038.
7. **Phase 7** depends on the completed backend and frontend paths.

### User Story Dependency Graph

```text
Foundation (T001-T006)
          |
          v
Typed Event Bus / US1 (T007-T011)
          |
          v
Job Queue + Worker / US2 (T012-T020)
          |
          +--------------------+
          v                    v
Leaderboard / US3       Search Loop / US4
  (T021-T027)             (T028-T034)
          +----------+---------+
                     v
       Dashboard Realtime Backend / US5
                  (T035-T038)
                     |
                     v
       Dashboard Realtime Frontend / US5
                  (T039-T045)
                     |
                     v
           Validation/Handoff (T046-T049)
```

### Parallel Opportunities

- T003, T004, and T005 can run in parallel after T001; T002 is separate but all converge at T006.
- T013 can run in parallel with T012 after US1 because it edits distinct queue test files.
- T022 can run in parallel with T021; repository and policy implementations converge at T025.
- T029 can run in parallel with T028; persistence and orchestration tests converge at T031.
- After T020, the complete US3 phase and US4 phase can run in parallel.
- T041 and T042 can run in parallel after T040; both converge at dashboard composition T043.
- T047 can run in parallel with T046 once its own frontend dependency T045 is complete.

### MVP and Incremental Delivery

1. Complete T001-T011 for a reusable typed Event Bus.
2. Complete T012-T020 for the first business-value slice: reliable asynchronous backtests.
3. Complete T021-T027 for observable ranking; this is the smallest demo with backend realtime value.
4. Complete T028-T034 to add bounded automated search without changing Queue or Leaderboard internals.
5. Complete T035-T045 for the Dashboard/Leaderboard user experience.
6. Complete T046-T049 before merge/demo; do not defer contract, restart, or Market Data regression gates.

## Completion Definition

- All 49 tasks are checked `[X]` with evidence where requested.
- All five user stories pass their independent tests.
- No active contract drift, direct cross-module implementation import, Strategy-table access from Event Infrastructure, unbounded Loop path, duplicate terminal Event, or `/market-data` regression remains.
- The next SDD command after task execution is `/hoang-sdd-analyze event-infrastructure-dashboard`.
