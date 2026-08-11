# Implementation Plan: Event Infrastructure Dashboard

**Feature**: `event-infrastructure-dashboard` | **Date**: 2026-08-11 | **Spec**: [spec.md](spec.md)

## Summary

Complete Member D's brownfield Event Infrastructure and realtime Dashboard in the existing modular monolith. Delivery follows five dependency-ordered slices: typed Event Bus, asynchronous backtest queue/worker, realtime Leaderboard, bounded Strategy Search Loop, and Dashboard/realtime UI. A contract-reconciliation gate precedes all source changes so the active KB and shared TypeScript contracts agree on producer-owned `jobId`, terminal-only `BacktestFailed`, retry delays, metric units, and canonical names.

The backend extends the existing `events`, `queue`, `leaderboard`, `loop`, and `dashboard` modules and adds the documented infrastructure WebSocket gateway. Event Infrastructure persists only its own Leaderboard, Loop, and Dead-letter data. Strategy Version resolution and Backtest Result persistence/detail remain behind Strategy Engine-owned public ports. Frontend work composes the completed Market Data dashboard rather than replacing it.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js runtime; React 19.2 for client components  
**Primary Dependencies**: NestJS 11, `@nestjs/event-emitter` 3, Socket.IO 4.8, Next.js 16.3, Tailwind CSS 4, shared workspace package  
**Storage**: PostgreSQL 16 through Prisma 6; in-memory queue state for MVP; persistent Dead-letter, Leaderboard, and Search Loop records  
**Testing**: Jest 30 and Nest testing utilities for backend; Vitest 2 + React Testing Library/jsdom added for frontend per KB architecture  
**Target Platform**: Local four-process course-project environment; browser frontend at port 3000 and backend at port 3001  
**Project Type**: Monorepo web application with REST snapshot APIs and Socket.IO realtime updates  
**Performance Goals**: Backtest submission returns before execution begins; worker concurrency defaults to 3 and is bounded; Leaderboard reads use persisted projections; no frontend polling for live progress  
**Constraints**: Contract-first; no direct cross-module implementation imports or database access; no circular dependencies; preserve completed Market Data and News work; in-memory queue only for MVP; one active Search Loop; no auth or real funds

## Constitution Check

*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Architecture Quality Over Trading Profitability | ✅ PASS | The plan strengthens replaceable Event, queue, generator, scoring, and UI boundaries; it adds no trading logic. |
| II. Contract-Driven | ✅ PASS | Phase 0 reconciles active KB/shared contracts before dependent code. Feature-local contracts map every public operation and Event. |
| III. Extension Points Must Be Demonstrable | ✅ PASS | Tests prove queue backend, generator, scoring policy, subscriber, and worker-concurrency replaceability. |
| IV. Simplicity Over Cleverness | ✅ PASS | MVP remains in-process and in-memory; no Redis, broker, microservice, CQRS, or event store is introduced. |
| V. Knowledge Base as Truth | ✅ PASS | Active KB wins over stale plan/study-guide names; required KB changes are explicit gates. |
| VI. Explicit Over Implicit | ✅ PASS | Explicit tokens, DTOs, state transitions, configuration, error codes, and contracts replace hidden coupling. |
| Security constraints | ✅ PASS | No accounts or funds; no new secrets; errors remain user-safe. |

## Architecture Decision

**Approach**: Extend the existing modular monolith with application services and adapters inside the already-declared Event Infrastructure modules. Use an in-process typed Event Bus for notification, public ports for operations requiring immediate results, an in-memory priority queue behind `IJobQueue`, persistent projections for Leaderboard/Loop/DLQ, REST for snapshots/commands, and a dedicated infrastructure Socket.IO namespace for realtime push.

**Rationale**: This directly applies ADR-0005, ADR-0006, ADR-0011, and ADR-0012. It preserves the project deployment topology while making the scale-up seams demonstrable. A dedicated `/infrastructure` realtime namespace avoids modifying the completed `/market-data` gateway and keeps reconnect/resync behavior explicit.

**Modules affected**:

- Event Infrastructure: primary owner of Event Bus, queue, Leaderboard, Search Loop, BFF, and infrastructure realtime gateway.
- Frontend: shared shell, Dashboard side rail, Loop controls, Leaderboard, snapshot/realtime state.
- Strategy Engine: supplies public ports for Strategy Version resolution, backtest execution collaborators, Backtest Result persistence, and detail reads; domain algorithms remain out of scope.
- Market Data: existing `IMarketDataService.getCandlesRange()` is consumed; existing gateway/components are preserved.
- Shared library: authoritative event/queue types, integration ports, DTOs, and enums are reconciled.
- Database: existing Event Infrastructure models receive the minimum fields required for idempotency and deterministic ranking.

