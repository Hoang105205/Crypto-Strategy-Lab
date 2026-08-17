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

## Phase 4 — Bounded Strategy Search Loop Checkpoint (T028–T034)

**Working directory**: `C:\Users\cpshc\Y3\Software Architecture\Project\Crypto-Strategy-Lab\workspace`

### Integration harness and scope

- `loop.integration.spec.ts` boots production `LoopModule`, `LoopRepository`, `LoopStatusService`, `StrategyLoopService`, and production `EventsModule`/`EventBus` behavior.
- It replaces only external boundaries: `PrismaService` with a stateful isolated Loop persistence fake, `IJOB_QUEUE` with a contract queue fake, and `ISTRATEGY_CANDIDATE_PORT` with a contract generator/version fake. Production `ScoringPolicy` remains behind `ISCORING_POLICY`.
- No live Binance, sentiment, frontend, Redis, or PostgreSQL dependency is used by the T034 integration suite. Redis is used only by the separately requested pre-existing Queue regression suites.
- Terminal outcomes are published through `IEVENT_BUS`, so production Loop subscriptions, lifecycle cleanup, persistence, next-candidate scheduling, and observational Loop events are exercised together.

### Scenario evidence

| T034 behavior | Result | Executable evidence |
|---|---|---|
| Natural completion / candidate bound | PASS | With `maxCandidates=5`, exactly five candidates become terminal, five queue requests and five `BacktestRequested` events are observed, `testedCandidates=5`, stop reason is `max_candidates_reached`, and no sixth request is created. |
| Duration bound | PASS | An elapsed run stops with `max_duration_reached` before another candidate is generated. |
| No-improvement bound | PASS | One improving result followed by the configured consecutive non-improvements stops with `no_improvement_limit_reached` and creates no successor. |
| Failed candidate continues | PASS | A failed candidate is persisted/accounted once and the run schedules the next candidate instead of stopping. |
| Pause/resume | PASS | An in-flight result received while paused is persisted without progress/successor; resume continues the same run with one next request. |
| User stop plus late result | PASS | User stop emits one terminal lifecycle outcome; the late result is still persisted, but creates no progress event or successor request. |
| Duplicate terminal event | PASS | Re-delivering the same terminal completion leaves one terminal candidate/accounting update and one successor/progress effect. |
| Concurrent start | PASS | Two concurrent starts yield one active run and one initial request; the loser receives stable `LOOP_ALREADY_ACTIVE`. |
| Generator fatal | PASS | Three consecutive generation failures transition the run to `FAILED` with `generator_error` and enqueue no backtest. |
| Recoverable restart | PASS | Startup reconciliation preserves active runs whose in-flight jobs report `QUEUED` or `PROCESSING`. |
| Orphan restart | PASS | `JOB_NOT_FOUND` reconciles the run to `FAILED` with `orphaned_after_restart`. |
| Dependency outage | PASS | `QUEUE_UNAVAILABLE` is deferred and the run remains active; it is not mislabeled as orphaned. |
| Generator swap | PASS | Overriding only `ISTRATEGY_CANDIDATE_PORT` changes the materialized Strategy Version used by persistence/queue while production `StrategyLoopService` remains unchanged. |

### Commands and actual results

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand loop/loop.integration.spec.ts
# Test Suites: 1 passed, 1 total
# Tests:       14 passed, 14 total

npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand loop
# Test Suites: 6 passed, 6 total
# Tests:       128 passed, 128 total

npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand --detectOpenHandles events queue leaderboard
# First attempt: 14 suites / 117 tests passed; 4 Queue suites / 34 tests failed at their explicit Redis prerequisite because Redis was not running.

docker compose up -d redis
# Container csl-redis Running (after Docker Desktop was started).

npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand --detectOpenHandles events queue leaderboard
# Clean rerun: Test Suites: 18 passed, 18 total
# Clean rerun: Tests:       151 passed, 151 total

npm.cmd exec -w @crypto-strategy-lab/backend -- tsc --noEmit -p tsconfig.build.json
# exit 0

npm.cmd run build -w @crypto-strategy-lab/backend
# nest build, exit 0

$env:DATABASE_URL='postgresql://validation:validation@localhost:5432/validation'
npm.cmd exec -w @crypto-strategy-lab/backend -- prisma validate --schema prisma/schema.prisma
# The schema at prisma\schema.prisma is valid; existing Prisma 7 configuration deprecation warning only.

