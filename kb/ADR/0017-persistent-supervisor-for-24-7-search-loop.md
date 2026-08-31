# ADR-0017: Persistent Supervisor for the 24/7 Search Loop

## Status
Accepted

## Context
The business requires the global system Search Loop to remain enabled 24/7 after one operator action and to resume automatically after NestJS restart/deploy. A single `SearchLoopRun` is deliberately bounded by candidate, duration, and no-improvement policies, so calling `POST /api/loop/start` once cannot satisfy persistent desired-state semantics.

## Decision Drivers
- The ON/OFF choice must survive process restart.
- Individual runs must remain bounded, observable, and independently auditable.
- At most one backend instance may create the next run.
- Temporary queue, market-data, or generator failures must not create a tight retry loop.
- Browser navigation and leaderboard Live updates must remain unrelated to loop execution.

## Considered Options
1. Make one `SearchLoopRun` infinite.
2. Use an external cron job that repeatedly calls the existing start endpoint.
3. Persist desired state in PostgreSQL and use an in-process supervisor with a database lease to create bounded runs continuously.

## Decision Outcome
Chosen option: "Persistent desired state plus leased supervisor", because it preserves the existing bounded `StrategyLoopService` while adding restart-safe 24/7 orchestration at its boundary.

`SearchLoopControl(id="system")` stores the enabled flag, rolling-window configuration, per-run bounds, retry state, next-run time, and lease. `SearchLoopSupervisorService` checks this state every 15 seconds. The lease lasts 60 seconds and is atomically acquired/renewed in PostgreSQL, preventing two supervisors from starting a run concurrently. Completed runs are replaced after a configurable cooldown. Start failures use exponential backoff capped at 30 minutes.

ADR-0018 defines how the singleton is first materialized: the environment provides a bootstrap default only, while an existing database row always wins.

On process replacement, an active run without local runtime context is marked `FAILED` with `orphaned_after_restart`; the supervisor then starts a fresh bounded run. BullMQ may still finish an already accepted candidate idempotently, but the new run does not depend on reconstructing volatile orchestration context.

### Consequences
- Positive: one operator-authorized enable call persists across restart/deploy until an operator-authorized disable call changes desired state.
- Positive: each run retains existing limits, events, queue behavior, and system ownership (`userId = null`).
- Positive: database leasing prevents duplicate supervisors from creating concurrent global runs.
- Positive: rolling backtest dates use the latest closed timeframe boundary rather than repeating a fixed historical range forever.
- Negative: PostgreSQL is now required for supervisor coordination as well as result persistence.
- Negative: a restart can terminate the prior run record and create a replacement instead of resuming the exact in-memory iteration.
- Risk: EventEmitter2 remains process-local. The supported topology is still one NestJS application process with in-process workers; horizontally distributed workers require a cross-process event bus before end-to-end loop continuation can be claimed.
- Risk: operator membership is deployment configuration rather than application-managed RBAC; changing the allowlist requires an environment update and backend restart (ADR-0019).

## Links
- [Relates to ADR-0005](./0005-event-driven-communication.md)
- [Relates to ADR-0013](./0013-adopt-bullmq-redis-for-backtest-jobs.md)
- [Strategy Search Loop flow](../flows/strategy-search-loop.md)
- [Event Infrastructure module](../modules/event-infrastructure.md)
- [Refined by ADR-0018](./0018-database-authoritative-search-loop-bootstrap.md)
- [Secured by ADR-0019](./0019-search-loop-operator-allowlist.md)
