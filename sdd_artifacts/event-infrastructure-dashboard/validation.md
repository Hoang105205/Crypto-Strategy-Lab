# Validation: Event Infrastructure Dashboard

## Phase 0 — Contract and Persistence Foundation

### T001 — Contract reconciliation

**Result**: PASS

**Command**:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\sdd_artifacts\event-infrastructure-dashboard\verification\verify-phase-0.ps1 -Task T001
```

**Evidence**:

```text
T001 verification PASS
```

The executable audit confirms that the active Event contract, ADR-0013, Event Infrastructure module boundary, module index, and the Strategy Backtest, Leaderboard Update, and Strategy Search Loop flows agree on queue `backtest`, Redis AOF, producer-owned BullMQ `jobId`, priorities `USER=1`/`SEARCH_LOOP=10`, FIFO within equal priority, three total attempts with delays `[1000, 4000]`, bounded retention, stalled-job recovery/idempotency, terminal-only `BacktestFailed`, and Strategy-owned execution ports. No KB content change was necessary because the referenced sources were already reconciled.

### T002 — Shared Event Bus and queue contracts

**Result**: PASS

**Commands**:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\sdd_artifacts\event-infrastructure-dashboard\verification\verify-phase-0.ps1 -Task T002
npm.cmd run build -w @crypto-strategy-lab/shared
```

**Evidence**:

```text
T002 verification PASS

> @crypto-strategy-lab/shared@0.0.1 build
> tsc
```

The audit verifies version-literal Event Envelopes, typed Event payload mapping and cleanup subscriptions, producer-required `jobId`, discriminated USER/SEARCH_LOOP correlation rules, Redis-aware `QueueStats`, Dead-letter types, terminal-only payloads, ranking/Loop enums and models, and branded normalized `[0,1]` `winRate`. The shared package then compiled successfully under strict TypeScript.

### T003 — Strategy-owned ports and DI tokens

**Result**: PASS

**Commands**:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\sdd_artifacts\event-infrastructure-dashboard\verification\verify-phase-0.ps1 -Task T003
npm.cmd run build -w @crypto-strategy-lab/shared
```

**Evidence**:

```text
T003 verification PASS

> @crypto-strategy-lab/shared@0.0.1 build
> tsc
```

The audit verifies `IStrategyExecutionPort`, `IBacktestResultPort`, their shared input/result models, and centralized runtime DI tokens. It also scans Event Infrastructure source and found no direct `prisma.strategyVersion` or `prisma.backtestResult` access.

### Additional compatibility checks

```text
git diff --check
Exit code: 0
```

The backend build was also attempted but is currently blocked by two pre-existing, out-of-scope `TS7006` implicit-`any` errors at `workspace/apps/backend/src/news/services/news.service.ts:158`. No Phase 0 contract error was reported before that failure. Shared lint could not start because the shared workspace has no ESLint 9 flat configuration (`eslint.config.js`); this is an existing tooling gap and was not expanded into Phase 0 scope.

### T004 â€” Prisma schema and review-only migration

**Result**: PASS — Hoang approved; migration applied to the project Supabase database on 2026-08-15

**Commands**:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\sdd_artifacts\event-infrastructure-dashboard\verification\verify-phase-0.ps1 -Task T004
$env:DATABASE_URL='postgresql://validation:validation@localhost:5432/validation'
npm.cmd exec -w @crypto-strategy-lab/backend -- prisma validate --schema prisma/schema.prisma

# After Hoang's schema-owner approval, from workspace/ with apps/backend/.env:
npm.cmd exec -w @crypto-strategy-lab/backend -- prisma migrate status --schema prisma/schema.prisma
npm.cmd exec -w @crypto-strategy-lab/backend -- prisma migrate deploy --schema prisma/schema.prisma
npm.cmd exec -w @crypto-strategy-lab/backend -- prisma migrate status --schema prisma/schema.prisma
```

**Evidence**:

```text
T004 verification PASS
The schema at prisma\schema.prisma is valid
Applying migration `20260811_event_infrastructure_dashboard`
All migrations have been successfully applied.
Database schema is up to date!
```