git diff --check
# exit 0; line-ending conversion warnings only
```

The integration suite was also run by scenario group before its full run: completion/configured bounds 3/3, terminal failure/idempotency 2/2, commands/races 4/4, restart reconciliation 4/4, and generator replacement 1/1.

### Boundary audit

```text
PASS: T034 changes no production source; it adds the Loop integration specification and checkpoint/lesson metadata only.
PASS: Loop production contains no StrategyVersioningService, SearchEngine, strategyVersion/backtestResult Prisma delegate, or forwardRef access.
PASS: Prisma access remains owned by LoopRepository; the integration fake models only Loop-owned delegates and transaction behavior.
PASS: no live Binance, sentiment, frontend, HTTP client, or external URL appears in loop.integration.spec.ts.
PASS: public Symbol tokens are used for generator/version, queue, scoring, and event boundaries; no string-token workaround was introduced.
PASS: AppModule imports LoopModule exactly once.
```

## Phase 4 Checkpoint

**PASS — US4 runtime acceptance**. T028–T034 are complete (7/7). The production bounded search Loop is demonstrated across completion bounds, failed/duplicate/late terminal outcomes, lifecycle commands, concurrent start, generator fatal handling, restart reconciliation, dependency discrimination, and generator replaceability without direct Strategy or Queue implementation coupling.

## Phase 5 — Dashboard BFF and Infrastructure Realtime Backend Checkpoint (T035–T038)

**Working directory**: `C:\Users\cpshc\Y3\Software Architecture\Project\Crypto-Strategy-Lab\workspace`

### T038 integration scope

- The Nest test application imports production `DashboardModule` plus production `EventsModule`/`EventBus` behavior. It replaces Leaderboard, Loop, and Queue modules with test contract modules exporting the same public `LeaderboardService`, `LoopStatusService`, and `IJOB_QUEUE` boundaries; no repository, Prisma, BullMQ worker, Binance, or external service is booted.
- Module boot resolves `DashboardService`, `DashboardController`, `PushGateway`, `InfrastructureErrorFilter`, and all four public dependencies without `forwardRef`.
- HTTP integration covers active/null Loop summaries, SCORE Top-5 slice projection with original rank/order, complete QueueStats, ISO timestamps, all three dependency failure paths, sanitized public bodies, and preservation of a stable application `HttpException`.
- A real Socket.IO client connects to the ephemeral `/infrastructure` namespace and receives `leaderboard:update`, `loop:started`, `loop:progress`, and `loop:stopped` with the exact serialized source payloads.
- Production EventBus integration proves a socket emit failure does not escape to the publisher or block sibling delivery. Listener-count assertions prove one subscription for each relay event, no reserved Market Data/News subscriptions, and zero relay listeners after shutdown.
- Existing Market Data namespace metadata, candle rooms, candle/status channels, and client lifecycle remain unchanged and pass their original regression suite.

### Commands and actual results

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand dashboard/dashboard.service.spec.ts dashboard/push.gateway.spec.ts events/event-bus.spec.ts market-data/websocket/market-data.gateway.spec.ts
# Baseline before T038 wiring: Test Suites: 4 passed, 4 total
# Baseline before T038 wiring: Tests:       33 passed, 33 total

npm.cmd exec -w @crypto-strategy-lab/backend -- jest --runInBand --forceExit --testNamePattern="boots and resolves" dashboard/dashboard.integration.spec.ts
# Expected RED: 1 failed, 9 skipped; Nest could not find LeaderboardReaderFake because DashboardModule was empty.

npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand --detectOpenHandles dashboard/dashboard.integration.spec.ts
# Test Suites: 1 passed, 1 total
# Tests:       10 passed, 10 total

npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand dashboard/dashboard.service.spec.ts dashboard/push.gateway.spec.ts dashboard/dashboard.integration.spec.ts market-data/websocket/market-data.gateway.spec.ts
# Test Suites: 4 passed, 4 total
# Tests:       36 passed, 36 total

npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand --detectOpenHandles dashboard events queue leaderboard loop market-data/websocket/market-data.gateway.spec.ts
# Test Suites: 28 passed, 28 total
# Tests:       315 passed, 315 total

npm.cmd exec -w @crypto-strategy-lab/backend -- tsc --noEmit -p tsconfig.build.json
# exit 0

npm.cmd run build -w @crypto-strategy-lab/backend
# nest build, exit 0

npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand --detectOpenHandles
# Test Suites: 55 passed, 55 total
# Tests:       442 passed, 442 total

npm.cmd exec -w @crypto-strategy-lab/backend -- tsc --noEmit -p tsconfig.json --pretty false
# Initial T038 run: exit 1 with 16 pre-existing test-only typing errors in Leaderboard, Loop, Queue, and Strategy.
# Phase 5 completion cleanup rerun: exit 0 after test-only mock/fake/fixture typing reconciliation; production behavior unchanged.

npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand --detectOpenHandles dashboard/dashboard.service.spec.ts dashboard/push.gateway.spec.ts dashboard/dashboard.integration.spec.ts events/event-bus.spec.ts market-data/websocket/market-data.gateway.spec.ts leaderboard/leaderboard.integration.spec.ts loop/loop.integration.spec.ts loop/loop.module.spec.ts queue/queue.integration.spec.ts strategy/ports/strategy-candidate.port.spec.ts
# Phase 5 completion cleanup: Test Suites: 10 passed, 10 total
# Phase 5 completion cleanup: Tests:       87 passed, 87 total

npm.cmd exec -w @crypto-strategy-lab/backend -- eslint src/dashboard/dashboard.module.ts src/dashboard/dashboard.service.ts src/dashboard/dashboard.controller.ts src/dashboard/push.gateway.ts src/dashboard/dashboard.service.spec.ts src/dashboard/push.gateway.spec.ts src/dashboard/dashboard.integration.spec.ts src/shared/infrastructure-error.filter.ts
# Phase 5 production/unit/integration lint: exit 0
```