**E2E flows affected**: Strategy Backtest, Strategy Search Loop, and Leaderboard Update.

**New modules needed**: None at the domain-module level. Add an infrastructure WebSocket gateway inside the existing Dashboard/Event Infrastructure boundary and add public Strategy integration ports to the shared contract surface.

## Dependency and Delivery Order

```text
P0 Contract reconciliation + shared ports + schema migration
  └─ P1 typed-event-bus
       └─ P2 backtest-job-queue
            ├─ P3 realtime-leaderboard
            └─ P4 strategy-search-loop
                 └─ P5 dashboard REST + infrastructure WebSocket
                      └─ P6 dashboard-realtime-ui
                           └─ P7 integration, extensibility proof, documentation
```

Leaderboard and Search Loop may proceed in parallel after the Event Bus and their persistence contracts are stable. Dashboard UI starts only after snapshot DTOs and realtime payloads are fixed.

## Implementation Phases

### Phase P0 — Contract and Schema Gate

1. Update `kb/contracts/events.yaml` retry delays to `[1000, 4000]`, document three total attempts, document `USER` priority with FIFO inside each group, and retain terminal-only `BacktestFailed`.
2. Reconcile shared contracts: require `{ jobId }` in `IJobQueue.enqueue`, remove `willRetry`, use enum-backed statuses/criteria, and export all infrastructure DTOs once.
3. Add Strategy Engine-owned public ports for Strategy Version resolution, executable Strategy resolution, Backtest Result persistence, and Backtest Result detail reads. Event Infrastructure depends on tokens/interfaces only; tests use fakes until Huy supplies production providers.
4. Add canonical DI tokens for queue and Strategy ports. Use type-only imports in decorated constructor signatures per agent learning.
5. Add `executedAt` to `LeaderboardEntry`; add unique `jobId` and `updatedAt` to `SearchLoopCandidate`; make the no-improvement bound non-null with default 50. Hoàng reviews the Prisma migration.
6. Update KB open questions for priority, score/Top-K, retry delays, and canonical `getCandlesRange()` naming before P1/P2 code consumes them.

### Phase P1 — Typed Event Bus

1. Implement the `IEventBus` adapter and export it under the canonical token from `EventsModule`.
2. Wrap every publication in an Event Envelope with UUID identity, version 1, UTC time, and generated/preserved correlation identity.
3. Register subscriber wrappers that isolate synchronous throws and asynchronous rejections; log type, event ID, and correlation ID.
4. Return cleanup subscriptions and make unsubscribe idempotent.
5. Add unit tests for envelope shape, correlation propagation, multiple handlers, isolation, unsubscribe, and reserved Event pass-through.
6. Replace Market Data's optional missing-bus path with the real exported provider without modifying its behavior.

### Phase P2 — Backtest Queue, Worker, and Dead Letter

1. Implement an in-memory `IJobQueue` with separate FIFO lists for `USER` and `SEARCH_LOOP`, one job registry, status registry, completion timestamps, and terminal-publication guards.
2. Add explicit queue configuration (`WORKER_CONCURRENCY`, default 3; attempts 3; delays 1s/4s) and an injectable clock/scheduler seam for deterministic tests without primitive constructor injection.
3. Subscribe an enqueue handler to `BacktestRequested`; validate source/`loopRunId`, preserve `jobId`, reject duplicates, and schedule work without blocking the publisher.
4. Implement bounded worker dispatch. Workers call Market Data and Strategy public ports, persist one immutable result, then publish `BacktestCompleted` using the originating correlation ID.
5. Classify zero candles and missing Strategy Version as non-retryable. Retry other eligible failures twice; intermediate failures update status/logs only.
6. Make terminal transition atomic/idempotent, persist `DeadLetterJob`, and publish one `BacktestFailed` and one `BacktestDeadLettered` per terminal transition.
7. Implement status/stats/dead-letter list/manual retry operations and controllers. Manual retry marks the DLQ record resolved and requeues the same job at attempt 1.
8. Test priority, FIFO, delayed availability, concurrency, duplicate IDs, exact event counts, stats, and recovery with fake timers/ports.

### Phase P3 — Realtime Leaderboard

