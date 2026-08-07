# Business Flow: Leaderboard Update

> **Owner**: Member D
> **Status**: Active
> **Last Updated**: 2026-08-07

## 1. Overview
- **Description**: When a backtest completes, the leaderboard re-ranks the Top-K strategies and pushes the update to the frontend in real time
- **Primary Actor**: Event Infrastructure (triggered by `BacktestCompleted` event)
- **Business Value**: Users watch strategy rankings evolve live without polling — this is the visual payoff of the entire generate → backtest → evaluate → rank loop (spec Section 21–23)
- **Modules Involved**: Event Infrastructure (Job Queue Worker, LeaderboardService, PushGateway), Strategy Engine (source of `BacktestCompleted`), Frontend

## 2. Preconditions
- A `BacktestRequested` job has been enqueued and picked up by a worker (see `kb/flows/strategy-backtest.md`)
- The backtest completed successfully — i.e. `BacktestCompleted` was published, not `BacktestFailed`
- `LeaderboardService` is subscribed to `BacktestCompleted` on `EventBus` (subscription happens at module bootstrap)
- The frontend has an open WebSocket connection subscribed to the `leaderboard:update` channel (if disconnected, the client falls back to `GET /api/leaderboard` on reconnect — see Error Flows)
- A Top-K value (`K`) and a ranking/scoring formula are configured (see Business Rules)

## 3. Flow Steps
1. `BacktestCompleted` published with an evaluation metrics summary — Job Queue Worker → EventBus (payload per `kb/contracts/events.yaml`: `backtestResultId`, `strategyVersionId`, `strategyName`, `isComposite`, `metrics: { totalReturn, winRate, maxDrawdown, sharpeRatio, profitFactor, totalTrades }`)
2. `LeaderboardService` (Observer) consumes the event — Event Infrastructure (internal)
3. `LeaderboardService` checks idempotency — if a `LeaderboardEntry` with this `backtestResultId` already exists (duplicate event delivery), the handler exits without side effects
4. `LeaderboardService` computes `score` from the metrics using the configured scoring formula (Business Rules, BR-2)
5. Entry is inserted (or, for a re-run of an existing `strategyVersionId`, a new entry is inserted alongside the previous one — see Business Rules, BR-4) — Event Infrastructure → PostgreSQL
6. All entries are re-sorted by the active `rankingCriterion`, ranks (`1..N`) are reassigned, and the list is trimmed to Top-K — Event Infrastructure (internal)
7. `LeaderboardUpdated` published with the fresh Top-K snapshot and the triggering `backtestResultId` — Event Infrastructure → EventBus
8. `PushGateway` relays `LeaderboardUpdated` on the `leaderboard:update` WebSocket channel — Event Infrastructure → Frontend
9. Leaderboard table re-renders with the new ranking; if the new entry now appears in the visible Top-K, it is highlighted briefly — Frontend

## 4. Postconditions
- Exactly one `LeaderboardEntry` exists for the triggering `backtestResultId` (no duplicates, even under repeated event delivery)
- The Top-K set in the database matches the Top-K set most recently broadcast via `LeaderboardUpdated`
- Every connected frontend client has received the update over WebSocket, or will receive the current state via `GET /api/leaderboard` on next load/reconnect
- The leaderboard is queryable by any of the supported sort criteria without re-running any backtest

## 5. Alternative Paths

### Candidate does not qualify for Top-K
- At step 6, if the new entry's rank after re-sorting is greater than `K`, it is still persisted (all results are kept, per Business Rules BR-5) but excluded from the `topK` array in `LeaderboardUpdated`
- The full (non-Top-K) result remains reachable via `GET /api/strategies/backtest/:id` (Strategy Engine) for transparency, even though it never appears on the leaderboard

### User re-sorts by a different metric
- User selects "Sort by Sharpe Ratio" instead of the default `score` — Frontend → `GET /api/leaderboard?sortBy=sharpeRatio`
- Event Infrastructure re-sorts the *existing* Top-K (or, if the requested metric produces a different Top-K than the score-based one, re-queries the full `LeaderboardEntry` table sorted by that metric, limited to `K`) — no backtests are re-run
- This is a read-time re-rank, not a `LeaderboardUpdated` event — no WebSocket broadcast occurs for a per-user sort change

### Strategy version is re-backtested
- The same `strategyVersionId` is backtested again (e.g., a user re-runs it, or the search loop revisits it with different data range) — a new, independent `BacktestResult` and a new `LeaderboardEntry` are created (BR-4); the older entry for that strategy is not overwritten, but only the best-performing entry per strategy is surfaced in the default leaderboard view (BR-6)

