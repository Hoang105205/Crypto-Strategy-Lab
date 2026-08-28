# Business Flow: Leaderboard Update

> **Owner**: Phương
> **Status**: Active
> **Last Updated**: 2026-08-28

## 1. Overview
- **Description**: When a backtest completes, the leaderboard persists the result and emits a privacy-safe `leaderboard:update` invalidation. An app-level provider owns live leaderboard state across client-side routes and refetches the caller-scoped REST snapshot when Live updates is ON.
- **Primary Actor**: Event Infrastructure (triggered by `BacktestCompleted` event)
- **Business Value**: Users watch strategy rankings evolve live without polling — this is the visual payoff of the entire generate → backtest → evaluate → rank loop (spec Section 21–23)
- **Modules Involved**: Event Infrastructure (Job Queue Worker, LeaderboardService, PushGateway), Strategy Engine (source of `BacktestCompleted`), Auth (current session/identity), Frontend (app-level live provider and route consumers)

## 2. Preconditions
- A `BacktestRequested` job has been enqueued and picked up by a worker (see `kb/flows/strategy-backtest.md`)
- The backtest completed successfully — i.e. `BacktestCompleted` was published, not `BacktestFailed`
- `LeaderboardService` is subscribed to `BacktestCompleted` on `EventBus` (subscription happens at module bootstrap)
- `LeaderboardService` also starts an application-level source reconciler at bootstrap and every five minutes; it uses `IBacktestResultPort`, not cross-module database access.
- The root frontend tree mounts one app-level leaderboard live provider below `AuthProvider` and `InfrastructureProvider`; it survives client-side route navigation and is the sole owner of this feature's `leaderboard:update` handler.
- Leaderboard REST requests use the current Supabase session. Anonymous reads contain system entries only; authenticated user A reads contain system entries plus A's entries, per `kb/contracts/auth.yaml`.
- A Top-K value (`K`) and a ranking/scoring formula are configured (see Business Rules)

## 3. Flow Steps
1. `BacktestCompleted` published with an evaluation metrics summary — Job Queue Worker → EventBus (payload per `kb/contracts/events.yaml`: `backtestResultId`, `strategyVersionId`, `strategyName`, `isComposite`, `metrics: { totalReturn, winRate, maxDrawdown, sharpeRatio, profitFactor, totalTrades }`)
2. `LeaderboardService` (Observer) consumes the event — Event Infrastructure (internal)
3. `LeaderboardService` checks idempotency — if a `LeaderboardEntry` with this `backtestResultId` already exists (duplicate event delivery), the handler exits without side effects
4. `LeaderboardService` computes `score` from the metrics using the configured scoring formula (Business Rules, BR-2)
5. Entry is inserted (or, for a re-run of an existing `strategyVersionId`, a new entry is inserted alongside the previous one — see Business Rules, BR-4) — Event Infrastructure → PostgreSQL
6. The service computes the system-only Top-K used by the safe event. For REST, visibility is applied first and each caller-visible dataset is independently sorted, ranked `1..N`, timestamped, and trimmed to Top-K.
7. `LeaderboardUpdated` is published using the existing `kb/contracts/events.yaml` wire shape. Its namespace-wide payload is privacy-safe: `topK` is system-only and a private trigger uses `triggeredByBacktestResultId: null`.
8. `PushGateway` relays the event on the existing `leaderboard:update` channel. The event is a safe invalidation signal, not an authoritative per-viewer snapshot; no room, socket-auth handshake, namespace, or client-side privacy filter is introduced.
9. If Live updates is ON, the app-level provider's one handler refetches the relevant leaderboard REST snapshot with the current session even when Dashboard is not mounted. Race/watermark protection prevents an older request from overwriting a newer snapshot.
10. Route consumers render the provider cache. For viewer A, that cache may contain only system entries plus A's private entries; anonymous cache may contain only system entries. Existing sort/selection is preserved when still visible.

## 4. Postconditions
- Exactly one `LeaderboardEntry` exists for the triggering `backtestResultId` (no duplicates, even under repeated event delivery)
- The event's `topK` matches the current system-only Top-K. Private rows remain persisted but never appear in the namespace-wide payload.
- Every client with Live updates ON either reconciles through caller-scoped REST after invalidation or does so after reconnect; a client with Live updates OFF keeps its frozen snapshot.
- Client-side navigation does not duplicate the handler, reset the Live updates preference, or couple the preference to Dashboard mount state.
- The leaderboard is queryable by any of the supported sort criteria without re-running any backtest
- Every returned entry has a currently valid source result whose `strategyVersionId` and `userId` agree with the denormalized projection.

## 5. Alternative Paths