1. Implement an Event Infrastructure-owned repository over `LeaderboardEntry` only.
2. Subscribe `LeaderboardService` to `BacktestCompleted`; validate finite metrics and `winRate` in `[0,1]`.
3. Compute the KB score, normalize zero-trade results to zero return/win rate, and enforce database plus application idempotency by `backtestResultId`.
4. Persist every valid entry, rank deterministically using score/Sharpe/Max Drawdown/`executedAt`, and produce best-per-Strategy-Version Top-K (default 10).
5. Publish `LeaderboardUpdated` only after persistence/ranking succeeds. A duplicate Event produces neither a write nor a broadcast.
6. Implement list/sort/detail endpoints. Detail combines the Leaderboard projection with Strategy Engine's public Backtest Result reader; it never queries Strategy-owned tables directly.
7. Test formula boundaries, malformed values, duplicate delivery, non-Top-K persistence, repeat versions, tie-breaks, supported sorts, and failed persistence.

### Phase P4 — Bounded Strategy Search Loop

1. Implement repositories for `SearchLoopRun` and `SearchLoopCandidate` using only Event Infrastructure tables.
2. Implement a single-active-run application guard and state transitions for start, pause, resume, stop, completion, and failure.
3. Resolve a generated candidate to an immutable Strategy Version through the Strategy public port, create a candidate row with unique job ID, and publish a complete search-originated request.
4. Subscribe idempotently to terminal completion/failure. Match by `loopRunId` and `jobId`, record late/in-flight outcomes, and never generate a successor after pause or terminal stop.
5. Evaluate stop conditions in specified order and use epsilon 0.01. Default no-improvement limit is 50 and cannot be disabled without another bound.
6. Retry generation at most three times, fail with `generator_error`, and reconcile orphan active runs to `process_restarted` at startup.
7. Publish started/progress/stopped Events only on valid transitions. Results arriving after a terminal stop are persisted silently and do not emit a post-stop progress Event.
8. Implement Loop command/query controllers and unit/integration tests for all state and race paths.

### Phase P5 — Dashboard BFF and Realtime Gateway

1. Implement Dashboard summary composition from Leaderboard, Loop status, and queue stats with no business recomputation.
2. Add stable error mapping for validation, conflict, missing resource, unavailable Strategy integration, and internal failure.
3. Add `PushGateway` on `/infrastructure`, subscribe to Leaderboard and Search Loop Events, and relay the four active server channels.
4. Do not subscribe to reserved `MarketDataUpdated` or `NewsCollected` Events.
5. Keep REST snapshots authoritative. WebSocket carries changes only; connection status is client lifecycle state.
6. Test REST controllers, 409 single-run conflict, payload passthrough, handler teardown, and absence of ranking/Loop logic in the gateway.

### Phase P6 — Dashboard and Realtime Frontend

1. Add the 64px shared application shell and canonical navigation without changing route-owned page behavior.
2. Add typed infrastructure API methods and a separate `/infrastructure` socket singleton/provider; preserve the existing `/market-data` client and room model.
3. Extend the Dashboard from the current full-width Market Data grid to the DESIGN.md 8/4 layout, reusing existing Pair Selector, Status Indicator, and chart grid.
4. Add Loop Status Panel, queue health card, and compact Leaderboard preview with command disabling and explicit loading/empty/error/stale states.
5. Implement Leaderboard table, sort criteria, timestamp, selected Strategy detail, trades, and in-place realtime merge that preserves sort/selection.
6. On reconnect, mark data stale, fetch Dashboard/Leaderboard snapshots, ignore snapshot responses older than the latest applied realtime revision/timestamp, then resume live updates.
7. Integrate trade markers only through published trade data and the existing chart extension point; do not calculate signals or modify Market Data subscription logic.
8. Add keyboard, `aria-sort`, focus, semantic color, desktop/mobile layout, and frontend component/hook tests.

### Phase P7 — Integration and Extensibility Verification

1. Run backend unit, integration, module-boot, build, and lint checks; run frontend unit, build, and lint checks.
2. Execute the five independent subfeature acceptance suites with test doubles, then the complete Event-to-UI flow where production Strategy providers are available.
3. Prove queue implementation swap with a fake alternative binding, generator replacement with a fake implementation, scoring replacement, additional subscriber, and worker concurrency change.
4. Run `/hoang-sdd-analyze`, resolve contract/KB drift, then `/hoang-sdd-converge` for remaining code/spec gaps.
5. Update README demo steps and only then mark implementation complete.