### Search-loop-originated result
- Steps are identical whether `BacktestCompleted` originated from a manual user backtest or from `LoopController` (`source: "SEARCH_LOOP"` in the originating `BacktestRequested`) — the Leaderboard does not distinguish the source, per the Observer pattern's decoupling goal

## 6. Error & Exception Flows

### Duplicate event delivery
- `BacktestCompleted` is delivered twice for the same `backtestResultId` (e.g., a future durable queue redelivers on worker restart)
- Step 3's idempotency check short-circuits the handler — no duplicate entry, no duplicate `LeaderboardUpdated` broadcast

### Missing or malformed metrics in payload
- If required fields in `metrics` are missing or non-numeric, `LeaderboardService` logs an error with the `correlationId` and skips ranking for that result (the entry is not created)
- The backtest itself is not considered failed — `BacktestResult` still exists and is viewable individually; only its leaderboard placement is affected
- This is treated as a contract violation and should not occur once `kb/contracts/events.yaml` and `kb/contracts/strategy.yaml` are reconciled (see open question in `kb/modules/event-infrastructure.md`)

### Database write fails during entry upsert
- Step 5 fails (e.g., transient DB error) — the handler logs the error and does not publish `LeaderboardUpdated`
- No retry is attempted from within the event handler (Observer handlers are fire-and-forget); the leaderboard will simply reflect this result on the *next* successful `BacktestCompleted` for the same strategy, or an operator can be alerted via logs
- This is an accepted MVP limitation — a future durable-queue-backed Leaderboard could re-process from a persisted event log

### Frontend WebSocket disconnected
- `PushGateway` has no active connection for a client — the broadcast is simply not received by that client (no error, no retry queue for offline clients)
- On reconnect, the frontend's `WebSocketProvider` sets `connection:status = "reconnecting"` then `"connected"`, and re-fetches `GET /api/leaderboard` to resync full state (this is the "catch-up on reconnect" behavior — WebSocket is a live-update channel, REST is always the source of truth for full state)

### Tie in ranking
- Two entries compute an identical `score` — see Business Rules BR-3 for the deterministic tie-break rule

## 7. Business Rules
- **BR-1**: Leaderboard only reacts to events — the Strategy Engine and Job Queue worker are unaware of the leaderboard's existence (Observer pattern, ADR-0011)
- **BR-2**: Default scoring formula: `score = 0.5 × normalizedReturn + 0.2 × winRate + 0.3 × riskScore`, where `riskScore = 1 - min(abs(maxDrawdown) / 50, 1)` (a 50%+ drawdown floors the risk score at 0) and `normalizedReturn = clamp(totalReturn / 100, -1, 1)`. All inputs are normalized to a `[-1, 1]` or `[0, 1]` range before weighting so no single metric dominates purely due to scale. This formula is configurable per Constitution Principle IV (Simplicity) — start simple, revisit if evaluation shows it ranks poorly.
- **BR-3**: Ties in `score` (to 4 decimal places) are broken by: (1) higher `sharpeRatio`, then (2) lower `maxDrawdown` (less negative), then (3) earlier `executedAt` (first-in wins, rewarding earlier discovery of an equally good strategy)
- **BR-4**: Re-backtesting the same `strategyVersionId` creates a new `LeaderboardEntry` linked to the new `backtestResultId` — existing entries are never overwritten or deleted (supports reproducibility, ADR-0008 in Strategy Engine)
- **BR-5**: All backtest results are persisted as `LeaderboardEntry` rows regardless of Top-K membership; only the Top-K subset is included in `LeaderboardUpdated` broadcasts and the default `GET /api/leaderboard` response, to keep the payload small
- **BR-6**: The default leaderboard view shows at most one entry per `strategyVersionId` (its best-scoring result); a "history" view (stretch goal, not MVP) could show all attempts for a given strategy version
- **BR-7**: Default Top-K = 10, configurable via environment variable — Leaderboard always holds and broadcasts at most `K` entries in `topK`
- **BR-8**: A candidate with 0 completed trades is still ranked (Evaluator returns 0/NaN-flagged metrics per `kb/flows/strategy-backtest.md` BR-5) but its `normalizedReturn` and `winRate` are treated as 0, so it naturally sorts near the bottom rather than crashing the ranking computation

## 8. Related
- **Contracts**: `kb/contracts/events.yaml`, `kb/contracts/strategy.yaml`
- **ADRs**: ADR-0005 (Event-Driven Communication), ADR-0011 (Leaderboard as Observer)
- **Module files**: `kb/modules/event-infrastructure.md`, `kb/modules/strategy-engine.md`
- **Related flows**: `kb/flows/strategy-backtest.md` (produces the `BacktestCompleted` that triggers this flow), `kb/flows/strategy-search-loop.md` (the loop consumes the same `BacktestCompleted` events in parallel with the Leaderboard)