### Boundary audit and limitations

```text
PASS: AppModule already imports DashboardModule exactly once; T038 does not modify AppModule.
PASS: DashboardModule has no forwardRef and wires only public module/provider boundaries.
PASS: Dashboard/Gateway production source has no repository, Prisma, BullMqJobQueue, MarketDataGateway, MarketDataUpdated, or NewsCollected dependency.
PASS: no sorting, score calculation, reranking, or Loop-state orchestration is introduced in Dashboard/Gateway.
PASS: full backend Jest exits cleanly under --detectOpenHandles after 55 suites / 442 tests.
PASS: full backend test TypeScript, source TypeScript, shared build, backend build, and all Phase 5 lint targets are green after test-only typing/lint cleanup.
PASS: Event Infrastructure KB paths, BFF public calls, summary wire shape, infrastructure namespace, and integration evidence match the implementation.
```

## Phase 5 Checkpoint

**PASS — US5 backend runtime acceptance**. T035–T038 are complete (4/4). The backend now exposes an authoritative, failure-safe Dashboard summary and isolated four-channel infrastructure realtime delivery with deterministic cleanup while preserving the existing Market Data transport contract.

## Phase 6 — T039 Frontend Service/Hook Contract RED Gate

**Working directory**: `C:\Users\cpshc\Y3\Software Architecture\Project\Crypto-Strategy-Lab\workspace`

### Scope and contract coverage

- Added only the four T039 service/hook specification files; no T040 production source or existing Market Data frontend source was modified.
- The REST contract requires a parsed successful Dashboard snapshot and a stable typed error retaining HTTP `status`, public `code`, and safe `message`.
- The infrastructure Socket.IO client contract requires a lazy singleton at `/infrastructure`, no `/market-data` reuse, one connection, and idempotent disconnect/reset.
- The socket hook contract requires readable `connected`/`reconnecting`/`disconnected` state and exact-reference listener teardown without `removeAllListeners()`.
- Dashboard/Leaderboard hooks retain the last successful data/timestamp through disconnect and refresh failure, stay stale until reconnect refetch resolves, and reject out-of-order request generations.
- Leaderboard reconciliation rejects a snapshot older than the latest realtime `updatedAt` and preserves the user's sort and selected Strategy.
- Loop reconciliation introduces no invented server timestamp: an in-flight REST response cannot overwrite a later realtime event, counters do not regress for the same run, and a terminal run cannot be resurrected by late progress.

### Commands and actual results

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend
# Baseline before T039: Test Files 1 passed (1); Tests 1 passed (1).

npm.cmd exec -w @crypto-strategy-lab/frontend -- tsc --noEmit
# Baseline before T039: exit 0.

npm.cmd run test -w @crypto-strategy-lab/frontend -- src/services/infrastructure-socket.spec.ts src/hooks/use-infrastructure-socket.spec.tsx src/hooks/use-dashboard-summary.spec.tsx src/hooks/use-leaderboard.spec.tsx
# Expected RED: Test Files 4 failed (4); Tests 16 failed (16).
# All four files were collected. The two REST cases fail because getDashboardSummary is not yet
# implemented; the remaining cases fail because the three T040 production modules do not yet exist.
# No failure came from TypeScript syntax, jsdom setup, test collection, or mock cleanup.

npm.cmd exec -w @crypto-strategy-lab/frontend -- eslint src/services/infrastructure-socket.spec.ts src/hooks/use-infrastructure-socket.spec.tsx src/hooks/use-dashboard-summary.spec.tsx src/hooks/use-leaderboard.spec.tsx
# exit 0.

npm.cmd exec -w @crypto-strategy-lab/frontend -- tsc --noEmit
# After T039 tests: exit 0.

