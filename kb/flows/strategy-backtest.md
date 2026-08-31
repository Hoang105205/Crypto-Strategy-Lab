# Business Flow: Strategy Backtest

> **Owner**: Huy
> **Status**: Active
> **Last Updated**: 2026-08-31

## 1. Overview
- **Description**: A user requests a backtest of a strategy (single or composite); the job is enqueued, executed by a worker, evaluated for metrics, and the result is stored and pushed to the frontend
- **Primary Actor**: User (via Frontend Strategy Builder page)
- **Business Value**: Users evaluate strategy quality on historical data before ranking or composing. This is the core feedback loop for strategy development.
- **Modules Involved**: Strategy Engine (Huy), Event Infrastructure — Job Queue + Event Bus (Phương), Market Data (Hoàng)

## 2. Preconditions
- For the manual user path, the frontend must provide a valid Supabase session; `SupabaseJwtGuard` + `RequireAuth` reject anonymous backtest submission.
- Strategy must be registered in `StrategyRegistry` (via `register()`)
- Strategy version must exist in the database (created by `StrategyVersionService`)
- Historical candle data must be available for the requested pair + timeframe + date range (Market Data module)
- Redis and the BullMQ Backtest Worker must be available (Event Infrastructure module)

## 3. Flow Steps

1. **User configures backtest** — Frontend Strategy Builder → user selects strategy, pair (e.g. BTCUSDT), timeframe (e.g. 1h), date range, and `backtestConfig` (`initialCapital`, `positionSizePercent`, optional `commission` and `slippage`)
2. **Frontend submits authenticated backtest request** — Frontend sends the current Supabase access token → `POST /api/strategies/backtest` → `SupabaseJwtGuard` + `RequireAuth` → Strategy Engine (StrategyController)
3. **Strategy Engine validates and identifies request** — StrategyController validates inputs, captures the verified `userId`, then generates UUIDs for `jobId` and `correlationId`
4. **Strategy Engine durably submits the job** — StrategyController awaits `IJobQueue.enqueue('BACKTEST', payload, correlationId)`. `BullMqJobQueue` preserves the UUID as BullMQ `jobId`, rejects duplicates, assigns USER priority `1`, and persists the job in Redis.
5. **Strategy Engine acknowledges and notifies** — only after enqueue succeeds, StrategyController publishes observational `BacktestRequested` with the same identities and returns `202 Accepted { jobId, status: 'queued' }`. If Redis is unavailable, it returns stable `503 QUEUE_UNAVAILABLE` and does not publish/acknowledge.
6. **BullMQ worker picks up job** — Worker claims the Redis job; the queue does not depend on consuming `BacktestRequested`
7. **Worker fetches historical candles** — Worker → `IMarketDataService.getCandlesRange(pair, timeframe, startDate, endDate)` → Market Data (Hoàng)
8. **Worker resolves strategy** — Worker → `IStrategyExecutionPort.resolveVersion(strategyVersionId)` → immutable version + executable `IStrategy`, without importing Strategy Engine internals
9. **Worker runs backtest** — Worker → `Backtester.run(strategy, candles, config)` → creates one isolated `createAnalysisSession()` when the strategy provides it, replays candles chronologically through `next(candle)`, and simulates trades based on signals. A plugin without an incremental session receives the same accumulated prefix array through `analyzeAsync()`/`analyze()` as a compatibility fallback; the Backtester no longer creates `candles.slice(0, i + 1)` at every step.
10. **Worker evaluates results** — Worker → `Evaluator.evaluate(trades, initialCapital)` → computes Return, WinRate, MaxDrawdown, SharpeRatio, ProfitFactor
11. **Worker saves result** — Worker → `BacktestResult` saved to PostgreSQL via Prisma (linked to `strategyVersionId`)
12. **Worker publishes completion** — Worker → `IEventBus.publish('BacktestCompleted', { jobId, correlationId, userId, loopRunId: null, backtestResultId, strategyVersionId, strategyName, strategyType, isComposite, pair, timeframe, status: "SUCCESS", metrics: { totalReturn, winRate, maxDrawdown, sharpeRatio, profitFactor, totalTrades }, executedAt, executionTimeMs })` → Event Bus. This is the complete payload from `kb/contracts/events.yaml`.
13. **Leaderboard reacts** — Leaderboard (Phương, Observer) → receives `BacktestCompleted`, inserts one projection, and computes caller-visible Top-K/rank when read.
14. **Frontend receives result** — Via privacy-safe `LeaderboardUpdated` invalidation followed by caller-scoped REST, or by authenticated job-result polling (`GET /api/strategies/backtest/:id`).

## 4. Postconditions
- `BacktestResult` record exists in database, linked to the `StrategyVersion` used
- A valid leaderboard projection is persisted regardless of current Top-K membership; it appears only if it qualifies in a later caller-scoped read.
- Frontend displays the backtest metrics (Return, WinRate, MDD, Sharpe, ProfitFactor)
- Trade list is available for drill-down (entry/exit prices, P&L per trade)

