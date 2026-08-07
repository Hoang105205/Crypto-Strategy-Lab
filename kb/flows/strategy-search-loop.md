# Business Flow: Strategy Search Loop

> **Owner**: Phương
> **Status**: Active
> **Last Updated**: 2026-08-07

## 1. Overview
- **Description**: Continuous automated search — generate candidate strategies, backtest them via the queue, evaluate, and feed the best back into generation
- **Primary Actor**: User (starts/pauses/stops the loop via the Loop Status Panel)
- **Business Value**: Automatically discovers high-performing strategy combinations without manual trial and error (spec Section 15–24) — this is the "verification loop" that turns the platform from a single-backtest tool into an experiment platform
- **Modules Involved**: Event Infrastructure (LoopController, JobQueue, EventBus), Strategy Engine (`IStrategyGenerator`, `IBacktester`, `IEvaluator`)

## 2. Preconditions
- At least one `IStrategyGenerator` implementation is registered (`RandomGenerator` at minimum; `DomainGuidedGenerator` optional for MVP)
- `IBacktester` and `IEvaluator` are available via the Strategy Engine module
- Job Queue workers are running and not already saturated by an existing loop run
- Historical market data is available for the configured pair + timeframe (Market Data module)
- No other `SearchLoopRun` is currently `RUNNING` or `PAUSED` (MVP supports one active loop at a time — see Business Rules BR-6)
- The user has supplied a valid stop condition (at least one of `maxCandidates`, `maxDurationMs`, or the default `stopOnNoImprovementIterations` applies)

## 3. Flow Steps
1. **User starts the loop** — Frontend (Loop Status Panel) → `POST /api/loop/start { generatorType, maxCandidates?, maxDurationMs?, stopOnNoImprovementIterations? }` → LoopController
2. **LoopController validates and creates the run** — LoopController checks no other loop is active, creates a `SearchLoopRun` row (`status: RUNNING`, `iteration: 0`), and returns `{ loopRunId, status: "RUNNING" }` to the frontend
3. **LoopController announces start** — LoopController → `EventBus.publish('SearchLoopStarted', { loopRunId, config, startedAt })`
4. **LoopController requests a candidate** — LoopController → `IStrategyGenerator.generate(1)` → Strategy Engine (via shared interface, not a direct module import)
5. **Candidate is submitted for backtesting** — LoopController → `EventBus.publish('BacktestRequested', { ...payload, source: "SEARCH_LOOP", loopRunId })` → Job Queue enqueues it exactly like a user-submitted backtest (see `kb/flows/strategy-backtest.md`)
6. **Worker executes the backtest** — Job Queue Worker runs the standard backtest pipeline (`IMarketDataService` → `IBacktester` → `IEvaluator`) and publishes `BacktestCompleted` or `BacktestFailed`
7. **LoopController consumes the result** — LoopController (also an Observer of `BacktestCompleted`/`BacktestFailed`, alongside `LeaderboardService`) matches the event's `loopRunId` to its own active run, records a `SearchLoopCandidate` row, and updates `testedCandidates`, `bestScoreSoFar`, and `bestStrategyVersionId` if the new candidate scores higher
8. **LoopController broadcasts progress** — LoopController → `EventBus.publish('SearchLoopProgress', { loopRunId, iteration, testedCandidates, currentCandidate, bestScoreSoFar, bestStrategyVersionId })` → relayed to the frontend over WebSocket (`loop:progress`)
9. **LoopController evaluates stop conditions** — checks `maxCandidates`, `maxDurationMs`, and `stopOnNoImprovementIterations` (Business Rules BR-1); if none are met and the run is still `RUNNING`, go to step 4 for the next iteration
10. **Loop stops** — when a stop condition is met (or the user requests stop/it fails), LoopController sets the final `status` and `stopReason` on `SearchLoopRun`, then publishes `SearchLoopStopped` → relayed to the frontend (`loop:stopped`)