npm.cmd run test -w @crypto-strategy-lab/frontend -- src/test/smoke.spec.tsx
# Test Files 1 passed (1); Tests 1 passed (1).
```

### Boundary audit and limitation

```text
PASS: T005 and T038 were checked complete before T039.
PASS: T039 adds no production implementation and leaves T040 unchecked.
PASS: no Market Data socket, hook, service, chart, room, or subscription file was modified.
PASS: test source is lint-clean and TypeScript-clean while reaching intentional RED at runtime.
PASS: no live backend, Redis, Binance, sentiment service, or network connection is used.
LIMITATION: the repository currently has no Market Data frontend specification file; the executable
frontend regression evidence is the existing smoke test plus the unchanged Market Data source boundary,
not a nonexistent Market Data test suite.
```

### T039 checkpoint

**PASS — intentional RED contract gate**. T039 is complete: 16 executable expectations across four collected files fail only on the production API/socket/hooks owned by T040, while the pre-existing frontend smoke baseline, test lint, and full frontend TypeScript remain green.

## Phase 6 — T040 Frontend Service/Hook GREEN Gate

**Working directory**: `C:\Users\cpshc\Y3\Software Architecture\Project\Crypto-Strategy-Lab\workspace`

### Implemented boundaries

- Extended the shared frontend fetch boundary with `ApiClientError`, retaining safe public `message`, HTTP `status`, and stable application `code`; existing Market Data method signatures and paths remain unchanged.
- Added intentional wire-to-domain decoding for Dashboard, Leaderboard/detail, current/detail Loop, Strategy Version, candidate, and Trade ISO timestamps. Raw JSON strings are not typed as `Date` before decoding.
- Added typed Leaderboard list/detail and Loop start/pause/resume/stop methods using the exact active REST paths and payloads.
- Added a separate lazy `/infrastructure` Socket.IO singleton with idempotent disconnect/reset; it neither imports nor reuses the `/market-data` singleton.
- Added exact-reference Socket.IO listener setup/teardown and readable `connected`, `reconnecting`, and `disconnected` states without `removeAllListeners()`.
- Added Dashboard and Leaderboard initial fetch, last-success retention, stale/error handling, reconnect refetch, request-generation guards, and live-revision reconciliation.
- Leaderboard rejects REST snapshots below the realtime `updatedAt` watermark. Loop same-run counters and best score do not regress, and terminal state has precedence over late progress.
- `sortBy` and `selectedStrategyVersionId` remain client-owned state and are not overwritten by realtime server payloads.

### Commands and actual results

```powershell
npm.cmd run test -- --run src/services/infrastructure-socket.spec.ts src/hooks/use-infrastructure-socket.spec.tsx src/hooks/use-dashboard-summary.spec.tsx src/hooks/use-leaderboard.spec.tsx
# Test Files 4 passed (4); Tests 16 passed (16).

npm.cmd run test
# Test Files 5 passed (5); Tests 17 passed (17), including the existing frontend smoke test.

npm.cmd exec -- tsc --noEmit -p apps/frontend/tsconfig.json
# exit 0.

npm.cmd run lint -- src/services/api-client.ts src/services/infrastructure-socket.ts src/hooks/use-infrastructure-socket.ts src/hooks/use-dashboard-summary.ts src/hooks/use-leaderboard.ts src/services/infrastructure-socket.spec.ts src/hooks/use-infrastructure-socket.spec.tsx src/hooks/use-dashboard-summary.spec.tsx src/hooks/use-leaderboard.spec.tsx
# exit 0.
```

### Boundary audit

```text
PASS: T039 was checked complete before T040 and all 16 T039 expectations are GREEN.
PASS: socket-client.ts, use-websocket.ts, use-market-data.ts, and chart subscription source are unchanged.
PASS: no client-side Leaderboard ranking, Loop orchestration, or trade computation was introduced.
PASS: no real network, backend, Redis, Binance, or sentiment dependency is used by the tests.
PASS: T041 remains unchecked; no component, layout, or Next API was implemented, so no local Next 16 API documentation was required.
```

### T040 checkpoint

**PASS — frontend service/hook contract GREEN gate**. T040 is complete: the isolated infrastructure REST/socket boundary and race-safe Dashboard/Leaderboard hooks satisfy all T039 contracts while preserving the existing Market Data frontend boundary.

## Phase 6 — T041 Application Shell and Shared UI States GREEN Gate

**Working directory**: `C:\Users\cpshc\Y3\Software Architecture\Project\Crypto-Strategy-Lab\workspace\apps\frontend`

### Implemented boundaries

- Added the canonical navigation in exact order: Dashboard `/`, Strategy Builder `/strategies`, Leaderboard `/leaderboard`, and News Feed `/news`.
- Active routes use `aria-current="page"` plus a visible primary indicator; all links and the mobile menu have visible `focus-visible` styles.
- Added a usable mobile menu without changing route-owned children. App Router layout preservation is retained because the shell does not key, clone, or replace page content.
- Added a 64px dark header and centered page container capped at 1440px with responsive horizontal padding.
- Added one root `InfrastructureProvider` that lazily acquires the T040 singleton once, exposes connection state through context, lets `useInfrastructureSocket` remove its exact listener references, and disconnects only the singleton it owns during provider teardown.
- Added a dimension-preserving accessible skeleton and a sanitizing Error Boundary with one retry action and no rendered stack/provider details.
- Kept `app/layout.tsx` as a Server Component while composing the client shell/provider/boundary beneath the required root `html` and `body` tags.

### RED evidence

```powershell
npm.cmd run test -- --run src/components/common/app-shell.spec.tsx
# Expected RED after runtime loaders: Test Files 1 failed (1); Tests 6 failed (6).
# All failures were missing T041 production modules; the suite collected without syntax, jsdom, or mock errors.
```

### Commands and actual GREEN results

```powershell
npm.cmd run test -- --run src/components/common/app-shell.spec.tsx
# Test Files 1 passed (1); Tests 6 passed (6).

npm.cmd run test
# Test Files 6 passed (6); Tests 23 passed (23).

npm.cmd exec -- tsc --noEmit -p apps/frontend/tsconfig.json
# exit 0.

