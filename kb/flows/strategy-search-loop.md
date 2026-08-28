# Business Flow: Strategy Search Loop

> **Owner**: Phương
> **Status**: Active
> **Last Updated**: 2026-08-24

## 1. Overview
- **Description**: Continuous global system search — generate candidate strategies, backtest them via the queue, evaluate them, and feed the best result into the next iteration. This flow records the 2026-08-18 decision that the loop is a system process, not a route- or user-owned process.
- **Primary Actor**: System (`StrategyLoopService` / operator-configured lifecycle)
- **Business Value**: Continuously discovers high-performing strategy combinations without requiring a user to keep a page mounted or manually drive loop execution.
- **Modules Involved**: Event Infrastructure (StrategyLoopService, JobQueue, EventBus), Strategy Engine (`IStrategyGenerator`, `IBacktester`, `IEvaluator`)

## 2. Preconditions
- At least one `IStrategyGenerator` implementation is registered (`RandomGenerator` at minimum; `DomainGuidedGenerator` optional for MVP).
- `IBacktester` and `IEvaluator` are available through the Strategy Engine module.
- Redis is reachable, the BullMQ backtest worker is running, and historical market data is available for the configured pair and timeframe.
- System/operator configuration supplies bounded stop/restart conditions. The loop lifecycle is not derived from the current browser route, authenticated viewer, or leaderboard Live updates preference.
- At most one global `SearchLoopRun` is active. It has no `userId` ownership and is not partitioned per user.

## 3. Flow Steps
1. **System starts or continues the global loop** — application/operator lifecycle invokes `StrategyLoopService` using system configuration; no frontend page mount or Live updates toggle is required.
2. **The service creates or reconciles the run** — it creates one global `SearchLoopRun` or recovers the active run after restart, then publishes `SearchLoopStarted` when a new run begins.
3. **The service requests a candidate** — it calls the Strategy Engine `SearchEngine` facade and treats generator implementations as interchangeable behind `IStrategyGenerator`.
4. **Candidate is durably submitted** — the service generates `jobId` and `correlationId`, awaits `IJobQueue.enqueue` with `source: "SEARCH_LOOP"`, `userId: null`, and the global `loopRunId`, then publishes observational `BacktestRequested` after Redis acceptance.
5. **Worker executes the standard pipeline** — Job Queue Worker calls Market Data, `IBacktester`, and `IEvaluator`, then publishes `BacktestCompleted` or terminal `BacktestFailed`.
6. **The loop consumes the result** — `StrategyLoopService` matches `loopRunId`, records `SearchLoopCandidate`, and updates global progress and best-score state. In parallel, `LeaderboardService` records the result as a system-owned leaderboard entry.
7. **The service publishes progress** — `SearchLoopProgress` is relayed to all viewers as read-only global status over `loop:progress`.
8. **The service evaluates bounded continuation policy** — if the configured stop/restart condition is not met, it requests the next candidate. Otherwise it records the terminal state and publishes `SearchLoopStopped`; system/operator policy decides whether and when a later global run begins.

## 4. Postconditions
- One global `SearchLoopRun` records the system process state; no per-user `SearchLoopRun` or migration is introduced.
- Every tested candidate has a `SearchLoopCandidate`, immutable `StrategyVersion`, and, on success, a `BacktestResult` plus system-owned `LeaderboardEntry` (`userId = null`).
- All viewers observe the same loop status. Leaderboard visibility remains separately scoped through `kb/flows/leaderboard-update.md`.
- Client-side navigation, Dashboard unmount, authentication changes, and Live updates ON/OFF have no effect on loop execution.

## 5. Alternative Paths

### Browser navigates or Dashboard unmounts
- The global loop continues generating and backtesting candidates. A later Dashboard mount reads current global status; it does not create, pause, resume, restart, or stop a run.

### Leaderboard Live updates is OFF or ON
- OFF freezes only the browser's leaderboard snapshot and removes only the leaderboard listener. ON restores the listener and performs scoped REST reconciliation.
- Neither state sends `POST /api/loop/*`, changes `SearchLoopRun`, disconnects the shared socket, or changes loop event delivery used by other consumers.

