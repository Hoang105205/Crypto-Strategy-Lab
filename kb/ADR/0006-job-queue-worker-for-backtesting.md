# ADR-0006: Job Queue + Worker for Backtesting

## Status
Accepted

## Context
Backtesting a strategy over historical candle data is not instantaneous — replaying candles,
running strategy analysis on each window, simulating trades, and computing evaluation metrics can
take anywhere from milliseconds to several seconds depending on the date range and timeframe. The
Strategy Engine's `POST /api/strategies/backtest` endpoint must not block the HTTP request thread
for the duration of a backtest, and the Strategy Search Loop (`kb/flows/strategy-search-loop.md`)
needs to run potentially thousands of backtests in sequence or in parallel without blocking
anything else in the system (spec Section 19, 23, 24, 43).

## Decision Drivers
- `POST /api/strategies/backtest` must return quickly so the frontend UI stays responsive
- The search loop must be able to run 100 → 100,000 candidate backtests without redesigning the pipeline (spec Section 43)
- A single failing backtest (e.g., a strategy that throws on malformed data) must not crash the server or stall other pending backtests
- The team needs to demonstrate horizontal scalability conceptually within a 4-week timeline, without necessarily standing up a distributed system

## Decision Drivers (continued)
- Must integrate with the event-driven architecture from ADR-0005 — the queue is triggered by `BacktestRequested` and reports back via `BacktestCompleted`/`BacktestFailed`, not via a return value

## Considered Options
1. **Synchronous execution** — run the backtest inline within the REST request handler
2. **In-memory job queue + worker pool** — `BacktestRequested` is enqueued; a small pool of async workers pulls jobs and executes them, publishing `BacktestCompleted`/`BacktestFailed` when done
3. **External queue from day one** (BullMQ + Redis, or RabbitMQ)

## Decision Outcome
Chosen option: **"In-memory job queue + worker pool"**, because it decouples request/response
latency from backtest execution time (satisfying the responsiveness driver) and establishes the
Job Queue/Worker pattern (enqueue → dequeue → execute → retry/dead-letter → publish result) that
generalizes cleanly to a distributed backend later (ADR-0012), without requiring Redis
infrastructure to be running for local development and grading during W1–W2.

Each `BacktestRequested` event is wrapped into a `JobRequest` (`kb/contracts/events.yaml`) and
appended to a FIFO array. A configurable pool of async worker loops (default: 3 concurrent workers)
pulls jobs, executes the standard backtest pipeline (`IMarketDataService` → `IBacktester` →
`IEvaluator`), and on success publishes `BacktestCompleted`. On an unhandled exception, the job is
retried up to `maxAttempts` (3) with exponential backoff (1s, 4s, 16s); once exhausted, it is moved
to a dead-letter queue and `BacktestFailed` + `BacktestDeadLettered` are published.

### Consequences
- Positive: REST endpoints stay fast — `POST /api/strategies/backtest` returns `202 Accepted` with
  a `jobId` immediately, regardless of how long the actual backtest takes.
- Positive: increasing throughput (spec Section 43's 10,000-candidate scenario) is a matter of
  increasing worker pool concurrency (and, per ADR-0012, eventually running workers as separate
  processes against a durable queue) — the `IJobQueue` interface and every consumer of it
  (`LoopController`, `LeaderboardService`) do not change.
- Positive: retry + dead-letter isolate one bad candidate from stalling the whole search loop.
- Negative: the in-memory queue does not survive a process restart — any job mid-flight at crash
  time is lost, and any `SearchLoopRun` in progress must be reconciled to a `FAILED` state on
  restart (see `kb/flows/strategy-search-loop.md`, "System restarts mid-loop"). This is an accepted
  MVP limitation, not a hidden defect.
- Negative: a single shared worker pool means a long-running search loop can compete with
  interactive user-submitted backtests for worker capacity. Mitigated conceptually by giving
  `source: "USER"` jobs priority in the dequeue order (tracked as an open question in
  `kb/modules/event-infrastructure.md`).
- Risk: without back-pressure, an extremely large `maxCandidates` value could grow the in-memory
  queue unbounded — acceptable for course-project data volumes, flagged for the BullMQ migration.

## Links
- Relates to ADR-0005 (Event-Driven Communication) — the queue is entered/exited entirely through events
- Relates to ADR-0011 (Leaderboard as Observer of Events) — consumes the queue's `BacktestCompleted` output
- Relates to ADR-0012 (In-Memory Queue with BullMQ Migration Path) — the scale-up path for this decision
- Superseded by: none
