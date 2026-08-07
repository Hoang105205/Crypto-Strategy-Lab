# ADR-0011: Leaderboard as Observer of Events

## Status
Accepted

## Context
After a backtest completes, its result needs to be ranked against every other known result and,
if it qualifies, surfaced on the Top-K Leaderboard in real time (spec Section 21–23). The component
that runs a backtest (the Job Queue worker) has no business logic reason to know that a leaderboard
exists — ranking is a separate concern from execution, and the Strategy Search Loop
(`kb/flows/strategy-search-loop.md`) needs the exact same "a result happened" signal to decide
whether to continue generating candidates. Coupling the worker directly to a `LeaderboardService`
call (or, worse, to both a `LeaderboardService` and a `LoopController` call) would violate
Constitution Principle I (architecture quality — modifiability) and make it impossible to add a
third reactive consumer later without touching the worker again.

## Decision Drivers
- Ranking logic must be able to change (a new scoring formula) without touching the Backtester, Evaluator, or Job Queue (spec Section 32.6, extensibility scenario)
- Multiple independent consumers need the same `BacktestCompleted` signal: the Leaderboard (ranking) and the Loop Controller (deciding whether to continue searching) — spec Section 34
- The Leaderboard must update in real time on the frontend without polling (spec Section 3, 33)
- Idempotency matters: a duplicate or redelivered event must not corrupt the ranking

## Considered Options
1. **Direct call from the worker** — `BacktestWorker` calls `leaderboardService.update(result)` and `loopController.onResult(result)` explicitly after saving a result
2. **Observer pattern via the event bus** — `LeaderboardService` and `LoopController` each independently `subscribe('BacktestCompleted', handler)`; the worker only publishes the event and knows nothing about its subscribers
3. **Polling** — Leaderboard periodically queries `BacktestResult` for new rows since its last check

## Decision Outcome
Chosen option: **"Observer pattern via the event bus"**, because it lets the Leaderboard (and the
Loop Controller) react to `BacktestCompleted` without the publisher (the worker) ever being aware
of them. This directly reuses the event-driven foundation from ADR-0005 rather than introducing a
new mechanism, keeps ranking logic isolated to `LeaderboardService`, and generalizes to any future
consumer of "a backtest just completed" (e.g., an analytics or alerting module) with zero changes
to the worker.

`LeaderboardService.onModuleInit()` subscribes to `BacktestCompleted` on `IEventBus`. On delivery,
it checks idempotency (an entry already exists for this `backtestResultId`? no-op), computes
`score`, upserts a `LeaderboardEntry`, re-sorts and trims to Top-K, and publishes
`LeaderboardUpdated` — which `PushGateway` relays to the frontend over WebSocket. `LoopController`
subscribes to the same `BacktestCompleted` event independently, for its own unrelated purpose
(deciding the next search iteration) — see `kb/flows/strategy-search-loop.md`.

### Consequences
- Positive: the Backtester, Evaluator, and Job Queue worker have zero knowledge of the Leaderboard
  or the Loop Controller — verified by the extensibility scenario "swap the scoring formula without
  touching the Backtester" (spec Section 41/42).
- Positive: adding a new observer of `BacktestCompleted` in the future is a one-line `subscribe()`
  call with no change to the publisher.
- Positive: real-time frontend updates fall out naturally — `LeaderboardUpdated` → WebSocket push,
  no polling required.
- Negative: multiple independent observers processing the same event means there is no shared
  transaction across their side effects — if `LeaderboardService`'s handler succeeds but
  `LoopController`'s throws (or vice versa), their views of the world can diverge for that one
  event. Mitigated by keeping each handler's side effects narrowly scoped and idempotent (see
  Section 8, Quality Attributes, in `kb/modules/event-infrastructure.md`).
- Negative: because handlers run independently, event delivery order between observers is not
  guaranteed to matter — the design explicitly avoids any handler depending on another handler
  having already run for the same event.
- Risk: idempotency depends on a database-level `UNIQUE` constraint on `LeaderboardEntry.backtestResultId`
  being correctly enforced — flagged for verification during Prisma schema implementation.

## Links
- Relates to ADR-0005 (Event-Driven Communication) — this decision is a direct application of it
- Relates to ADR-0006 (Job Queue + Worker for Backtesting) — the publisher whose output this ADR consumes
- Superseded by: none