## 4. Postconditions
- `SearchLoopRun` has a terminal status (`COMPLETED`, `STOPPED_BY_USER`, or `FAILED`) with `stopReason` and `bestStrategyVersionId` set (if at least one candidate completed)
- Every candidate tested during the run has a corresponding `SearchLoopCandidate` row, a `StrategyVersion`, and (if it completed successfully) a `BacktestResult` and a `LeaderboardEntry`
- The Leaderboard reflects any candidates from this run that qualified for Top-K (via the independent `kb/flows/leaderboard-update.md` flow reacting to the same `BacktestCompleted` events)
- The Job Queue is free to accept new manual user backtests or a new loop run

## 5. Alternative Paths

### User pauses the loop
- User → `POST /api/loop/:loopRunId/pause` → LoopController sets `status: PAUSED`, records `pausedAt`
- LoopController stops requesting new candidates at step 4, but does **not** cancel a candidate whose backtest job is already in-flight — that job runs to completion and is still recorded (step 7) so no work is wasted
- No `SearchLoopStopped` is published on pause — the run is not terminal; `SearchLoopProgress` is not published again until resumed

### User resumes a paused loop
- User → `POST /api/loop/:loopRunId/resume` → LoopController sets `status: RUNNING`, clears `pausedAt`, and continues from the same `iteration` count (not reset to 0) — resumes at step 4
- `bestScoreSoFar` and `bestStrategyVersionId` are preserved across the pause

### User stops the loop
- User → `POST /api/loop/:loopRunId/stop` (valid from `RUNNING` or `PAUSED`) — LoopController sets `status: STOPPED_BY_USER`, `stopReason: "user_requested"`, `stoppedAt`, and proceeds to step 10
- Any backtest jobs already in-flight for this `loopRunId` are still processed by the worker and still recorded as `SearchLoopCandidate`/`LeaderboardEntry` (their results are not discarded), but no new candidates are generated

### Domain-Guided generation
- Step 4 uses `DomainGuidedGenerator` instead of `RandomGenerator` — from `LoopController`'s perspective, this is an opaque swap behind the same `IStrategyGenerator` interface (extensibility scenario #2 from the spec: swapping generators requires zero changes to `LoopController`, `JobQueue`, `Backtester`, or `Leaderboard`)
- `DomainGuidedGenerator` internally enforces diversity rules (at least one strategy from a different domain group per composite — see `kb/modules/strategy-engine.md`), which LoopController does not need to know about

### Search space includes Sentiment
- If `NewsSentimentStrategy` is registered in `StrategyRegistry` (by News & Sentiment module), the generator may include it in candidates like any other strategy — LoopController and JobQueue treat it identically to a technical strategy (see `kb/flows/composite-with-sentiment.md`)

## 6. Error & Exception Flows