### System/operator lifecycle intervention
- Deployment, recovery, or an authorized operational action may start, stop, or replace a global run according to system policy. Any retained lifecycle endpoints/status values are operational compatibility surfaces, not end-user controls and not ownership boundaries.

### Domain-Guided generation
- The service may use `DomainGuidedGenerator` instead of `RandomGenerator`; the swap is opaque behind `IStrategyGenerator` and does not change global ownership.

### Search space includes Sentiment
- When `NewsSentimentStrategy` is registered, the generator may include it like any other strategy. Loop, queue, and leaderboard processing remain unchanged.

## 6. Error & Exception Flows

### Generator fails to produce a candidate
- The service retries generation according to the bounded system policy. Exhaustion marks the global run `FAILED`, records a reason, and emits `SearchLoopStopped`; it never waits for a browser action.

### A candidate's backtest fails
- After BullMQ exhausts retries or detects a non-retriable failure, the worker emits one terminal `BacktestFailed`.
- The service records the failed global candidate, excludes it from best-score calculation, and continues or terminates according to system policy.

### BullMQ worker concurrency is saturated
- Work remains durably queued. USER priority `1` jobs run before SEARCH_LOOP priority `10`; SEARCH_LOOP jobs remain FIFO relative to each other.
- Longer time between progress events is an infrastructure condition, not a signal for a route or Live updates toggle to control the loop.

### NestJS restarts mid-loop
- Waiting/delayed jobs remain in Redis and stalled jobs recover through BullMQ.
- On startup, `StrategyLoopService` reconciles the one global run with recoverable queue state. At-least-once recovery requires idempotent result persistence and terminal-event handling.

### Frontend disconnects or changes identity
- Loop execution continues unchanged. Reconnect only restores observation of global status according to the infrastructure socket lifecycle.
- A → B or A → anonymous clears identity-scoped leaderboard cache as described in `kb/flows/leaderboard-update.md`; it does not clone, repartition, or restart the loop.

## 7. Business Rules
- **BR-1**: The Strategy Search Loop is one global system process per the 2026-08-18 decision. `SearchLoopRun` and `SearchLoopCandidate` are not per-user entities.
- **BR-2**: Browser navigation, Dashboard mount/unmount, authentication transitions, and leaderboard Live updates ON/OFF never control loop lifecycle.
- **BR-3**: Frontend loop UI is read-only global status. The Live updates control governs only the app-level `leaderboard:update` listener and scoped REST catch-up; it issues no loop lifecycle command.
- **BR-4**: Loop orchestration uses public interfaces/events only — `IStrategyGenerator`, `IJobQueue.enqueue`, observational `BacktestRequested`, and terminal `BacktestCompleted`/`BacktestFailed`.
- **BR-5**: Every loop job and resulting leaderboard entry is system-owned (`userId = null`). Manual user backtests remain separately owned and do not convert the global loop into a user process.
- **BR-6**: At most one global run is active in MVP. This is a system-wide concurrency constraint, not a per-user quota.
- **BR-7**: Continuation is bounded by configured candidate, duration, no-improvement, failure, and operational policies; the service never relies on a browser session to make progress or stop safely.
- **BR-8**: A candidate counts as tested only after terminal completion/failure. Persisted immutable strategy versions preserve reproducibility across loop iterations.

## 8. Related
- **Contracts**: `kb/contracts/events.yaml`, `kb/contracts/strategy.yaml`, `kb/contracts/auth.yaml` (`SearchLoopRun` explicitly excluded from user data scoping)
- **ADRs**: ADR-0005 (Event-Driven Communication), ADR-0006 (Job Queue + Worker), ADR-0013 (BullMQ/Redis), ADR-0016 (app-level user data filtering; loop excluded)
- **Module files**: `kb/modules/event-infrastructure.md`, `kb/modules/strategy-engine.md`
- **Related flows**: `kb/flows/strategy-backtest.md` (single-backtest pipeline), `kb/flows/leaderboard-update.md` (system result ranking and cross-route client reconciliation), `kb/flows/composite-with-sentiment.md` (sentiment-based search candidates)
- **Decision source**: `plans/new-requirements-summary.md` (2026-08-18 global system-loop decision)