The schema contains required `LeaderboardEntry.executedAt`, unique non-null `SearchLoopCandidate.jobId`, `SearchLoopCandidate.updatedAt`, and non-null `SearchLoopRun.stopOnNoImprovementIterations @default(50)`. The review-only SQL backfills Leaderboard execution time from `createdAt`, aborts if candidate rows need a trustworthy producer-job backfill, and replaces null safety bounds with 50 before adding constraints. No relation or application access to Strategy-owned tables was added.

Hoang approved the reviewed migration. On 2026-08-15, `prisma migrate deploy` applied `20260811_event_infrastructure_dashboard` successfully to the project Supabase PostgreSQL database, and the follow-up `prisma migrate status` reported `Database schema is up to date!`. The Prisma 7 configuration deprecation warning was informational and did not affect migration execution.

### T005 â€” Frontend Vitest harness

**Result**: PASS

**Commands**:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\sdd_artifacts\event-infrastructure-dashboard\verification\verify-phase-0.ps1 -Task T005
npm.cmd run test -- --run src/test/smoke.spec.tsx
npm.cmd exec -- tsc --noEmit
```

**Evidence**:

```text
T005 verification PASS
Test Files  1 passed (1)
Tests       1 passed (1)
Frontend TypeScript check (exit 0)
```

Vitest 2.1.9, jsdom, React Testing Library, and jest-dom are configured. The smoke component rendered successfully in jsdom. Existing Market Data runtime files and its `/market-data` test/runtime configuration were not changed. The test required execution outside the filesystem sandbox because esbuild resolves ancestor paths while loading its config; the same test then passed unchanged.

### T006 â€” BullMQ dependencies, validated environment, and Phase 0 gate

**Result**: PASS

**Commands**:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\sdd_artifacts\event-infrastructure-dashboard\verification\verify-phase-0.ps1 -Task T006
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand config/environment.spec.ts shared/infrastructure-contract.spec.ts
npm.cmd run build -w @crypto-strategy-lab/shared
$env:DATABASE_URL='postgresql://validation:validation@localhost:5432/validation'
npm.cmd exec -w @crypto-strategy-lab/backend -- prisma validate --schema prisma/schema.prisma
git diff --check
```

**Evidence**:

```text
T006 verification PASS
Test Suites: 2 passed, 2 total
Tests:       9 passed, 9 total
@crypto-strategy-lab/shared build: tsc (exit 0)
The schema at prisma\schema.prisma is valid
git diff --check (exit 0)
```

The environment validator enforces Redis host/port/database, queue name `backtest`, concurrency 1â€“32 with default 3, fixed three attempts, and positive age/count retention. Executable contract assertions cover required producer `jobId`, source/state/priority-related enums, Redis-aware Queue Stats, terminal-only failure shape, Strategy-owned ports, ranking criteria, and Loop states. `bullmq` and `ioredis` are installed and locked.

Dependency installation reported five audit findings (three moderate, one high, one critical). No automatic or force audit fix was run because that could introduce unrelated/breaking dependency changes.

## Phase 0 Checkpoint

**PASS** — T001–T006 have evidence and are marked complete. Hoang approved the T004 migration, and it was applied successfully to the project Supabase database on 2026-08-15. Execution stops here as requested; T007 and all later phases remain untouched.

## Phase 1 — Typed Event Bus (T007–T011)

**Working directory**: `C:\Users\cpshc\Y3\Software Architecture\Project\Crypto-Strategy-Lab\workspace`