npm.cmd run lint -- src/components/common/app-shell.spec.tsx src/components/common/app-shell.tsx src/components/common/infrastructure-provider.tsx src/components/common/loading-state.tsx src/components/common/error-boundary.tsx src/app/layout.tsx
# exit 0 with no warnings.
```

### Boundary audit

```text
PASS: T040 was checked complete before T041.
PASS: local Next 16 App Router docs for layouts/pages, Link/navigation, Server/Client Components, layout, Link, and usePathname were read before implementation.
PASS: root layout remains a Server Component; usePathname and mobile state are isolated in client AppShell.
PASS: no React ref is read or written during render.
PASS: no route-owned page/component, Market Data socket/hook, Dashboard T042/T043 source, ranking, Loop, or trade behavior was changed.
PASS: T042 and T043 remain unchecked.
```

### T041 checkpoint

**PASS — application shell/shared-state GREEN gate**. T041 is complete with accessible canonical navigation, stable provider ownership, reusable loading/error states, preserved page-owned state, and clean frontend regression/type/lint evidence.

## Phase 6 - T042 Dashboard Component RED Gate

**Working directory**: `C:\Users\cpshc\Y3\Software Architecture\Project\Crypto-Strategy-Lab\workspace\apps\frontend`

### Contract coverage

- `DashboardGrid` owns a responsive one-column/mobile and 8/4-column/desktop DOM/class contract while composing the real `MultiTimeframeGrid`, `PairSelector`, and `StatusIndicator` public behavior.
- Loop tests cover contract fields, progress, legal state-dependent controls, exact typed start/pause/resume/stop calls, pending double-submit protection, keyboard focus styling, stale retention, and in-place realtime updates.
- Queue tests cover all six `QueueStats` fields, distinguish a healthy zero queue from disconnected Redis and provider errors, preserve stale data/timestamps, sanitize errors, and expose one retry action.
- Leaderboard tests preserve backend rank/order, cap the preview at five, cover `/leaderboard` and selected detail navigation, loading/empty/error/stale states, keyboard semantics, and in-place realtime updates.
- Dashboard rerender evidence keeps the existing Market Data grid mounted and preserves its selected timeframe while Loop/Leaderboard side-rail content changes.

### Commands and actual results

```powershell
npm.cmd run lint -- src/components/dashboard/dashboard-grid.spec.tsx src/components/dashboard/loop-status-panel.spec.tsx src/components/dashboard/queue-health-card.spec.tsx src/components/dashboard/leaderboard-preview.spec.tsx
# exit 0 with no warnings.

npm.cmd exec -- tsc --noEmit -p apps/frontend/tsconfig.json
# exit 0.

npm.cmd run test -- --run src/components/dashboard/dashboard-grid.spec.tsx src/components/dashboard/loop-status-panel.spec.tsx src/components/dashboard/queue-health-card.spec.tsx src/components/dashboard/leaderboard-preview.spec.tsx
# Expected RED: Test Files 4 failed (4); Tests 11 failed (11).
# Every failure is an unresolved T043 production module: dashboard-grid, loop-status-panel, queue-health-card, or leaderboard-preview.
# All four specs collect; there are no syntax, import-setup, jsdom, network, or mock-cleanup failures.

npm.cmd run test -- --run src/test/smoke.spec.tsx src/services/infrastructure-socket.spec.ts src/hooks/use-infrastructure-socket.spec.tsx src/hooks/use-dashboard-summary.spec.tsx src/hooks/use-leaderboard.spec.tsx src/components/common/app-shell.spec.tsx
# Test Files 6 passed (6); Tests 23 passed (23).
# Non-blocking output: Vite CJS Node API deprecation warning.
```

### Boundary audit

```text
PASS: T040 and T041 were already checked complete before T042.
PASS: only the four T042 dashboard spec files were created; no T043 production component was implemented.
PASS: app/page.tsx, chart production source, Market Data socket/hooks, and existing Market Data public behavior were not changed.
PASS: external boundaries are mocked; the tests use no real network, backend, Redis, Binance, or sentiment dependency.
PASS: responsive behavior is asserted through semantic DOM and breakpoint class contracts, not jsdom pixel measurement.
PASS: T043 remains unchecked.
```

### T042 checkpoint

**PASS - intentional Dashboard component RED gate**. T042 is complete: four collected specs provide 11 executable contracts that fail exclusively because the T043 production components do not exist, while the T039-T041 frontend baseline, TypeScript, and targeted lint gates remain green.

## Phase 6 - T043 Dashboard Component GREEN Gate

**Working directory**: `C:\Users\cpshc\Y3\Software Architecture\Project\Crypto-Strategy-Lab\workspace\apps\frontend`

### Implemented boundaries

- Added a responsive Dashboard grid with a one-column mobile layout and `md:grid-cols-12` desktop layout; the existing Market Data region occupies eight columns and the infrastructure side rail occupies four.
- Reused the existing `PairSelector`, `StatusIndicator`, and `MultiTimeframeGrid` without modifying their source or subscription behavior. Pair selection remains page-owned, while side-rail rerenders preserve the chart grid's local timeframe state.
- Added Loop status, bounded progress, state-valid typed controls, an event-time pending lock against double submission, safe command errors, authoritative refetch after commands, and retained stale data/timestamps.
- Added all six authoritative queue-health fields with explicit Redis connection text, stable loading dimensions, sanitized errors, retry, and stale snapshot retention.
- Added an order-preserving Top-5 Leaderboard preview using `slice(0, 5)` only, selected/detail navigation, `/leaderboard` navigation, safe loading/error/empty states, and direction-only return colors.
- Composed one `useDashboardSummary()` owner in `app/page.tsx`; the three cards receive the same authoritative snapshot and do not create their own REST request or Socket.IO subscription.

### Commands and actual results

```powershell
npm.cmd run test -- --run src/components/dashboard/dashboard-grid.spec.tsx src/components/dashboard/loop-status-panel.spec.tsx src/components/dashboard/queue-health-card.spec.tsx src/components/dashboard/leaderboard-preview.spec.tsx
# Test Files 4 passed (4); Tests 11 passed (11).