### Generator fails to produce a candidate
- Step 4: `IStrategyGenerator.generate(1)` throws or returns an empty result (e.g., search space exhausted for `DomainGuidedGenerator`'s diversity constraints)
- LoopController logs the error, increments a `generationFailures` counter (not persisted as a `SearchLoopCandidate`, since no strategy was ever produced), and retries generation up to 3 times before treating it as a fatal loop error → `status: FAILED`, `stopReason: "generator_error"`

### A candidate's backtest fails
- Step 6 results in `BacktestFailed` instead of `BacktestCompleted` (after the Job Queue's own retry/dead-letter handling — see `kb/contracts/events.yaml` `retry_policy`)
- LoopController records the `SearchLoopCandidate` with `status: FAILED`, does **not** count it toward `bestScoreSoFar`, and continues to the next iteration — one bad candidate never stops the loop
- If failures exceed a threshold (e.g., 50% of the last 10 candidates fail), the loop logs a warning but continues; a future enhancement could auto-pause on a failure-rate threshold (not MVP)

### Worker pool is saturated
- Step 5/6: all workers are busy with either loop-originated or user-originated jobs
- The `BacktestRequested` job simply waits in the FIFO queue — the loop's iteration is not considered "stuck," it is `BACKTESTING` (per `SearchLoopProgress.currentCandidate.status`) until the worker picks it up
- This is visible to the user as a longer time between progress updates, not an error

### System restarts mid-loop
- Because the MVP queue and `SearchLoopRun` state are in-memory-adjacent (queue) / database-backed (loop run), a process restart loses any in-flight job in the queue but the `SearchLoopRun` row remains with its last known `status: RUNNING`
- On startup, `LoopController` reconciles: any `SearchLoopRun` left in `RUNNING` state with no active worker activity is transitioned to `FAILED` with `stopReason: "process_restarted"` — the user must start a new loop
- This is an accepted MVP limitation; ADR-0012's durable-queue migration path also addresses recovering in-flight jobs across restarts

### User starts a second loop while one is active
- Step 1: `POST /api/loop/start` while a `SearchLoopRun` is `RUNNING` or `PAUSED` → `409 Conflict { error: "A search loop is already active", loopRunId }`
- Flow terminates — user must stop the existing run first (Business Rules BR-6)

## 7. Business Rules
- **BR-1**: Loop orchestration communicates via events/interfaces only — `LoopController` never imports Strategy Engine internals, only `IStrategyGenerator`, and never imports Backtester/Evaluator directly (it goes through the same `BacktestRequested`/`BacktestCompleted` events as a manual user backtest)
- **BR-2**: Stop conditions are evaluated in this priority order after each candidate: (1) user-requested stop/pause, (2) `maxCandidates` reached, (3) `maxDurationMs` elapsed, (4) `stopOnNoImprovementIterations` consecutive iterations without a `bestScoreSoFar` improvement (default 50). At least one numeric bound (`maxCandidates` or `maxDurationMs`) SHOULD be set by the user; if neither is set, `stopOnNoImprovementIterations` is the only safety net and MUST always be active — an unbounded `while(true)` loop is never permitted (spec Section 23)
- **BR-3**: "Improvement" means the new candidate's `score` (same formula as the Leaderboard, `kb/flows/leaderboard-update.md` BR-2) exceeds `bestScoreSoFar` by more than a negligible epsilon (0.01) — this avoids resetting the no-improvement counter on floating-point noise
- **BR-4**: A candidate is only counted toward `testedCandidates` once its backtest reaches a terminal state (`BacktestCompleted` or `BacktestFailed` after retries are exhausted) — a candidate still queued or backtesting is not yet "tested"
- **BR-5**: Reproducibility applies to loop-generated candidates the same as manual ones — every `SearchLoopCandidate` links to an immutable `StrategyVersion`, so any Top-K entry's exact strategy + parameters can be traced back to the loop run and iteration that produced it (spec Section 36, extensibility scenario #8)
- **BR-6**: Only one `SearchLoopRun` may be `RUNNING` or `PAUSED` at a time in the MVP — this is a deliberate scope limitation to avoid worker pool contention between multiple simultaneous loops, not an architectural ceiling (a future version could scope loops per-user or per-pair)
- **BR-7**: Pausing a loop stops new candidate generation but never cancels in-flight backtest jobs — work already dispatched to a worker is always allowed to finish and be recorded

## 8. Related
- **Contracts**: `kb/contracts/events.yaml`, `kb/contracts/strategy.yaml`
- **ADRs**: ADR-0005 (Event-Driven Communication), ADR-0006 (Job Queue + Worker)
- **Module files**: `kb/modules/event-infrastructure.md`, `kb/modules/strategy-engine.md`
- **Related flows**: `kb/flows/strategy-backtest.md` (the single-backtest flow reused by every loop iteration), `kb/flows/leaderboard-update.md` (reacts independently to the same `BacktestCompleted` events), `kb/flows/composite-with-sentiment.md` (search space can include sentiment-based composites)