### Commands and results

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand events/event-bus.spec.ts events/events.module.spec.ts
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand market-data
npm.cmd run build -w @crypto-strategy-lab/backend
npm.cmd exec -w @crypto-strategy-lab/backend -- tsc --noEmit
npm.cmd exec -w @crypto-strategy-lab/backend -- tsc --noEmit -p tsconfig.build.json
git diff --check
rg -n -g '*.ts' -g '!*.spec.ts' 'EventEmitterModule\.forRoot|provide: IEVENT_BUS|@Inject\(IEVENT_BUS\)' apps/backend/src
$auditResult = rg -n -g '*.ts' -g '!*.spec.ts' '@Optional|IEventBus \| null|subscribe\(EventType\.MarketDataUpdated' apps/backend/src/events apps/backend/src/market-data; if ($LASTEXITCODE -eq 1) { Write-Output 'PASS: no optional/null Event Bus dependency or MarketDataUpdated subscriber in Events/Market Data'; exit 0 }; $auditResult; exit $LASTEXITCODE
$auditResult = rg -n -g '*.ts' -g '!*.spec.ts' "provide: 'IEventBus'|@Inject\('IEventBus'\)" apps/backend/src; if ($LASTEXITCODE -eq 1) { Write-Output 'PASS: no legacy IEventBus string provider/injection token'; exit 0 }; $auditResult; exit $LASTEXITCODE
```

| Check | Result | Evidence |
|---|---|---|
| Event Bus unit/module suites | PASS | 2/2 suites, 12/12 tests |
| Targeted Market Data suites | PASS | 5/5 suites, 35/35 tests |
| Backend Nest build | PASS | `nest build`, exit 0 |
| Backend source type-check | PASS | `tsc --noEmit -p tsconfig.build.json`, exit 0 |
| Full backend type-check including legacy specs | FAIL (pre-existing, outside Phase 1) | Strategy test errors listed below |
| Diff whitespace check | PASS | `git diff --check`, exit 0; line-ending conversion warnings only |
| Registration/token audit | PASS | One composition-root `EventEmitterModule.forRoot()`, one `IEVENT_BUS -> useExisting: EventBus` binding, centralized-token injection, no legacy string token |
| Market Data dependency audit | PASS | No optional/null Event Bus dependency and no `MarketDataUpdated` subscriber |

### Demonstrated behavior

- T007/T008 unit coverage proves all 10 active event definitions remain publishable with typed fixtures; every publication has a fresh UUID `eventId`, generated or preserved UUID `correlationId`, literal `eventVersion: 1`, UTC-capable `Date` `occurredAt`, and the original payload reference.
- Publication is fire-and-forget and does not throw. Multiple subscribers receive the event; synchronous throws and asynchronous rejections are isolated from the publisher and sibling subscribers, async failures are logged with structured `eventType`, `eventId`, and `correlationId` context, and no unhandled rejection escapes.
- Cleanup and `unsubscribe` prevent later delivery, are safe when called repeatedly, and do not remove sibling subscriptions.
- The module suite boots `EventsModule`, resolves the public `IEVENT_BUS` token, exercises publish/subscribe and failure isolation through `IEventBus`, and verifies deterministic cleanup without accessing the private EventEmitter2 instance.
- The adapter-swap test overrides only the `IEVENT_BUS` provider with a contract-compatible fake. The same token resolves the replacement and publish/subscribe succeeds without changing the consumer, demonstrating that consumers depend on the DI seam rather than `EventBus` or EventEmitter2.
- Market Data now requires `IEVENT_BUS` through `EventsModule` and still publishes the canonical `MarketDataUpdated` payload. The 35 targeted regression tests preserve `/market-data` REST behavior, WebSocket namespace/rooms/channel names, cache/persistence, subscription lifecycle, reconnect, and gap-recovery semantics.

### Full type-check blocker outside Phase 1

The unrestricted `tsc --noEmit` includes stale Strategy specs and fails before a repository-wide clean type-check can be claimed. Exact diagnostics are:

```text
src/strategy/controllers/tests/strategy.controller.spec.ts(4,33): TS2307 Cannot find module '../../events/event-bus.service'.
src/strategy/controllers/tests/strategy.controller.spec.ts(19,18): TS2554 Expected 1 arguments, but got 0.
src/strategy/controllers/tests/strategy.controller.spec.ts(34,18): TS2554 Expected 5 arguments, but got 4.
src/strategy/controllers/tests/strategy.controller.spec.ts(50,16): TS2339 Property 'strategy' does not exist on type Promise<...>.
src/strategy/controllers/tests/strategy.controller.spec.ts(55,47): TS7006 Parameter 'event' implicitly has an 'any' type.
src/strategy/controllers/tests/strategy.controller.spec.ts(69,16): TS2339 Property 'status' does not exist on type Promise<...>.
src/strategy/controllers/tests/strategy.controller.spec.ts(79,27): TS2339 Property 'strategy' does not exist on type Promise<...>.
src/strategy/controllers/tests/strategy.controller.spec.ts(83,20): TS2339 Property 'id' does not exist on type Promise<StrategyVersion>.
src/strategy/controllers/tests/strategy.controller.spec.ts(84,20): TS2339 Property 'name' does not exist on type Promise<StrategyVersion>.
src/strategy/controllers/tests/strategy.controller.spec.ts(100,28): TS2339 Property 'length' does not exist on type Promise<StrategyVersion[]>.
src/strategy/controllers/tests/strategy.controller.spec.ts(101,12): TS7053 Promise<StrategyVersion[]> cannot be indexed with 0.
src/strategy/events/tests/event-bus.spec.ts(1,33): TS2307 Cannot find module '../event-bus.service'.
src/strategy/events/tests/event-bus.spec.ts(24,46): TS7006 Parameter 'event' implicitly has an 'any' type.
```

These files are outside T007–T010. The passing Nest build and `tsconfig.build.json` source type-check, together with 47 passing targeted tests, distinguish the legacy test debt from the Phase 1 implementation. No out-of-scope Strategy test was changed.

## Phase 1 Checkpoint

**PASS — US1**. T007–T011 are complete, every Phase 1 requirement has executable evidence, and no error attributable to Phase 1 remains. Publishers and subscribers can use the typed, isolated Event Bus exclusively through `IEVENT_BUS`; Phase 2 may depend on this seam.

## Phase 2 — BullMQ/Redis Backtest Queue Checkpoint (T012–T020)

**Working directory**: `C:\Users\cpshc\Y3\Software Architecture\Project\Crypto-Strategy-Lab\workspace`

### Redis fixture and scope

- Tests use Redis 7 at `REDIS_HOST`/`REDIS_PORT`/`REDIS_DB` (defaults `127.0.0.1:6379/0`) with a unique queue name `csl-t020-${process.pid}-${randomUUID()}` per scenario.
- Cleanup calls BullMQ `obliterate({ force: true })` only on that unique queue. The suite contains no `FLUSHDB` and does not remove keys belonging to another suite/application.
- Production `BullMqJobQueue`, `BacktestWorker`, `BullMqWorkerHost`, config, backoff and connection ownership are used. Market Data, Strategy execution, Backtester, Evaluator, Backtest Result and Event Bus are approved port fakes; no live Binance or sentiment dependency is used.
- The restart scenario closes and reconstructs the Nest-owned queue/producer/worker resources while the Redis process remains running. This proves Nest/application restart recovery, not Redis server restart.
- The outage scenarios use an unavailable producer endpoint (`127.0.0.1:1`) and an unexpected socket destruction on the isolated worker client. The worker test observes `reconnecting` then `ready`; it does not stop the shared Redis server.
- The real stalled fixture uses `lockDuration=200ms`, `stalledInterval=200ms`, `skipLockRenewal=true`, and `maxStalledCount=1` only on the deliberately stalling test worker. The recovery worker renews normally. These shortened lock values are test fixture configuration, not production defaults.

### Acceptance evidence

| US2 behavior | Result | Executable evidence |
|---|---|---|
| USER priority and FIFO at equal priority | PASS | Four jobs enqueued before a concurrency-1 worker complete as USER-1, USER-2, SEARCH_LOOP-1, SEARCH_LOOP-2. |
| Peak concurrency exactly three | PASS | Five blocked jobs reach `processing=3`, leave `queued=2`, observe peak 3, and never exceed 3. |
| Successful pipeline ordering | PASS | Redis ISO dates are rehydrated to `Date`; one immutable result save occurs before one `BacktestCompleted` publication. |
| Waiting and delayed restart survival | PASS | Queue/worker resources are closed and recreated while Redis stays running; both jobs retain the same BullMQ `jobId`, and the delayed job completes on attempt 2. |
| Retry/backoff and terminal effects | PASS | Permanent retryable failure executes exactly 3 times; measured gaps are at least 850ms and 3800ms for configured 1s/4s waits; one DLQ mirror, one `BacktestFailed`, and one `BacktestDeadLettered` result. |
| Non-retryable skip | PASS | Zero candles invokes Market Data once, never invokes Backtester, consumes one attempt, and produces one DLQ mirror plus one terminal Event pair. Missing-version behavior remains covered by the Redis-backed T013 worker matrix. |
| Duplicate/stalled idempotency | PASS | Direct duplicate delivery and a real expired BullMQ lock/recovery claim each produce one Backtest Result and one completion Event; duplicate terminal delivery produces one mirror and one terminal Event pair. |
| Producer outage and worker recovery | PASS | Producer rejects with stable `QUEUE_UNAVAILABLE` in under 3 seconds; isolated worker transport reconnects and then completes a newly enqueued job. |
| Graceful shutdown | PASS | `Worker.close()` waits for the active job, does not claim the second job, closes after the barrier is released, and the waiting job completes after worker recreation. |
| REST DLQ inspection/manual retry | PASS | Production controller lists the terminal record, returns `{jobId,status:'QUEUED'}`, retains the same payload/identity, resets `attemptsMade` to 0, and the recovered job completes. |
| Bounded retention | PASS | Five completions with `{age:60,count:2}` converge to exactly two retained completed jobs; both completed/failed options carry the same age/count bound. |

### Production gaps exposed and corrected by T020

1. BullMQ JSON storage converts `Date` values to ISO strings. `BacktestWorker` now rehydrates request dates once at the Redis-to-domain boundary before calling `IMarketDataService` or saving a result.
2. Terminal persistence/events previously left BullMQ metadata as ordinary `FAILED`. The worker now marks the authoritative Redis job `deadLettered=true` with the terminal reason before mirroring and publishing, so status/stats/manual retry project `DEAD_LETTER` consistently.

### Commands and results

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand --detectOpenHandles queue/queue.integration.spec.ts
# Test Suites: 1 passed, 1 total
# Tests:       14 passed, 14 total

npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand --detectOpenHandles queue strategy/controllers/strategy.controller.queue.spec.ts strategy/strategy-runtime.module.spec.ts
# Test Suites: 11 passed, 11 total
# Tests:       79 passed, 79 total

npm.cmd exec -w @crypto-strategy-lab/backend -- tsc --noEmit -p tsconfig.build.json
# exit 0

npm.cmd run build -w @crypto-strategy-lab/backend
# nest build, exit 0

git diff --check
# exit 0; line-ending conversion warnings only
```

