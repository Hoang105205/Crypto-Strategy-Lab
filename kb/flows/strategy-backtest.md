# Business Flow: Strategy Backtest

> **Owner**: Huy
> **Status**: Active
> **Last Updated**: 2026-08-06

## 1. Overview
- **Description**: A user requests a backtest of a strategy (single or composite); the job is enqueued, executed by a worker, evaluated for metrics, and the result is stored and pushed to the frontend
- **Primary Actor**: User (via Frontend Strategy Builder page)
- **Business Value**: Users evaluate strategy quality on historical data before ranking or composing. This is the core feedback loop for strategy development.
- **Modules Involved**: Strategy Engine (Huy), Event Infrastructure — Job Queue + Event Bus (Phương), Market Data (Hoàng)

## 2. Preconditions
- Strategy must be registered in `StrategyRegistry` (via `register()`)
- Strategy version must exist in the database (created by `StrategyVersionService`)
- Historical candle data must be available for the requested pair + timeframe + date range (Market Data module)
- Job Queue workers must be running (Event Infrastructure module)

## 3. Flow Steps

1. **User configures backtest** — Frontend Strategy Builder → user selects strategy, pair (e.g. BTCUSDT), timeframe (e.g. 1h), date range
2. **Frontend submits backtest request** — Frontend → `POST /api/strategies/backtest` → Strategy Engine (StrategyController)
3. **Strategy Engine validates request** — StrategyController verifies `strategyVersionId` exists, pair is valid, date range is reasonable
4. **Strategy Engine publishes event** — StrategyController → `IEventBus.publish('BacktestRequested', { strategyVersionId, pair, timeframe, startDate, endDate, jobId })` → Event Bus (Phương)
5. **Strategy Engine returns queued status** — StrategyController → Frontend: `202 Accepted { jobId, status: 'queued' }`
6. **Job Queue worker picks up job** — Event Infrastructure (Phương) → worker receives `BacktestRequested` event
7. **Worker fetches historical candles** — Worker → `IMarketDataService.getHistorical(pair, timeframe, startDate, endDate)` → Market Data (Hoàng)
8. **Worker reconstructs strategy** — Worker → `StrategyRegistry.get(strategyVersionId)` → the `IStrategy` instance
9. **Worker runs backtest** — Worker → `Backtester.run(strategy, candles, config)` → replays candles chronologically, calls `strategy.analyze()` on each window, simulates trades based on signals
10. **Worker evaluates results** — Worker → `Evaluator.evaluate(trades, initialCapital)` → computes Return, WinRate, MaxDrawdown, SharpeRatio, ProfitFactor
11. **Worker saves result** — Worker → `BacktestResult` saved to PostgreSQL via Prisma (linked to `strategyVersionId`)
12. **Worker publishes completion** — Worker → `IEventBus.publish('BacktestCompleted', { jobId, backtestResultId, strategyVersionId })` → Event Bus
13. **Leaderboard reacts** — Leaderboard (Phương, Observer) → receives `BacktestCompleted` → updates Top-K ranking
14. **Frontend receives result** — Via WebSocket push (`LeaderboardUpdated` event) or REST polling (`GET /api/strategies/backtest/:id`)

## 4. Postconditions
- `BacktestResult` record exists in database, linked to the `StrategyVersion` used
- Leaderboard is updated if the result qualifies for Top-K
- Frontend displays the backtest metrics (Return, WinRate, MDD, Sharpe, ProfitFactor)
- Trade list is available for drill-down (entry/exit prices, P&L per trade)

## 5. Alternative Paths

### Backtest with Composite Strategy
- Steps 1–5 are identical
- At step 8, the composite strategy is reconstructed with its child strategies and combiner
- At step 9, the Backtester calls `compositeStrategy.analyze(candles)` which internally runs each child + combiner
- All other steps are identical — the Backtester treats composites and singles uniformly (Composite Pattern)

### Search Loop Automated Backtest
- Steps 1–5 are replaced by the Loop Controller (Phương) programmatically generating candidates and publishing `BacktestRequested` events
- Steps 6–14 are identical — the queue and worker don't know if the request came from a user or the loop

## 6. Error & Exception Flows

### Strategy version not found
- Step 3: StrategyController returns `404 Not Found { error: 'Strategy version not found' }`
- Flow terminates

### Invalid date range
- Step 3: StrategyController returns `400 Bad Request { error: 'End date must be after start date' }`
- Flow terminates

### Insufficient historical data
- Step 7: `IMarketDataService` returns fewer candles than required
- Worker logs warning, runs backtest with available data
- If zero candles → worker publishes `BacktestFailed` event, job enters dead-letter queue

### Backtest job fails (worker error)
- Step 9 or 10: Unhandled exception in Backtester or Evaluator
- Job Queue retry logic (Phương): 3 attempts with exponential backoff (1s, 4s, 16s)
- After max retries → job moves to dead-letter queue
- `BacktestFailed` event published with error details

### Strategy analysis timeout
- Step 9: If `strategy.analyze()` takes longer than configured timeout (e.g., 30s per backtest)
- Worker kills the job, moves to dead-letter queue

## 7. Business Rules
- **BR-1**: A backtest request must reference an existing, immutable `StrategyVersion` — never a mutable strategy definition
- **BR-2**: BacktestResult is immutable once created — re-running produces a new result record, not an update
- **BR-3**: The same `(strategyVersionId, pair, timeframe, startDate, endDate)` tuple can be backtested multiple times (idempotent in result, not in execution)
- **BR-4**: Backtester processes candles chronologically — no look-ahead bias allowed
- **BR-5**: Evaluator requires at least 1 completed trade to compute meaningful metrics; 0 trades → all metrics are 0/NaN with a flag

## 8. Related
- **Contracts**: `kb/contracts/strategy.yaml`, `kb/contracts/events.yaml`
- **ADRs**: ADR-0003 (Plugin Architecture), ADR-0006 (Job Queue for Backtesting), ADR-0008 (Strategy Versioning)
- **Module files**: `kb/modules/strategy-engine.md`, `kb/modules/event-infrastructure.md`, `kb/modules/market-data.md`
- **Related flows**: `kb/flows/strategy-search-loop.md` (automated backtest via loop), `kb/flows/leaderboard-update.md` (reaction to BacktestCompleted)