npm.cmd run test
# Test Files 10 passed (10); Tests 34 passed (34).

npm.cmd exec -- tsc --noEmit -p apps/frontend/tsconfig.json
# exit 0.

npm.cmd run lint -- src/components/dashboard/dashboard-grid.tsx src/components/dashboard/loop-status-panel.tsx src/components/dashboard/queue-health-card.tsx src/components/dashboard/leaderboard-preview.tsx src/app/page.tsx
# exit 0 with no warnings.

npm.cmd run build
# First sandboxed attempt: failed only because next/font could not reach fonts.googleapis.com.
# Approved network retry: Next.js 16.3.0 compiled successfully, TypeScript completed, and 8/8 static pages were generated.
```

### Regression and boundary audit

```text
PASS: the full frontend suite includes smoke, infrastructure socket/hooks, Dashboard/Leaderboard hooks, application shell, and all T042 component contracts.
PASS: no dedicated use-market-data, CandlestickChart, or MultiTimeframeGrid spec exists in the current frontend tree; the smoke suite and DashboardGrid contract render the preserved Market Data composition.
PASS: PairSelector, StatusIndicator, MultiTimeframeGrid, CandlestickChart, TradeMarkers, socket-client, use-websocket, use-market-data, and chart subscription source are unchanged.
PASS: cards consume props only; one page-level Dashboard hook owns snapshot fetch/realtime listeners, preventing per-card duplicate fetch/socket ownership.
PASS: Top-5 order comes directly from the backend snapshot; no ranking, Loop orchestration, trade calculation, or invented server field was added.
PASS: T044 and T045 remain unchecked; the TradeMarkers stub is unchanged for T045.
NOTE: Vitest remains green while reporting the existing Vite CJS deprecation plus jsdom navigation/async PairSelector harness stderr from T042; neither is a production failure.
```

### T043 checkpoint

**PASS - Dashboard component GREEN gate**. T043 is complete: all 11 T042 contracts, the 34-test frontend suite, TypeScript, targeted lint, and an online production build pass while completed Market Data and future Leaderboard-detail/TradeMarker scope remain untouched.

## Phase 6 - T044 Leaderboard and Trade Marker RED Gate

**Working directory**: `C:\Users\cpshc\Y3\Software Architecture\Project\Crypto-Strategy-Lab\workspace\apps\frontend`

### Contract coverage

- `LeaderboardTable` tests all five exact API criteria (`score`, `totalReturn`, `winRate`, `maxDrawdown`, `sharpeRatio`), visible sort arrows, `aria-sort`, focus-visible controls, selection, and in-place Top-K rerenders that preserve client-owned sort/selection.
- Table formatting covers rank, four-decimal score, signed two-decimal return, normalized `[0,1]` win rate converted to a percentage, signed Max Drawdown, Sharpe Ratio, and trade count.
- Responsive coverage requires a horizontally scrollable wrapper and retains Rank, Strategy, Score, Return, Win Rate, Max Drawdown, Sharpe, and Trades columns in the DOM.
- `LeaderboardDetail` locks the exact `/api/leaderboard/:strategyVersionId` HTTP boundary, intentional ISO decoding through the typed client, immutable Strategy Version metadata/parameters, metrics, published trades, dimension-preserving loading, sanitized 404, and one safe retry for 503.
- `TradeMarkers` mocks the installed lightweight-charts v5 boundary: `createSeriesMarkers(series, markers)`, `setMarkers(markers)`, and `detach()`. It covers entry/exit date-to-UTCTimestamp mapping, labeled Entry/Exit semantics, empty trades, replacement, series change, and unmount cleanup.
- The Trade fixture deliberately publishes a negative P&L despite a positive raw price delta; the expected marker uses the published P&L, preventing client-side P&L or signal computation.

### Commands and actual results

```powershell
npm.cmd run lint -- src/components/leaderboard/leaderboard-table.spec.tsx src/components/leaderboard/leaderboard-detail.spec.tsx src/components/chart/trade-markers.spec.tsx
# exit 0 with no warnings.