The developer machine does not have `rg`, so the requested read-only audits were executed with PowerShell `Get-ChildItem`, `Where-Object`, and `Select-String` instead. Results:

```text
PASS boundary: processor uses shared ports; Queue has no Strategy-table Prisma access
PASS token: no active legacy IJobQueue string binding/injection
PASS event: no BacktestRequested enqueue subscriber
PASS isolation: T020 suite contains no FLUSHDB
```

### Persistence claim and known out-of-scope gap

The current `workspace/docker-compose.yml` mounts `/data` but does **not** explicitly configure Redis `appendonly yes`/`appendfsync`. Therefore this checkpoint does not claim a Redis process restart or AOF survival test, despite older ADR/KB prose describing AOF as the target policy. Enabling and documenting Compose AOF/healthcheck remains the explicitly scheduled T049 operational handoff. No shared Redis instance was restarted or reconfigured during T020.

## Phase 2 Checkpoint

**PASS — US2 runtime acceptance**. T012–T020 are complete (9/9). The production BullMQ adapter and in-process worker demonstrate scheduling, bounded concurrency, persistence-before-event ordering, retry/DLQ behavior, real stalled recovery, stable outage behavior, graceful lifecycle, operator recovery, and bounded retention without live external domain services. T021/Leaderboard was not started. The Compose AOF delivery gap above remains explicitly unclaimed and assigned to T049.

