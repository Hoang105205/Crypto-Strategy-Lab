# Module: Event Infrastructure

> **Owner**: Phương
> **Status**: Active
> **Last Updated**: 2026-08-12

## 1. Overview
- **Responsibility**: The system's nervous system — event bus, Redis-backed BullMQ job queue, leaderboard, search loop orchestration, and dashboard BFF
- **Layer**: Backend
- **Depends on**: `IBacktester`, `IStrategyGenerator`, `IMarketDataService` (shared interfaces only — no direct imports of another module's implementation), BullMQ, Redis
- **Depended by**: All modules (publish/subscribe via `IEventBus`), Frontend (dashboard BFF, WebSocket)
- **Contracts**: `kb/contracts/events.yaml`
- **Source files**: `apps/backend/src/events/`, `queue/`, `leaderboard/`, `loop/`, `dashboard/`, `websocket/`
- **Related ADRs**: ADR-0005 (Event-Driven Communication), ADR-0006 (Job Queue + Worker), ADR-0011 (Leaderboard as Observer), ADR-0013 (BullMQ/Redis Queue; supersedes ADR-0012)

## 2. Component Architecture

### Components
| Component | Responsibility | Pattern | File(s) |
|-----------|---------------|---------|---------|
| EventBus | Typed wrapper around EventEmitter2 — `publish()` / `subscribe()`, wraps payloads in `EventEnvelope` | Event-Driven / Mediator | `apps/backend/src/events/event-bus.ts` |
| Event Types | All typed event name + payload definitions (mirrors `kb/contracts/events.yaml`) | n/a | `apps/backend/src/events/event-types.ts` |
| BullMqJobQueue | `IJobQueue` adapter over BullMQ; Redis-backed priority/FIFO state, stats, retry, retention, and recovery | Job Queue/Worker | `apps/backend/src/queue/bullmq-job.queue.ts` |
| RedisConnection | Validates and owns BullMQ producer/worker Redis connections and shutdown lifecycle | Infrastructure Adapter | `apps/backend/src/queue/redis.connection.ts` |
| BacktestWorker | Consumes BullMQ jobs from Redis, calls `IMarketDataService` + `IBacktester` + `IEvaluator`, persists result, publishes `BacktestCompleted`/`BacktestFailed` | Worker | `apps/backend/src/queue/backtest.worker.ts` |
| DeadLetterRepository | Mirrors terminal BullMQ failures to PostgreSQL for stable audit/REST inspection and recovery | Repository | `apps/backend/src/queue/dead-letter.repository.ts` |
| LeaderboardService | Subscribes to `BacktestCompleted`, computes score, maintains Top-K, publishes `LeaderboardUpdated` | Observer | `apps/backend/src/leaderboard/leaderboard.service.ts` |
| LeaderboardRepository | Persists/queries `LeaderboardEntry` rows | Repository | `apps/backend/src/leaderboard/leaderboard.repository.ts` |
| LoopController | Orchestrates the search loop: generate → enqueue → collect → decide next step, entirely through events/interfaces | Orchestrator / State Machine | `apps/backend/src/loop/strategy-loop.ts` |
| LoopStatusService | Tracks `SearchLoopRun` state, exposes progress for REST + WebSocket | State Store | `apps/backend/src/loop/loop-status.ts` |
| DashboardController / DashboardService | REST API composition for the frontend (leaderboard, loop status, queue stats) | BFF | `apps/backend/src/dashboard/controllers/dashboard.controller.ts`, `dashboard/services/dashboard.service.ts` |
| PushGateway | WebSocket gateway pushing `LeaderboardUpdated`, `SearchLoopProgress`, `SearchLoopStarted/Stopped` to the frontend | Gateway / Observer | `apps/backend/src/websocket/push.gateway.ts` |

### Component Diagram

```mermaid
flowchart TD
    subgraph StrategyEngine["Strategy Engine (Huy)"]
        SC[StrategyController]
    end

    subgraph EventInfra["Event Infrastructure (Phương)"]
        EB[EventBus]
        JQ[BullMqJobQueue]
        W[BacktestWorker]
        DLQ[DeadLetterRepository]
        LB[LeaderboardService]
        LC[LoopController]
        LS[LoopStatusService]
        DS[DashboardService]
        WS[PushGateway]
    end

    subgraph MarketData["Market Data (Hoàng)"]
        MDS[IMarketDataService]
    end

    DB[(PostgreSQL)]
    REDIS[(Redis / BullMQ)]
    FE[Frontend]

    SC -->|await enqueue USER| JQ
    LC -->|await enqueue SEARCH_LOOP| JQ
    SC -->|notify BacktestRequested| EB
    LC -->|notify BacktestRequested| EB
    JQ --> REDIS
    REDIS --> W
    JQ --> W
    W -->|IMarketDataService.getCandlesRange| MDS
    W -->|IBacktester.run + IEvaluator.evaluate| StrategyEngine
    W -->|save BacktestResult| DB
    W -->|publish BacktestCompleted / BacktestFailed| EB
    JQ -->|maxAttempts exhausted| DLQ
    DLQ -->|publish BacktestDeadLettered| EB

    EB -->|BacktestCompleted| LB
    EB -->|BacktestCompleted / BacktestFailed| LC
    LB -->|save LeaderboardEntry| DB
    LB -->|publish LeaderboardUpdated| EB
    EB --> WS
    LC -->|publish SearchLoopStarted/Progress/Stopped| EB
    LC --> LS
    WS -->|WebSocket push| FE
    DS -->|REST| FE
    DS --> LB
    DS --> LS
    DS --> JQ
```

## 3. Design Patterns

### Event-Driven Architecture — ADR-0005
- **Where**: `EventBus` — the channel for cross-module notifications and reactive side effects; acknowledged commands/queries use public interfaces such as `IJobQueue`
- **Why**: Strategy Engine, Market Data, News & Sentiment, and Event Infrastructure must evolve independently. A direct-call architecture (`LeaderboardService.update()` called from inside the Backtester) would force every module to import every other module's internals, which fails extensibility scenario #4 (100 → 100,000 backtests) and #7 (Binance disconnect must not affect the rest of the system).
- **How**: `EventBus` wraps NestJS's `EventEmitter2`. `publish(eventType, payload, correlationId?)` builds an `EventEnvelope` (adds `eventId`, `occurredAt`, generates a `correlationId` if none is passed) and emits it. `subscribe(eventType, handler)` registers a handler; the wrapper catches and logs handler exceptions so one failing subscriber can never break the publisher or a sibling subscriber. All event names and payload shapes are defined once in `kb/contracts/events.yaml` and mirrored in `event-types.ts` (compile-time typed via TypeScript discriminated unions keyed on `eventType`).
- **Trade-offs**:
  - Positive: modules are fully decoupled — Strategy Engine never imports anything from `leaderboard/` or `loop/`; a module can be deleted or replaced without touching publishers.
  - Positive: swapping `EventEmitter2` for Redis Pub/Sub later only requires re-implementing `IEventBus` — no consumer code changes (extensibility scenario for message-bus swap).
  - Negative: eventual consistency — there's a small window between `BacktestCompleted` and the Leaderboard reflecting it. Acceptable because the frontend gets `LeaderboardUpdated` over WebSocket instead of polling.
  - Negative: harder to trace than a direct call stack — mitigated by `correlationId` propagated through every event in a chain (`BacktestRequested` → `BacktestCompleted` → `LeaderboardUpdated`) and structured logging keyed on it.
  - Negative: the process-local event bus is still not durable. BullMQ makes accepted queue jobs durable, but it does not make `EventEmitter2` deliveries cross-process or replayable (see ADR-0013's topology constraint).

### Job Queue / Worker — ADR-0006 + ADR-0013
- **Where**: `BullMqJobQueue` + Redis + `BacktestWorker`, invoked through `IJobQueue.enqueue`
- **Why**: A single backtest can take seconds; the Strategy Engine's REST endpoint (`POST /api/strategies/backtest`) must return immediately (`202 Accepted`) instead of blocking the HTTP request thread. This is what lets the system scale from a handful of manual backtests to a search loop running thousands of candidates (extensibility scenario #4).
- **How**: Strategy Engine calls `IJobQueue.enqueue` for USER work; Loop Controller calls it for SEARCH_LOOP work. The producer UUID becomes BullMQ `jobId`. The call validates, rejects an existing ID, assigns priority `1` or `10`, and awaits Redis persistence before returning. The producer then publishes observational `BacktestRequested` with the same correlation identity; no queue subscriber acts on that Event. Equal-priority jobs are FIFO. A BullMQ `Worker` consumes with concurrency 3, calls `IMarketDataService.getCandlesRange()`, resolves the immutable strategy version, runs/evaluates, persists `BacktestResult`, then publishes `BacktestCompleted`. Retryable errors use three attempts with 1s/4s delays; terminal failures remain in BullMQ's failed set, mirror idempotently to `DeadLetterJob`, and publish terminal events exactly once.
- **Trade-offs**:
  - Positive: waiting and delayed jobs survive NestJS restarts while Redis remains available; BullMQ recovers stalled work.
  - Positive: retry + dead-letter queue means one bad candidate (e.g., a strategy that throws on malformed candle data) can't stall the whole search loop.
  - Positive: USER jobs have explicit higher priority than SEARCH_LOOP jobs; FIFO is preserved within a priority.
  - Negative: Redis is required for queue availability and must be monitored and persisted.
  - Constraint: workers remain in the NestJS process until `IEventBus` gains a cross-process transport; BullMQ alone does not carry domain events to process-local observers.

### Observer — ADR-0011
- **Where**: `LeaderboardService` subscribes to `BacktestCompleted`; `LoopController` also subscribes to `BacktestCompleted`/`BacktestFailed`
- **Why**: The Strategy Engine and the Job Queue worker must never know the Leaderboard or the Loop Controller exist. Ranking logic and search orchestration are reactive side effects of "a backtest finished" — not part of the backtest's own responsibility (Single Responsibility Principle applied across module boundaries).
- **How**: On startup, `LeaderboardModule` calls `eventBus.subscribe('BacktestCompleted', handler)`. The handler is idempotent on `backtestResultId` (an `UNIQUE` constraint on `LeaderboardEntry.backtestResultId` at the DB level — a duplicate delivery of the same event is a silent no-op, not an error). It computes `score` (Section on scoring in `kb/flows/leaderboard-update.md`), inserts/updates the entry, re-sorts, trims to Top-K, and publishes `LeaderboardUpdated` with the fresh Top-K snapshot.
- **Trade-offs**:
  - Positive: adding a second observer (e.g., a future "Strategy Performance Alerts" module) requires zero changes to the Job Queue or Strategy Engine — just another `subscribe('BacktestCompleted', ...)` call.
  - Positive: changing the scoring formula only touches `LeaderboardService` — Backtester and Evaluator are untouched (extensibility scenario #4/#6 from the spec).
  - Negative: multiple observers processing the same event independently means no shared transaction — if `LeaderboardService` succeeds but `LoopController`'s handler throws, the loop's view of progress can lag. Mitigated by keeping each handler idempotent and side-effect-isolated (Section 8).

### BFF (Backend-for-Frontend)
- **Where**: `DashboardService` / `DashboardController`
- **Why**: The frontend dashboard needs leaderboard + loop status + queue health in shapes convenient for rendering, without knowing that they come from three internal services owned by the same module.
- **How**: `DashboardService` composes `LeaderboardService.getTopK()`, `LoopStatusService.getCurrentRun()`, and `JobQueue.getStats()` into single REST responses (Section 7).
- **Trade-offs**: Positive — frontend makes one call instead of three; Negative — `DashboardService` has a small amount of coupling to the shape of all three sub-services, acceptable since all four live in the same module.

## 4. Internal Data Flow

```
Strategy Engine (source=USER) / Loop Controller (source=SEARCH_LOOP)
        │  generate jobId + correlationId; await IJobQueue.enqueue
        ▼
     BullMqJobQueue → Redis ────────────────────────────────┐
        │                                                     │
        ▼                                                     │
     return queued; publish notification (does not drive Worker)│
        │                                                     │
        ▼                                                     │
   BacktestWorker (pulled from pool)                          │
        │  1. IMarketDataService.getCandlesRange(pair, tf, range)
        │  2. StrategyRegistry.get(strategyVersionId)          │
        │  3. IBacktester.run(strategy, candles, config)       │
        │  4. IEvaluator.evaluate(trades, capital)             │
        │  5. save BacktestResult → PostgreSQL                 │
        ▼                                                     │
   success? ──yes──▶ publish('BacktestCompleted', {...}) ─────┘
        │
        no (exception)
        ▼
   attempt < maxAttempts? ──yes──▶ BullMQ delayed retry
        │
        no
        ▼
   terminal failure → publish('BacktestFailed') exactly once
        │
        └── if moved to DLQ → publish('BacktestDeadLettered') exactly once

   ───────────────────────────────────────────────────────────

   EventBus: 'BacktestCompleted' delivered to two independent subscribers

   ┌─────────────────────────┐        ┌───────────────────────────┐
   │  LeaderboardService     │        │  LoopController            │
   │  1. compute score       │        │  1. record result for      │
   │  2. upsert entry        │        │     current loopRunId      │
   │  3. re-sort, trim Top-K │        │  2. check stop conditions  │
   │  4. publish             │        │  3. generate next candidate│
   │     LeaderboardUpdated  │        │     or publish              │
   └───────────┬─────────────┘        │     SearchLoopStopped       │
               │                      └──────────────┬──────────────┘
               ▼                                     ▼
          PushGateway ───────── WebSocket ─────▶ Frontend
```

## 5. Sequence Diagrams

### Backtest Request → Completion → Leaderboard Update

```mermaid
sequenceDiagram
    participant SE as Strategy Engine
    participant EB as EventBus
    participant JQ as BullMqJobQueue
    participant R as Redis
    participant W as BacktestWorker
    participant MD as IMarketDataService
    participant LB as LeaderboardService
    participant WS as PushGateway
    participant FE as Frontend

    SE->>SE: generate jobId + correlationId (source=USER)
    SE->>JQ: await enqueue(payload), preserve jobId + priority
    JQ->>R: persist BullMQ job
    JQ-->>SE: accepted
    SE->>EB: publish observational BacktestRequested
    R->>W: claim job with lock
    W->>MD: getCandlesRange(pair, timeframe, range)
    MD-->>W: Candle[]
    W->>W: IBacktester.run() + IEvaluator.evaluate()
    W->>W: save BacktestResult (PostgreSQL)
    W->>EB: publish(BacktestCompleted, metrics)
    EB->>LB: deliver BacktestCompleted
    LB->>LB: compute score, upsert entry, re-sort Top-K
    LB->>EB: publish(LeaderboardUpdated, topK)
    EB->>WS: deliver LeaderboardUpdated
    WS-->>FE: WS push leaderboard:update
```

### Job Retry and Dead-Letter

```mermaid
sequenceDiagram
    participant JQ as BullMqJobQueue
    participant R as Redis
    participant W as BacktestWorker
    participant EB as EventBus
    participant DLQ as DeadLetterRepository

    R->>W: claim job (attempt 1)
    W--xW: unhandled exception
    W->>R: BullMQ delayed retry (attempt 2, 1s)
    R->>W: claim job (attempt 2)
    W--xW: unhandled exception
    W->>R: BullMQ delayed retry (attempt 3, 4s)
    R->>W: claim job (attempt 3)
    W--xW: unhandled exception
    W->>JQ: maxAttempts reached
    R->>R: retain job in failed set
    JQ->>DLQ: mirror deadLetter(jobId, reason)
    JQ->>EB: publish terminal BacktestFailed exactly once
    JQ->>EB: publish BacktestDeadLettered exactly once
```

### Search Loop Iteration

```mermaid
sequenceDiagram
    participant U as User (Frontend)
    participant LC as LoopController
    participant SG as IStrategyGenerator
    participant EB as EventBus
    participant JQ as JobQueue
    participant WS as PushGateway

    U->>LC: POST /api/loop/start (config)
    LC->>LC: create SearchLoopRun (status=RUNNING)
    LC->>EB: publish(SearchLoopStarted)
    loop until stop condition met
        LC->>SG: generate(1)
        SG-->>LC: candidate strategy
        LC->>LC: generate jobId + correlationId
        LC->>JQ: await enqueue(source=SEARCH_LOOP, loopRunId, jobId)
        LC->>EB: notify BacktestRequested after acceptance
        JQ-->>LC: (async) BacktestCompleted / BacktestFailed
        LC->>LC: record result, evaluate stop conditions
        LC->>EB: publish(SearchLoopProgress)
        EB->>WS: deliver SearchLoopProgress
        WS-->>U: WS push loop:progress
    end
    LC->>LC: set SearchLoopRun status (COMPLETED/STOPPED_BY_USER/FAILED)
    LC->>EB: publish(SearchLoopStopped)
    EB->>WS: deliver SearchLoopStopped
    WS-->>U: WS push loop:stopped
```

## 6. Data Model
| Entity | Fields | Relationships |
|--------|--------|---------------|
| LeaderboardEntry | `id (UUID, PK)`, `strategyVersionId (FK)`, `backtestResultId (UUID, UNIQUE)`, `rank (int)`, `score (float)`, `totalReturn (float)`, `winRate (float)`, `maxDrawdown (float)`, `sharpeRatio (float)`, `totalTrades (int)`, `createdAt`, `updatedAt` | Many-to-one → `StrategyVersion` (Strategy Engine); one-to-one → `BacktestResult` (Strategy Engine) via `backtestResultId` |
| SearchLoopRun | `id (UUID, PK)`, `status (enum: RUNNING\|PAUSED\|COMPLETED\|STOPPED_BY_USER\|FAILED)`, `generatorType (enum: RANDOM\|DOMAIN_GUIDED)`, `iteration (int)`, `testedCandidates (int)`, `maxCandidates (int, nullable)`, `maxDurationMs (int, nullable)`, `stopOnNoImprovementIterations (int, default 50)`, `currentCandidateStrategyVersionId (UUID, nullable)`, `bestStrategyVersionId (UUID, nullable)`, `bestScore (float, nullable)`, `stopReason (string, nullable)`, `startedAt`, `pausedAt (nullable)`, `stoppedAt (nullable)` | One-to-many → `SearchLoopCandidate` |
| SearchLoopCandidate | `id (UUID, PK)`, `loopRunId (FK)`, `strategyVersionId (FK)`, `backtestResultId (UUID, nullable)`, `iteration (int)`, `score (float, nullable)`, `status (enum: GENERATING\|BACKTESTING\|EVALUATED\|FAILED)`, `createdAt` | Many-to-one → `SearchLoopRun`; many-to-one → `StrategyVersion` |
| DeadLetterJob | `id (UUID, PK)`, `jobId (UUID)`, `jobType (string)`, `payload (JSONB)`, `attempts (int)`, `lastError (string)`, `deadLetteredAt`, `resolvedAt (nullable)` | Standalone — inspected via `GET /api/queue/dead-letter` |

> `LeaderboardEntry` and `SearchLoopRun`/`SearchLoopCandidate` live in tables owned by Event Infrastructure. They reference `StrategyVersion`/`BacktestResult` (owned by Strategy Engine) by ID only — never via a foreign-key join across module-owned schemas in application code, per `kb/MODULES.md` Rule 2 ("No direct database access across module boundaries"). Prisma model definitions written by Hoàng (who owns `shared/` + the Prisma schema), using the entity shapes defined here as the spec.

## 7. API Surface
See `kb/contracts/events.yaml` for event payloads. REST + WebSocket surface owned by this module:

### REST
| Method | Path | Description | Response |
|--------|------|--------------|----------|
| GET | `/api/leaderboard` | Current Top-K leaderboard, sortable | `{ rankingCriterion, updatedAt, entries: LeaderboardEntryPayload[] }` |
| GET | `/api/leaderboard?sortBy=sharpeRatio` | Re-sort by a different metric (client-side re-rank of the same Top-K set; does not re-run backtests) | same shape as above |
| GET | `/api/leaderboard/:strategyVersionId` | Detail for one leaderboard entry, including trade list (proxied from Strategy Engine's `BacktestResult`) | `LeaderboardEntryPayload & { trades: Trade[] }` |
| POST | `/api/loop/start` | Start a new search loop run | `{ loopRunId, status: "RUNNING" }` |
| POST | `/api/loop/:loopRunId/pause` | Pause a running loop | `{ loopRunId, status: "PAUSED" }` |
| POST | `/api/loop/:loopRunId/resume` | Resume a paused loop | `{ loopRunId, status: "RUNNING" }` |
| POST | `/api/loop/:loopRunId/stop` | Stop a loop (running or paused) | `{ loopRunId, status: "STOPPED_BY_USER" }` |
| GET | `/api/loop/:loopRunId` | Current status/progress of a loop run | `SearchLoopRun` shape |
| GET | `/api/loop/current` | Status of the currently active loop run, if any | `SearchLoopRun \| null` |
| GET | `/api/queue/stats` | Queue depth, in-flight, dead-letter counts | `QueueStats` (see `kb/contracts/events.yaml`) |
| GET | `/api/queue/dead-letter` | List dead-lettered jobs for operator inspection | `DeadLetterJob[]` |
| POST | `/api/queue/dead-letter/:jobId/retry` | Re-enqueue a dead-lettered job | `{ jobId, status: "QUEUED" }` |
| GET | `/api/dashboard/summary` | BFF composite: leaderboard Top-5 + current loop status + queue health in one call | `{ leaderboard, loop, queue }` |

### WebSocket (channels pushed by `PushGateway`)
| Channel | Event payload | Trigger |
|---------|---------------|---------|
| `leaderboard:update` | `LeaderboardUpdated` payload | Every `LeaderboardUpdated` bus event |
| `loop:started` | `SearchLoopStarted` payload | Loop start |
| `loop:progress` | `SearchLoopProgress` payload | After every candidate evaluation |
| `loop:stopped` | `SearchLoopStopped` payload | Loop completes/stops/fails |
| `connection:status` | `{ status: "connected" \| "reconnecting" }` | On connect/reconnect (client-side, mirrors DESIGN.md realtime UX rules) |

## 8. Quality Attributes
- **Security**: No auth in MVP (per `kb/CONSTITUTION.md`). Loop start/stop/pause endpoints are unauthenticated but rate-limited (max 1 active loop run at a time, enforced server-side — a second `POST /api/loop/start` while one is `RUNNING`/`PAUSED` returns `409 Conflict`). Error responses never leak stack traces to the client — only `{ error: string, code: string }`.
- **Performance**: BullMQ worker concurrency is configurable (default 3). USER priority prevents a search loop from indefinitely delaying interactive work. `GET /api/leaderboard` reads from the denormalized `LeaderboardEntry` table (already Top-K, already sorted) — never recomputes ranking on read.
- **Reliability**: Redis AOF plus BullMQ durable job state, three total attempts with 1s/4s retry delays, stalled-job recovery, graceful worker shutdown, and PostgreSQL dead-letter audit (`kb/contracts/events.yaml`). Worker side effects and subscribers are idempotent because stalled/redelivered jobs can execute at least once. EventEmitter2 remains process-local and is not claimed as a durable event log.
- **Observability**: `correlationId` propagates through `BacktestRequested → BacktestCompleted/Failed → LeaderboardUpdated` and through `SearchLoopStarted → BacktestRequested → SearchLoopProgress → SearchLoopStopped`, enabling full request tracing in logs. `GET /api/queue/stats` and `GET /api/dashboard/summary` expose live counts (queued, processing, dead-lettered, current loop iteration) so the demo can show "Loop is running: 125 candidates tested" without inspecting logs.
- **Scalability**: BullMQ/Redis is the accepted target (ADR-0013). Increasing in-process concurrency is configuration-only. Horizontal worker processes additionally require replacing the process-local `IEventBus`; this prerequisite must be completed before claiming multi-process completion-event delivery.

## 9. Testing Strategy
- **Unit tests**:
  - `EventBus`: publish wraps payload in a valid `EventEnvelope`; a throwing subscriber does not affect other subscribers or the publisher.
  - `BullMqJobQueue`/`BacktestWorker`: enqueue preserves `jobId`; duplicate IDs conflict; USER priority and equal-priority FIFO hold; attempts/delays are correct; retention is bounded; terminal failures mirror once to `DeadLetterJob`; `getStats()` maps BullMQ states correctly.
  - `LeaderboardService`: score computation is correct for known inputs; duplicate `BacktestCompleted` (same `backtestResultId`) does not create a duplicate entry; Top-K trimming keeps exactly K entries sorted correctly.
  - `LoopController`: stop conditions trigger correctly (`maxCandidates` reached, `maxDurationMs` elapsed, `stopOnNoImprovementIterations` reached, user-requested stop); pause prevents new candidates from being generated; resume continues from the same `loopRunId`.
- **Integration tests**:
  - Redis-backed queue flow: await `IJobQueue.enqueue` with Redis and Strategy/Market Data test doubles, publish the notification, and assert the BullMQ job is consumed and `BacktestCompleted` is correct.
  - Restart recovery: enqueue waiting/delayed jobs, restart NestJS without stopping Redis, and assert jobs resume without changing identity.
  - Stalled/idempotency path: simulate worker loss and prove recovered execution does not duplicate `BacktestResult`, terminal events, or dead-letter records.
  - Completion → Leaderboard → WebSocket: publish `BacktestCompleted` → assert `LeaderboardUpdated` is published and a connected mock WebSocket client receives `leaderboard:update`.
  - Full search loop: start a loop with `maxCandidates: 5` against test doubles → assert exactly 5 `BacktestRequested` events are published and the loop reaches `COMPLETED` with `stopReason: "max_candidates_reached"`.
  - Dead-letter path: force `IBacktester.run()` to throw on every attempt → assert the job ends in `DEAD_LETTER` status and both `BacktestFailed` and `BacktestDeadLettered` are published exactly once.
- **Manual/demo verification**: enqueue jobs, restart NestJS while Redis stays up, and show waiting work resumes; demonstrate USER priority, retry/backoff, DLQ recovery, Redis outage/recovery, and WebSocket reconnection.

## 10. Open Questions / TODOs
- [x] ~~Confirm `BacktestRequested`/`BacktestCompleted` field ownership split with Huy.~~ **Resolved 2026-08-09** — `kb/contracts/events.yaml` is the sole event-payload SSoT; Strategy Engine owns `BacktestConfig` and `EvaluationMetrics`, while Event Infrastructure owns envelope/routing metadata. — Owner: Phương + Huy
- [x] ~~Resolve `BacktestFailed` publisher mismatch.~~ **Resolved 2026-08-09** — Event Infrastructure's Job Queue Worker is the sole publisher of the exactly-once terminal event; Strategy Engine and Loop Controller consume it. — Owner: Phương + Huy
- [x] ~~Confirm Prisma schema/table ownership for `LeaderboardEntry`, `SearchLoopRun`, `SearchLoopCandidate`, `DeadLetterJob`.~~ **Resolved 2026-08-09** — Hoàng handles all Prisma model definitions (owns `shared/` + Prisma schema). Phương defines entity shapes in this file; Hoàng translates them into `schema.prisma`. — Owner: Hoàng
- [x] ~~Decide queue priority.~~ **Resolved 2026-08-12** — BullMQ priority `1` for USER and `10` for SEARCH_LOOP; FIFO within equal priority. — Owner: Phương
- [ ] Confirm final leaderboard scoring formula and default Top-K value with the team (see `kb/flows/leaderboard-update.md` Business Rules). — Owner: Phương
- [ ] Confirm whether `NewsCollected` will actually be published in W2+ (currently reserved/unused) — see `kb/contracts/events.yaml`. — Owner: Thuận
