# ADR-0012: In-Memory Queue with BullMQ Migration Path

## Status
Superseded by ADR-0013

> **Deprecated**: BullMQ/Redis is now the accepted backtest queue backend. This ADR is retained as
> decision history; see ADR-0013 for the target architecture and operational semantics.

## Context
ADR-0006 established an in-memory job queue for backtest execution, which is sufficient for the
course project's demo scale (tens to low thousands of backtests during a search loop run) but does
not survive a process restart and cannot run workers as separate horizontally-scaled processes.
Spec Section 32.2 and Section 43 explicitly require the team to explain how the architecture would
change if backtest volume grew from ~100 to ~100,000 candidates. This ADR records the intended
migration path so that the in-memory choice is understood as a deliberate, scoped MVP decision —
not an architectural dead end.

## Decision Drivers
- Must answer spec Section 40's architecture question: "If the number of backtests increases from 100 to 100,000, how does the architecture change?"
- The migration must not require changes to any consumer of `IJobQueue` (`LoopController`, REST controllers, `DashboardService`)
- Local development and grading must not require standing up Redis/BullMQ infrastructure for the MVP demo
- The team has limited time (4 weeks) and should not invest in distributed infrastructure before the core plugin/event/backtest loop is proven end-to-end

## Considered Options
1. **Stay in-memory permanently** — accept the durability/scale limitation as final
2. **Build directly on BullMQ + Redis from Week 1**
3. **Start in-memory behind `IJobQueue`, document and (time-permitting) implement a BullMQ-backed implementation as a drop-in replacement**

## Decision Outcome
Chosen option: **"Start in-memory behind `IJobQueue`, with a documented BullMQ migration path"**,
because it lets the team prove the Job Queue/Worker pattern (ADR-0006) and the full event-driven
backtest pipeline quickly, while keeping the door open to demonstrate real horizontal scalability
as a W4 extensibility scenario (spec Section 41, "verify Job Queue extensibility: swap in-memory →
BullMQ with config change only") without having made the in-memory choice a hidden dead end.

The migration path:
1. `IJobQueue` (already defined in `kb/contracts/events.yaml`) is the only interface any other
   module or component is allowed to depend on — never the concrete in-memory implementation class.
2. A `BullMqJobQueue` class implementing the same `IJobQueue` interface can be added, backed by
   Redis, with workers optionally run as separate Node processes.
3. Switching implementations is a NestJS provider binding change (dependency injection config)
   only — `LoopController`, `DashboardService`, `LeaderboardService`, and all REST controllers are
   unaffected because they only ever called `IJobQueue` methods.
4. Job payloads already serialize cleanly to JSON (`kb/contracts/events.yaml`'s `JobRequest`), so
   no payload redesign is needed to move to a Redis-backed queue.

### Consequences
- Positive: the team can demonstrate the extensibility scenario "swap queue backend without
  touching business logic" concretely, by showing the interface boundary and (if time allows in
  W4) an actual BullMQ implementation side-by-side with the in-memory one.
- Positive: no Redis dependency is required to run or grade the MVP, lowering setup friction.
- Negative: until the BullMQ implementation is actually built, the durability and multi-process
  scaling benefits remain theoretical — the ADR is explicit that this is a documented *path*, not a
  delivered feature, unless W4 time permits implementation.
- Negative: some behaviors that are trivial with BullMQ (delayed retry, dead-letter inspection UI,
  job prioritization) had to be hand-rolled in the in-memory implementation (see ADR-0006) and may
  need to be reconciled with BullMQ's native equivalents if/when the migration happens.
- Risk: if the migration is never implemented, the "extensibility scenario" claim in the final
  report must be phrased carefully as "the interface boundary supports this swap" rather than "we
  demonstrated this swap" — the report should be honest about what was actually built versus
  what the architecture merely allows.

## Links
- Relates to ADR-0005 (Event-Driven Communication)
- Relates to ADR-0006 (Job Queue + Worker for Backtesting) — the decision this ADR extends
- Superseded by: ADR-0013 (Adopt BullMQ with Redis for Backtest Jobs)
