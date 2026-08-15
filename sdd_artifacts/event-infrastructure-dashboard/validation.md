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
