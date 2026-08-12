# ADR-0002: Modular Monolith over Microservices

## Status
Accepted

## Context
Crypto Strategy Lab has 4 team members and 4 weeks to build a system with at least
4 independently-developed modules: Market Data, Strategy Engine, News & Sentiment,
and Event Infrastructure. The spec (Section 31) suggests a reference architecture with
separate services, and Section 32.2 explicitly asks how the system scales from 10 to
100,000 backtest candidates.

The key tension: we need clean module boundaries (for the interview — each member must
explain their architectural patterns) AND we need to ship a working system in 4 weeks.
Standing up separate services means Docker networking, inter-service auth, distributed
tracing, and deployment complexity that would consume 1–2 weeks of infra work before
any feature code is written.

## Decision Drivers
- 4 members, 4 weeks — every week of infrastructure setup is 25% of the timeline
- The grading target is architectural quality (modifiability, extensibility, scalability),
  not production deployment — spec Section 2 states "the focus is software architecture,
  not finding the best investment strategy"
- Each member must own a module with clear boundaries for the interview (spec Section 41–43
  extensibility scenarios must be demonstrable)
- The system must scale backtesting from ~10 to ~100,000 candidates without a full rewrite
  (spec Section 32.2/43)
- Module failures must not cascade (spec Section 32.4/40.5)

## Considered Options
1. **Microservices from day one** — each module as a separate service (Docker containers,
   gRPC/REST between services, separate databases)
2. **Modular monolith** — single NestJS process with strict module boundaries, shared
   database, in-process event bus. Modules are structurally isolated (no cross-imports)
   but deployed together.
3. **Serverless functions** — each API endpoint as a function, managed by a cloud provider

## Decision Outcome
Chosen option: **"Modular monolith"**, because it delivers the architectural boundaries
the spec demands (each NestJS module is independently owned, communicates through events
and interfaces only — see `kb/MODULES.md` boundary rules) without the operational overhead
that would consume a quarter of the project timeline.

NestJS is specifically designed for modular monoliths: each `@Module()` has its own
providers, controllers, and exports. Dependency injection is scoped per module. The
`EventEmitter2` integration provides in-process typed events (ADR-0005) that decouple
modules at runtime. Acknowledged operations use shared interfaces: Strategy Engine awaits
`IJobQueue.enqueue`, then publishes observational `BacktestRequested`; neither module imports the
other's implementation classes.

The monolith keeps optionality open: because modules communicate exclusively through
`IEventBus` (ADR-0005) and `IJobQueue` (ADR-0006) interfaces — never direct method calls —
the backtest queue is now externalized to BullMQ/Redis (ADR-0013) without changing business
consumers. Extracting workers into separate processes still requires replacing the process-local
Event Bus. This directly answers
spec Section 40.4 ("if backtests grow from 100 to 100,000, how does the architecture
change?") without paying the cost upfront (YAGNI, Constitution Principle IV).

### Consequences
- Positive: One process, one database, one deployment — zero inter-service networking
  or auth complexity. Team focuses on architecture, not DevOps.
- Positive: Each NestJS module has compile-time boundary enforcement — a module that
  imports another module's internal service will fail review and is easy to grep for.
- Positive: Shared Prisma schema gives type-safe database access with clear table
  ownership per module.
- Positive: In-process event bus means zero message-serialization overhead — events
  carry full typed payloads, not JSON strings.
- Positive: The queue-backend extension point is demonstrated by ADR-0013: BullMQ/Redis replaces
  process memory without changing Strategy Engine, Loop, Leaderboard, or Dashboard consumers.
- Positive: The remaining extraction path is preserved — swapping EventEmitter2 for a
  cross-process adapter requires changing only the `IEventBus` implementation.
- Negative: A crash in one module's unhandled exception can bring down the entire process.
  Mitigated by: `IEventBus` subscriber isolation (a throwing handler is caught and logged,
  never crashes the publisher), and the Python sentiment service is genuinely isolated
  as a separate process (ADR-0009).
- Negative: Cannot yet scale backtest workers across processes because EventEmitter2 remains
  process-local. BullMQ/Redis supplies durable queue state and in-process concurrency now;
  horizontal workers require the Event Bus transport upgrade first.
- Risk: Without discipline, a developer could import a sibling module's provider directly.
  Mitigated by: `kb/MODULES.md` boundary rules, `kb/CONTRIBUTING.md` review checklist,
  and the fact that NestJS module imports are visible in `*.module.ts` files.

## Links
- Relates to ADR-0001 (Record Architecture Decisions) — this is the first architectural choice
- Relates to ADR-0005 (Event-Driven Communication) — the event bus is what keeps modules decoupled inside the monolith
- Relates to ADR-0006 (Job Queue + Worker for Backtesting) — the queue provides async scaling within the monolith
- Relates to ADR-0013 (BullMQ/Redis Backtest Jobs) — accepted externalized queue state
- Relates to ADR-0009 (Sentiment Service as Separate Process) — the one case where process isolation is justified
- Superseded by: none