### Candidate does not qualify for Top-K
- At step 6, the entry is still persisted (all results are kept, per BR-5). It may be absent from one viewer's caller-scoped Top-K while present in another's; a private entry is always absent from event `topK`.
- The full result remains reachable only through an ownership-scoped detail/backtest read. An out-of-scope identifier returns not found and discloses no ownership metadata.

### User re-sorts by a different metric
- User selects "Sort by Sharpe Ratio" instead of the default `score` — Frontend → `GET /api/leaderboard?sortBy=sharpeRatio`
- Event Infrastructure re-sorts the *existing* Top-K (or, if the requested metric produces a different Top-K than the score-based one, re-queries the full `LeaderboardEntry` table sorted by that metric, limited to `K`) — no backtests are re-run
- This is a read-time re-rank, not a `LeaderboardUpdated` event — no WebSocket broadcast occurs for a per-user sort change

### Strategy version is re-backtested
- The same `strategyVersionId` is backtested again (e.g., a user re-runs it, or the search loop revisits it with different data range) — a new, independent `BacktestResult` and a new `LeaderboardEntry` are created (BR-4); the older entry for that strategy is not overwritten, but only the best-performing entry per strategy is surfaced in the default leaderboard view (BR-6)

### Search-loop-originated result
- Steps are identical whether `BacktestCompleted` originated from a manual user backtest or from `LoopController` (`source: "SEARCH_LOOP"` in the originating `BacktestRequested`) — the Leaderboard does not distinguish the source, per the Observer pattern's decoupling goal
- Search-loop entries remain system-owned (`userId = null`). The loop is a global system process; route navigation and the Live updates toggle only affect the browser view and never start, pause, resume, or stop the loop (see `kb/flows/strategy-search-loop.md`).

### Live updates turned OFF or ON
- Turning OFF removes only this feature's exact `leaderboard:update` handler. It does not disconnect the shared infrastructure socket, issue a loop command, clear the cache, or alter the frozen snapshot.
- The user's explicit ON/OFF choice is persisted in browser `localStorage`. A first-time browser with no stored choice defaults to OFF; client-side navigation, full reload, browser restart, events, and reconnects never silently switch the preference to ON.
- Turning ON restores exactly one handler and performs a current-session REST catch-up. Listener-first/refetch reconciliation plus request ordering protection prevents both missed updates and rollback to an older snapshot.

### Viewer identity transition
- Before A → B or A → anonymous renders the new viewer, the app-level provider clears A's cached leaderboard data, invalidates/aborts A-scoped in-flight requests, and advances its request generation so late A responses are ignored.
- The provider then fetches with the new current session. B can cache only system + B; anonymous can cache only system. Live updates preference remains a view preference and does not control the global loop.

## 6. Error & Exception Flows

### Duplicate event delivery
- `BacktestCompleted` is delivered twice for the same `backtestResultId` (e.g., BullMQ recovers a stalled job after worker loss)
- Step 3's idempotency check short-circuits the handler — no duplicate entry, no duplicate `LeaderboardUpdated` broadcast

### Missing or malformed metrics in payload
- If required fields in `metrics` are missing or non-numeric, `LeaderboardService` logs an error with the `correlationId` and skips ranking for that result (the entry is not created)
- The backtest itself is not considered failed — `BacktestResult` still exists and is viewable individually; only its leaderboard placement is affected
- This is treated as a contract violation and should not occur once `kb/contracts/events.yaml` and `kb/contracts/strategy.yaml` are reconciled (see open question in `kb/modules/event-infrastructure.md`)

### Database write fails during entry upsert
- Step 5 fails (e.g., transient DB error) — the handler logs the error and does not publish `LeaderboardUpdated`
- No retry is attempted from within the event handler (Observer handlers are fire-and-forget); the leaderboard will simply reflect this result on the *next* successful `BacktestCompleted` for the same strategy, or an operator can be alerted via logs
- This remains a process-local Event Bus limitation. BullMQ persists jobs, not the domain event log; a future durable `IEventBus` adapter is required for event replay.

### Frontend WebSocket disconnected
- `PushGateway` has no active connection for a client — the broadcast is simply not received by that client (no error, no retry queue for offline clients)
- On reconnect while Live updates is ON, the app-level provider keeps exactly one handler and refetches the caller-scoped REST snapshot using the current session.
- On reconnect while Live updates is OFF, it does not reattach the leaderboard handler, refetch solely for live reconciliation, or mutate the frozen snapshot. The shared socket may reconnect for other infrastructure consumers without changing this preference.

### Scoped REST refetch fails or completes after identity changes
- A failed catch-up keeps the last valid snapshot for the same viewer visible and exposes a retryable stale/error state; listener ownership still matches the ON/OFF preference.
- A response created under a previous identity/request generation is discarded and cannot repopulate the cache after logout or user switch.