## 5. Alternative Paths

### Backtest with Composite Strategy
- Steps 1–5 are identical
- At step 8, the composite strategy is reconstructed with its child strategies and combiner
- At step 9, the Backtester creates `compositeStrategy.createAnalysisSession()`. The composite creates isolated child sessions, advances them for the same candle, and combines their signals; a child without an incremental session uses the accumulated-prefix compatibility path.
- All other steps are identical — the Backtester treats composites and singles uniformly (Composite Pattern)

### Search Loop Automated Backtest
- Steps 1–5 are replaced by Loop Controller generating a candidate, `jobId`, and `correlationId`, awaiting `IJobQueue.enqueue` with SEARCH_LOOP priority `10`, then publishing the observational `BacktestRequested` notification
- Steps 6–14 are identical — the queue and worker don't know if the request came from a user or the loop

## 6. Error & Exception Flows

### Strategy version not found
- Step 3: StrategyController returns `404 Not Found { error: 'Strategy version not found' }`
- Flow terminates

### Missing or invalid authentication
- Before step 3, `SupabaseJwtGuard` rejects an invalid/expired token and `RequireAuth` rejects an absent identity with `401 Unauthorized`.
- No job ID is generated, no queue write occurs, and no event is published.

### Invalid date range
- Step 3: StrategyController returns `400 Bad Request { error: 'End date must be after start date' }`
- Flow terminates

### Insufficient historical data
- Step 7: `IMarketDataService` returns fewer candles than required
- Worker logs warning, runs backtest with available data
- If zero candles → this is non-retriable; the Job Queue Worker publishes terminal `BacktestFailed` exactly once and moves the job to the dead-letter queue, which additionally publishes `BacktestDeadLettered`

### Backtest job fails (worker error)
- Step 9 or 10: Unhandled exception in Backtester or Evaluator
- BullMQ retry logic (Phương): three total attempts with deterministic delays of 1s then 4s
- Intermediate retryable failures update queue state/logs only; they do not publish `BacktestFailed`
- After max retries → job moves to the dead-letter queue; the Job Queue Worker publishes terminal `BacktestFailed` exactly once and the queue publishes `BacktestDeadLettered` exactly once

### Strategy analysis timeout (not currently implemented)
- The current worker does not enforce a per-backtest hard timeout or kill an executing analysis attempt. Ordinary thrown/rejected strategy errors follow the retry/dead-letter flow above.
- Adding a killable timeout requires a separate worker-process/thread boundary and cancellation contract; configuration must not claim this capability until that boundary exists.

## 7. Business Rules
- **BR-1**: A backtest request must reference an existing, immutable `StrategyVersion` — never a mutable strategy definition
- **BR-2**: BacktestResult is immutable once created — re-running produces a new result record, not an update
- **BR-3**: The same `(strategyVersionId, pair, timeframe, startDate, endDate)` tuple can be backtested multiple times (idempotent in result, not in execution)
- **BR-4**: Backtester processes candles chronologically — no look-ahead bias allowed
- **BR-5**: Evaluator requires at least 1 completed trade to compute meaningful metrics; 0 trades → all metrics are 0/NaN with a flag
- **BR-6**: The request producer creates `jobId` before publishing; the Job Queue preserves it unchanged across enqueue, retries, completion, failure, and dead-letter handling
- **BR-7**: `BacktestFailed` is terminal-only and is published exactly once per failed `jobId`; retryable attempt failures never emit it
- **BR-8**: BullMQ may recover stalled work with at-least-once execution, so result persistence and terminal side effects MUST be idempotent on `jobId`/`backtestResultId`
- **BR-9**: `202 queued` means Redis has accepted the BullMQ job. Publishing `BacktestRequested` alone MUST NOT enqueue work.
- **BR-10**: Manual user backtests require verified authentication, propagate the caller's `userId` through the queue/result/event, and expose the stored result only to that owner. Search Loop backtests are system-owned with `userId = null`.
- **BR-11**: Each backtest creates fresh incremental analysis state. Built-in sessions process each candle once and must match prefix-based `analyze()` signals without look-ahead; compatible plugins may omit the session but must receive only candles observed so far.

## 8. Related
- **Contracts**: `kb/contracts/strategy.yaml`, `kb/contracts/events.yaml`
- **ADRs**: ADR-0003 (Plugin Architecture), ADR-0006 (Job Queue for Backtesting), ADR-0008 (Strategy Versioning), ADR-0013 (BullMQ/Redis)
- **Module files**: `kb/modules/strategy-engine.md`, `kb/modules/event-infrastructure.md`, `kb/modules/market-data.md`
- **Related flows**: `kb/flows/strategy-search-loop.md` (automated backtest via loop), `kb/flows/leaderboard-update.md` (reaction to BacktestCompleted)