npm.cmd exec -- tsc --noEmit -p apps/frontend/tsconfig.json
# exit 0.

npm.cmd run test -- --run src/components/leaderboard/leaderboard-table.spec.tsx src/components/leaderboard/leaderboard-detail.spec.tsx src/components/chart/trade-markers.spec.tsx
# Expected RED: Test Files 3 failed (3); Tests 11 failed (11).
# Four table and four detail cases fail only because their T045 modules do not exist.
# Three marker cases load the current TradeMarkers stub and fail only because it does not call the v5 marker API.
# All specs collect; there are no syntax, type, jsdom, network, or chart-mock API failures.

npm.cmd run test -- --run src/test/smoke.spec.tsx src/services/infrastructure-socket.spec.ts src/hooks/use-infrastructure-socket.spec.tsx src/hooks/use-dashboard-summary.spec.tsx src/hooks/use-leaderboard.spec.tsx src/components/common/app-shell.spec.tsx src/components/dashboard/dashboard-grid.spec.tsx src/components/dashboard/loop-status-panel.spec.tsx src/components/dashboard/queue-health-card.spec.tsx src/components/dashboard/leaderboard-preview.spec.tsx
# Test Files 10 passed (10); Tests 34 passed (34).
# Non-blocking output: existing Vite CJS deprecation and T042 jsdom navigation/PairSelector act warnings.
```

### Boundary audit

```text
PASS: T040-T043 were checked complete before T044.
PASS: only the three T044 spec files were created; no T045 table/detail/page production was implemented.
PASS: TradeMarkers remains the pre-existing stub; CandlestickChart, use-market-data, use-websocket, socket-client, and candle subscriptions are unchanged.
PASS: the chart mock follows installed lightweight-charts v5 typings and lifecycle rather than the removed series.setMarkers API.
PASS: the current frontend tree has no dedicated Market Data hook/chart specs; smoke plus DashboardGrid composition/state-preservation tests are the available Market Data regression evidence and pass.
PASS: no real REST, Socket.IO, backend, Redis, chart canvas, or external network is used by T044 tests.
PASS: T045 remains unchecked.
```

### T044 checkpoint

**PASS - intentional Leaderboard/detail/marker RED gate**. T044 is complete: three collected specs provide 11 executable contracts that fail exclusively at the T045 production boundary while the 34-test T039-T043 baseline, TypeScript, and targeted lint gates remain green.

## Phase 6 - T045 Leaderboard and Trade Marker GREEN Implementation

**Working directory**: `C:\Users\cpshc\Y3\Software Architecture\Project\Crypto-Strategy-Lab\workspace\apps\frontend`

### Implemented boundaries

- Added a prop-driven `LeaderboardTable` that preserves backend rank/order, exposes the five exact `RankingCriterion` values, retains parent-owned sort/selection across realtime rerenders, formats all required financial values, and keeps every required column inside a mobile horizontal-scroll wrapper.
- Added `LeaderboardDetail` through the existing typed API client. It intentionally decodes contract ISO dates at the boundary, renders immutable Strategy Version parameters plus published metrics/trades, ignores superseded requests, and sanitizes 404/503 states with at most one retry action.
- Replaced the old TradeMarkers stub with the installed lightweight-charts v5 primitive lifecycle: `createSeriesMarkers`, `setMarkers`, and `detach`. Marker time and displayed P&L come from published `Trade[]`; the frontend does not calculate signals, trades, ranking, or P&L.
- Added an optional `trades` chart extension point and React-19-safe series state to `CandlestickChart`. Existing `useMarketData`, candle callbacks, socket ownership, and candle subscription/data flow are unchanged.
- Composed the full Leaderboard route with the T040 hook/provider, a Suspense boundary required by local Next 16 `useSearchParams` guidance, stale connection text, REST retry/empty states, and a one-column-mobile/two-column-desktop table/detail layout.

### Commands and actual results

```powershell
npm.cmd run test -- --run src/components/leaderboard/leaderboard-table.spec.tsx src/components/leaderboard/leaderboard-detail.spec.tsx src/components/chart/trade-markers.spec.tsx
# PASS: Test Files 3 passed (3); Tests 11 passed (11).

npm.cmd exec -- tsc --noEmit
# PASS: exit 0.

npm.cmd exec -- eslint src/components/leaderboard/leaderboard-table.tsx src/components/leaderboard/leaderboard-detail.tsx src/components/chart/trade-markers.tsx src/components/chart/candlestick-chart.tsx src/app/leaderboard/page.tsx
# PASS: exit 0 with no warnings.

npm.cmd run test
# PASS: Test Files 13 passed (13); Tests 45 passed (45).
# Non-blocking stderr: the existing Vite CJS deprecation plus T043 jsdom-navigation and PairSelector act warnings.

npm.cmd run test -- --run src/test/smoke.spec.tsx src/components/dashboard/dashboard-grid.spec.tsx
# PASS: Test Files 2 passed (2); Tests 3 passed (3).
# This is the available Market Data composition regression; no dedicated use-market-data/CandlestickChart spec exists in the current tree.