### Source result/version was deleted manually
- `LeaderboardEntry.strategyVersionId` and `backtestResultId` are logical ID references, not database foreign keys, so a direct Supabase deletion does not cascade immediately.
- On backend startup and every five minutes, `LeaderboardService` validates each projection through Strategy Engine's public `IBacktestResultPort`. A missing result, mismatched strategy version, or mismatched owner confirms an orphan; that entry is deleted and surviving rows are reranked.
- If the public port throws or is temporarily unavailable, the check is inconclusive and the entry is retained. REST reads independently exclude an invalid source, so stale data is not shown while cleanup is pending.

### Tie in ranking
- Two entries compute an identical `score` — see Business Rules BR-3 for the deterministic tie-break rule

## 7. Business Rules
- **BR-1**: Leaderboard only reacts to events — the Strategy Engine and Job Queue worker are unaware of the leaderboard's existence (Observer pattern, ADR-0011)
- **BR-2**: Default scoring formula: `score = 0.5 × normalizedReturn + 0.2 × winRate + 0.3 × riskScore`, where `riskScore = 1 - min(abs(maxDrawdown) / 50, 1)` (a 50%+ drawdown floors the risk score at 0) and `normalizedReturn = clamp(totalReturn / 100, -1, 1)`. All inputs are normalized to a `[-1, 1]` or `[0, 1]` range before weighting so no single metric dominates purely due to scale. This formula is configurable per Constitution Principle IV (Simplicity) — start simple, revisit if evaluation shows it ranks poorly.
- **BR-3**: Ties in `score` (to 4 decimal places) are broken by: (1) higher `sharpeRatio`, then (2) lower `maxDrawdown` (less negative), then (3) earlier `executedAt` (first-in wins, rewarding earlier discovery of an equally good strategy)
- **BR-4**: Re-backtesting the same `strategyVersionId` creates a new `LeaderboardEntry` linked to the new `backtestResultId` — existing entries are never overwritten or deleted (supports reproducibility, ADR-0008 in Strategy Engine)
- **BR-5**: All qualifying backtest results are persisted as `LeaderboardEntry` rows regardless of Top-K membership. `LeaderboardUpdated.topK` is the system-only Top-K; REST returns the independently computed caller-visible Top-K.
- **BR-6**: The default leaderboard view shows at most one entry per `strategyVersionId` (its best-scoring result); a "history" view (stretch goal, not MVP) could show all attempts for a given strategy version
- **BR-7**: Default Top-K = 10, configurable via environment variable. Each REST viewer receives at most K entries after visibility filtering/ranking, and the event broadcasts at most K system-owned entries.
- **BR-8**: A candidate with 0 completed trades is still ranked (Evaluator returns 0/NaN-flagged metrics per `kb/flows/strategy-backtest.md` BR-5) but its `normalizedReturn` and `winRate` are treated as 0, so it naturally sorts near the bottom rather than crashing the ranking computation
- **BR-9**: REST is the authoritative full-state source. `leaderboard:update` is a namespace-wide, system-safe invalidation only; the client never merges or filters private rows from the event payload.
- **BR-10**: Caller visibility is applied before Top-K selection, rank assignment, detail lookup, and `updatedAt` calculation: anonymous = system only; A = system + A. A cache/request created for one identity is never reusable by another identity.
- **BR-11**: The app-level provider below Auth/Infrastructure owns the Live updates preference, leaderboard cache, request generation, and exactly one event handler across client-side navigation. Page-level hooks/components consume that state and do not register competing handlers.
- **BR-12**: The browser-persisted user choice is authoritative. No stored choice defaults to OFF. OFF freezes the last valid snapshot across navigation, reload, browser restart, and reconnect; ON invalidation, reload, re-enable, and reconnect reconcile through REST with the current session. Neither state controls the global search loop.
- **BR-13**: `LeaderboardEntry.strategyVersionId` and `backtestResultId` are cross-module logical references with no Prisma relation or database FK. Lifecycle consistency is enforced by public-port validation plus startup/five-minute cleanup; only confirmed orphans are deleted.

## 8. Related
- **Contracts**: `kb/contracts/events.yaml`, `kb/contracts/strategy.yaml`, `kb/contracts/auth.yaml`
- **ADRs**: ADR-0005 (Event-Driven Communication), ADR-0011 (Leaderboard as Observer), ADR-0013 (BullMQ/Redis)
- **Module files**: `kb/modules/event-infrastructure.md`, `kb/modules/strategy-engine.md`
- **Related flows**: `kb/flows/strategy-backtest.md` (produces the `BacktestCompleted` that triggers this flow), `kb/flows/strategy-search-loop.md` (global system loop consumes the same completion events independently)
- **Frontend design**: `kb/DESIGN.md` (root provider placement, cross-route Live updates behavior, identity-transition clearing)
