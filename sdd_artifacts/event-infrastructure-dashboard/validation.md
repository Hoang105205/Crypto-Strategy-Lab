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