## Source Code Structure

```text
workspace/
├── libs/shared/src/
│   ├── events/index.ts                         # reconciled Event payload SSoT mirror
│   ├── interfaces/infrastructure.ts            # IEventBus, IJobQueue
│   ├── interfaces/strategy.ts                  # Strategy-owned integration ports
│   ├── types/infrastructure.ts                 # Job, queue, ranking, Loop, API DTOs
│   └── types/enums.ts                          # statuses and ranking criteria
├── apps/backend/
│   ├── prisma/schema.prisma                    # reviewed minimal field additions
│   └── src/
│       ├── shared/tokens.ts                    # canonical interface tokens
│       ├── events/
│       │   ├── event-bus.ts
│       │   ├── event-bus.spec.ts
│       │   └── events.module.ts
│       ├── queue/
│       │   ├── backtest.queue.ts
│       │   ├── backtest.worker.ts
│       │   ├── dead-letter.repository.ts
│       │   ├── queue.controller.ts
│       │   ├── queue.errors.ts
│       │   ├── *.spec.ts
│       │   └── queue.module.ts
│       ├── leaderboard/
│       │   ├── leaderboard.service.ts
│       │   ├── leaderboard.repository.ts
│       │   ├── leaderboard.controller.ts
│       │   ├── scoring-policy.ts
│       │   ├── *.spec.ts
│       │   └── leaderboard.module.ts
│       ├── loop/
│       │   ├── strategy-loop.service.ts
│       │   ├── loop-status.service.ts
│       │   ├── loop.repository.ts
│       │   ├── loop.controller.ts
│       │   ├── *.spec.ts
│       │   └── loop.module.ts
│       └── dashboard/
│           ├── dashboard.service.ts
│           ├── dashboard.controller.ts
│           ├── push.gateway.ts
│           ├── *.spec.ts
│           └── dashboard.module.ts
└── apps/frontend/src/
    ├── app/layout.tsx
    ├── app/page.tsx                             # compose; preserve Market Data behavior
    ├── app/leaderboard/page.tsx
    ├── components/common/
    │   ├── app-shell.tsx
    │   ├── infrastructure-provider.tsx
    │   ├── loading-state.tsx
    │   └── error-boundary.tsx
    ├── components/dashboard/
    │   ├── dashboard-grid.tsx
    │   ├── loop-status-panel.tsx
    │   ├── queue-health-card.tsx
    │   └── leaderboard-preview.tsx
    ├── components/leaderboard/
    │   ├── leaderboard-table.tsx
    │   └── strategy-detail.tsx
    ├── hooks/
    │   ├── use-infrastructure-socket.ts
    │   ├── use-dashboard-summary.ts
    │   └── use-leaderboard.ts
    └── services/
        ├── api-client.ts                       # extend existing client
        └── infrastructure-socket.ts            # preserve market-data socket client
```

## Testing Strategy

- Use fake clocks/schedulers for retry timing; never use long sleeps.
- Use test doubles for `IMarketDataService` and Strategy Engine ports so queue/Loop tests do not wait for other members.
- Use repository interfaces/fakes for most service tests and Nest testing modules with a mocked `PrismaService` for DI/controller integration.
- Add module-boot tests for Events, Queue, Leaderboard, Loop, and Dashboard to catch token/export cycles.
- Add frontend hook/component tests for reconnect ordering, state preservation, accessibility, and responsive class behavior.
- Preserve current Market Data tests and run the whole workspace suite after integration.

## Configuration

| Variable | Default | Validation |
|----------|---------|------------|
| `BACKTEST_WORKER_CONCURRENCY` | `3` | integer 1–32 |
| `BACKTEST_MAX_ATTEMPTS` | `3` | fixed to 3 for MVP contract |
| `LEADERBOARD_TOP_K` | `10` | integer 1–100 |
| `INFRASTRUCTURE_WS_NAMESPACE` | `/infrastructure` | non-empty namespace beginning `/` |

Retry delays (1s/4s), epsilon (0.01), and no-improvement default (50) are named shared constants governed by active contracts rather than free-form environment overrides in MVP.

## Constitution Re-check After Design

All gates remain **PASS**. The two new Strategy integration ports and two minimal schema fields are boundary repairs required by the spec; they do not introduce a module, technology, or cross-module database dependency. The separate infrastructure WebSocket namespace preserves completed Market Data behavior and uses an already-installed transport.

## Complexity Tracking

No Constitution violation requires justification.

