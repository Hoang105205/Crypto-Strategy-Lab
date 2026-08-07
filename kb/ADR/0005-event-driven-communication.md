# ADR-0005: Event-Driven Communication Between Modules

## Status
Accepted

## Context
Crypto Strategy Lab is built as a modular monolith (ADR-0002) with four independently-owned
modules: Market Data, Strategy Engine, News & Sentiment, and Event Infrastructure. These modules
must cooperate on cross-cutting flows (a backtest completing must update the Leaderboard; a new
candle must reach the frontend) without becoming coupled to each other's internals.

If modules called each other's services directly (e.g., the Job Queue worker calling
`LeaderboardService.update()` after a backtest), every module would need to import and depend on
the concrete implementation of every module it triggers a side effect in. This directly violates
`kb/MODULES.md`'s module boundary rules ("Modules communicate through defined contracts and events
only — never direct imports") and would make it impossible to satisfy the architecture questions
in spec Section 40 (e.g., "if the number of backtests grows from 100 to 100,000, how does the
architecture change?" — a direct-call chain does not scale independently per module).

## Decision Drivers
- Modules must be extensible and replaceable independently (spec Section 32.1, Modifiability)
- The system must scale backtesting from ~10 to ~100,000 candidates without a full rewrite (spec Section 32.2/43)
- A module failure (e.g., News & Sentiment's Python service going down) must not cascade into unrelated modules (spec Section 32.4/40.5)
- The team needs to work in parallel with minimal integration friction — each member owns a module and should not need to import another member's in-progress code
- Observability: the team needs to trace a request across module boundaries (e.g., "why hasn't the leaderboard updated for job X?")

## Considered Options
1. **Direct method calls between module services** — e.g., `BacktestWorker` calls `LeaderboardService.update(result)` directly
2. **In-process typed event bus** (NestJS `EventEmitter2` wrapped by a project-owned `IEventBus` interface)
3. **External message broker from day one** (Redis Pub/Sub, RabbitMQ, or Kafka)

## Decision Outcome
Chosen option: **"In-process typed event bus (EventEmitter2 behind `IEventBus`)"**, because it
removes direct module-to-module coupling — the primary architectural goal — without the
operational cost of standing up and operating an external broker for a 4-week, single-process
course project. Modules publish typed events (`BacktestRequested`, `BacktestCompleted`,
`LeaderboardUpdated`, etc. — see `kb/contracts/events.yaml`) and subscribe to the events they care
about; no module imports another module's service classes for the purpose of triggering a side
effect.

Because the bus is accessed exclusively through the `IEventBus` interface (never `EventEmitter2`
directly, and never imported by consumer modules), the underlying transport can be swapped for
Redis Pub/Sub or a message broker later without any consumer code change — this satisfies the
"what changes if scale grows" architecture question without paying the operational cost upfront
(YAGNI, Constitution Principle IV).

### Consequences
- Positive: Strategy Engine, Market Data, News & Sentiment, and Event Infrastructure have zero
  compile-time or runtime dependency on each other's internal classes — only on `kb/contracts/`
  and the events/interfaces documented there.
- Positive: adding a new subscriber to an existing event (e.g., a future analytics module
  listening to `BacktestCompleted`) requires no change to the publisher.
- Positive: `correlationId` on every event enables tracing a request across the full chain
  (`BacktestRequested → BacktestCompleted → LeaderboardUpdated`) in logs.
- Negative: eventual consistency — there is a small delay between an event being published and all
  subscribers finishing their reaction (acceptable; the frontend already treats WebSocket pushes as
  the live-update mechanism, not a synchronous confirmation).
- Negative: in-process `EventEmitter2` does not persist events — if the process crashes between
  `publish()` and a subscriber's handler completing, that delivery is lost. Acceptable for course
  project scope; explicitly tracked as a durability gap addressed by ADR-0012's migration path.
- Risk: without discipline, a developer could still be tempted to import a sibling module's service
  directly "just this once" — mitigated by the module boundary rule in `kb/MODULES.md` and code
  review checklist item in `kb/CONTRIBUTING.md`.

## Links
- Relates to ADR-0002 (Modular Monolith over Microservices)
- Relates to ADR-0006 (Job Queue + Worker for Backtesting) — the queue is itself triggered by an event
- Relates to ADR-0011 (Leaderboard as Observer of Events) — a direct application of this decision
- Relates to ADR-0012 (In-Memory Queue with BullMQ Migration Path) — the migration path this decision keeps open
- Superseded by: none