## Phase 3 — Realtime Leaderboard Checkpoint (T021–T027)

**Working directory**: `C:\Users\cpshc\Y3\Software Architecture\Project\Crypto-Strategy-Lab\workspace`

### Commands and results

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand leaderboard
# Test Suites: 5 passed, 5 total
# Tests:       60 passed, 60 total

npm.cmd exec -w @crypto-strategy-lab/backend -- tsc --noEmit -p tsconfig.build.json
# exit 0

npm.cmd run build -w @crypto-strategy-lab/backend
# nest build, exit 0

npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand --detectOpenHandles events queue
# Test Suites: 13 passed, 13 total
# Tests:       91 passed, 91 total

$env:DATABASE_URL='postgresql://validation:validation@localhost:5432/validation'
npm.cmd exec -w @crypto-strategy-lab/backend -- prisma validate --schema prisma/schema.prisma
# The schema at prisma\schema.prisma is valid

git diff --check
# exit 0; line-ending conversion warnings only
```

### T027 integration evidence

- The Nest test application boots production `LeaderboardModule`, production `EventsModule`/`EventBus`, controller, service, scoring policy, and repository wiring. Only `PrismaService` is replaced by a stateful isolated persistence fake and `IBACKTEST_RESULT_PORT` by its public contract fake.
- Publishing `BacktestCompleted` through `IEVENT_BUS` exercises runtime validation, score calculation, unique persistence, full deterministic reranking, best-per-version Top-K projection, and exactly one `LeaderboardUpdated` with the original correlation ID.
- Duplicate delivery creates no second row, rerank, or broadcast. Malformed metrics create no row. An injected persistence failure is isolated by EventBus and emits no `LeaderboardUpdated`.
- Four-decimal score ties execute the complete Sharpe Ratio, absolute drawdown severity, earlier `executedAt`, and result-identity fallback ordering. All accepted rows remain persisted while configured Top-K = 2 exposes one best row per Strategy Version.
- REST integration covers every shared `RankingCriterion`, detail composition through `IBacktestResultPort`, and sanitized `INVALID_SORT_CRITERION` (400), `LEADERBOARD_ENTRY_NOT_FOUND` (404), and `STRATEGY_ENGINE_UNAVAILABLE` (503) bodies.
- Repeated application shutdown invokes Leaderboard unsubscribe once, and publishing after shutdown produces no new persistence side effect.
- Overriding only the `ScoringPolicy` provider changes the persisted score to the alternative policy's sentinel value. Worker, Backtester, Evaluator, repository, controller, and event wiring remain unchanged, demonstrating the scoring-policy swap seam.

### Boundary and scope audit

```text
PASS: Leaderboard production Prisma calls are limited to prisma.leaderboardEntry and transaction.leaderboardEntry (plus PrismaService.$transaction).
PASS: executable Prisma tripwires observed no strategyVersion or backtestResult delegate access.
PASS: no forbidden BacktestWorker, Backtester, Evaluator, PushGateway, WebSocket, or SearchLoop import/access in Leaderboard production files.
PASS: no diff in backtest.worker.ts, backtester.ts, or evaluator.ts.
PASS: no PushGateway/WebSocket, Search Loop, or frontend files changed for T027.
```

Prisma emitted only its existing package.json configuration deprecation warning; schema validation passed. No pre-existing or out-of-scope test/build failure was encountered in the requested T027 command matrix.

## Phase 3 Checkpoint

**PASS — US3 runtime acceptance**. T021–T027 are complete (7/7). The production Observer path is demonstrated from `BacktestCompleted` through persistent deterministic ranking, exact update publication, and sortable/detail REST reads while preserving Strategy ownership boundaries and scoring-policy replaceability.