npm.cmd run build
# PASS: Next.js 16.3.0 compiled, TypeScript finished, 8/8 static pages generated, and /leaderboard was statically prerendered.

npm.cmd run lint
# FAIL: 13 pre-existing/out-of-scope findings (7 errors, 6 warnings) in app/strategy/page.tsx, components/news/NewsFeed.tsx, and components/strategy/ParameterEditor.tsx.
# None of the five T045 production files appears in the full-lint findings; targeted lint above passes.
```

### Manual and boundary audit

```text
PASS (automated DOM contract): keyboard-reachable sort/selection controls, focus-visible classes, aria-sort, aria-selected, safe status/alert text, responsive breakpoint classes, horizontal-scroll retention, realtime rerender identity, and stable sort/selection are covered by T044/T040 tests.
NOT EXECUTED (manual browser): desktop, sub-768px viewport, keyboard-only traversal, live backend disconnect/reconnect, and live detail/trade inspection. The workspace has no Playwright binary/config and this execution environment exposes no localhost browser automation; no manual PASS is claimed.
PASS: no real network is used by component tests; fetch and lightweight-charts are mocked only at their public boundaries.
PASS: use-market-data, use-websocket, socket-client, candle callbacks, candle history updates, and Socket.IO Market Data ownership were not changed.
PASS: T046 and T047 remain unchecked.
```

### T045 checkpoint

**NOT MARKED COMPLETE**. The T045 production implementation, T044 contracts, TypeScript, targeted lint, full Vitest, Market Data composition regression, production build, lesson, and index are complete. The user-required checkpoint is not fully green because full frontend lint still fails in out-of-scope Strategy/News files and browser-manual scenarios could not be executed. T045 remains `[ ]`; no false green evidence was recorded.

## Phase 6 - T045 Playwright Browser Follow-up (2026-08-17)

The earlier browser limitation is superseded by this follow-up. The user installed `@playwright/test` 1.62.1 and its matching Chromium 1234 binary. A repeatable Windows runner now builds the production frontend, starts a dedicated Next server on port 3100 and a real Socket.IO `/infrastructure` fixture on port 3201, runs Chromium, and terminates only those two owned processes in `finally`.

### Added browser coverage

- Desktop production route: exact metric formatting, active `aria-sort`, exact `sortBy=sharpeRatio` request, keyboard focus/Enter selection, stable selected row, Strategy Version detail, and published trades.
- Mobile 390x844 viewport: usable open/close navigation, a genuinely overflowing horizontal table wrapper, all eight required columns retained in the accessibility tree, and detail rendered below the table.
- Safe provider boundary: a raw 503 provider error is hidden, exactly one Retry action is exposed, and retry requests the same detail successfully.
- Real Socket.IO lifecycle: the browser starts Connected, switches to Disconnected/Reconnecting when Chromium goes offline, retains table/detail/sort/selection, and returns to Connected after network restoration and reconnect refetch.
- REST responses remain deterministic through Playwright route mocks; websocket state uses the real Socket.IO client/server protocol rather than a DOM-only mock.

### Commands and actual results

```powershell
npm.cmd run test:e2e
# PASS: Next.js 16.3.0 production build completed and 8/8 static pages generated.
# PASS: Chromium Test Files 1 passed; Tests 3 passed (3), duration 5.6s.
# PASS: owned Next/Socket.IO fixture processes were removed; no listener remained on ports 3100 or 3201.

npm.cmd run test
# PASS after excluding e2e/** from Vitest ownership: Test Files 13 passed (13); Tests 45 passed (45).

npm.cmd exec -- tsc --noEmit
# PASS: exit 0.

npm.cmd exec -- eslint playwright.config.ts vitest.config.ts e2e/leaderboard.spec.ts e2e/infrastructure-fixture.mjs src/components/leaderboard/leaderboard-table.tsx src/components/leaderboard/leaderboard-detail.tsx src/components/chart/trade-markers.tsx src/components/chart/candlestick-chart.tsx src/app/leaderboard/page.tsx
# PASS: exit 0 with no warnings.

npm.cmd run lint
# FAIL unchanged: 13 out-of-scope findings (7 errors, 6 warnings) only in app/strategy/page.tsx, components/news/NewsFeed.tsx, and components/strategy/ParameterEditor.tsx.
```

### Updated checkpoint

```text
PASS: T044, full Vitest, TypeScript, T045+E2E targeted lint, production build, desktop/mobile Chromium, keyboard interaction, safe detail retry, and real disconnect/reconnect retention.
PASS: Playwright and Vitest have non-overlapping test ownership; E2E files are excluded from Vitest collection.
PASS: no T046/T047 task was marked or implemented.
BLOCKED: full frontend lint remains red only in three pre-existing feature areas outside T045 authorization.
```

**T045 remains `[ ]` under the user's all-green checkpoint rule.** Browser/manual-equivalent validation is now complete; only authorization to repair or explicitly baseline the unrelated full-lint findings is still required.
