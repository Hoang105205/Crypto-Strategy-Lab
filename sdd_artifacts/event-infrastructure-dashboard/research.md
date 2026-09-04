# Research: Event Infrastructure Dashboard

## Decisions

### D1: Contract Reconciliation Is a Blocking Gate
- **Chosen**: Update active KB contracts and their shared TypeScript mirrors before dependent implementation.
- **Rationale**: Constitution II/V makes contracts authoritative. Current shared code allows a payload without `jobId` and retains obsolete `BacktestFailed.willRetry`.
- **Alternatives considered**: Adapt implementation to drifted shared types; duplicate stricter local types. Both violate contract-driven delivery.
- **KB reference**: `kb/CONSTITUTION.md` II/V; `kb/contracts/events.yaml`.

### D2: Three Attempts Use Two Retry Delays
- **Chosen**: Attempt 1 failure waits 1s, attempt 2 failure waits 4s, attempt 3 failure is terminal; remove the unused 16s value from the queue contract.
- **Rationale**: `maxAttempts=3` means three executions and only two transitions to another attempt. This matches the active sequence diagrams and avoids a meaningless terminal delay.
- **Alternatives considered**: Wait 16s before dead-letter; interpret three delays as four attempts. Both conflict with terminal semantics or max-attempt count.
- **KB reference**: ADR-0006; `kb/modules/event-infrastructure.md` Job Retry sequence.

### D3: Manual Job Priority
- **Chosen**: One BullMQ queue with priority `1` for `USER` and `10` for `SEARCH_LOOP`; equal-priority jobs remain FIFO.
- **Rationale**: Prevents a long search from starving interactive requests while maintaining deterministic ordering.
- **Alternatives considered**: Strict global FIFO; separate physical queues. Global FIFO harms responsiveness; separate queues complicate global concurrency and stats.
- **KB reference**: ADR-0013 and `kb/contracts/events.yaml` `queue_runtime`.

### D4: Event Delivery Semantics
- **Chosen**: Fire-and-forget publication with subscriber wrappers that catch sync failures and attach rejection handlers to async work; Event Envelope version starts at 1.
- **Rationale**: Matches `IEventBus.publish(): void`, isolates handlers, and keeps publishers unaware of subscriber results.
- **Alternatives considered**: Await all subscribers; expose the underlying emitter. Both change the contract/coupling model.
- **KB reference**: ADR-0005 and `kb/contracts/events.yaml` `IEventBus`.

`BacktestRequested` is therefore observational: Strategy Engine/Loop Controller first await
`IJobQueue.enqueue`, then publish it. Enqueuing from a fire-and-forget subscriber was rejected
because the producer could return `202` before Redis acceptance and could not surface an outage.

### D5: BullMQ/Redis Queue Backend and Testing
- **Chosen**: `BullMqJobQueue` backed by Redis with production options exercised in integration tests against disposable Redis; unit-test domain processors with ports/fakes.
- **Rationale**: ADR-0013 makes durability, priority, retry, recovery, and inspection delivered behavior. Testing the real adapter catches Redis/BullMQ state mapping that fake schedulers cannot.
- **Alternatives considered**: Retain the in-memory adapter; RabbitMQ; Kafka; mock BullMQ entirely. The first contradicts the upgrade, brokers add unnecessary platform scope, and mocking alone cannot prove restart recovery.
- **KB reference**: ADR-0013; `kb/contracts/events.yaml`.

### D6: Strategy Engine Integration Boundary
- **Chosen**: Add Strategy Engine-owned public ports for resolving immutable Strategy Versions/executable Strategies and saving/reading Backtest Results. Event Infrastructure consumes tokens only and uses test doubles independently.
- **Rationale**: Current shared interfaces expose algorithms but not version lookup or result persistence. Direct Prisma access would violate Strategy Engine data ownership.
- **Alternatives considered**: Worker queries `StrategyVersion`/`BacktestResult` directly; internal HTTP calls; import `StrategyRegistry`. All introduce forbidden coupling or needless transport.
- **KB reference**: `kb/MODULES.md` boundary rules; `kb/modules/event-infrastructure.md` data ownership.

### D7: Queue State and Event Infrastructure Persistence
- **Chosen**: BullMQ stores queue lifecycle in Redis; Prisma stores `LeaderboardEntry`, `SearchLoopRun`, `SearchLoopCandidate`, and the durable `DeadLetterJob` audit mirror.
- **Rationale**: Redis is authoritative for live queue state while PostgreSQL preserves stable module-owned projections and DLQ audit independently of BullMQ retention.
- **Alternatives considered**: Duplicate every queue transition in PostgreSQL; remove `DeadLetterJob`; keep Loop/Leaderboard in memory. These create dual-write complexity, lose audit/API stability, or contradict snapshot requirements.
- **KB reference**: ADR-0013; module data model Section 6.

### D16: Redis Connection and Persistence Policy
- **Chosen**: Docker Compose Redis uses AOF. Queue-producing paths use bounded/fail-fast Redis request retries; worker connections reconnect persistently. Credentials are environment-only and never logged.
- **Rationale**: HTTP callers must not receive false queued acknowledgements or wait forever, while workers should resume automatically after a transient Redis outage.
- **Alternatives considered**: Redis without persistence; identical retry behavior for producers and workers; fail-open enqueue. Each risks lost work or misleading API behavior.
- **KB reference**: ADR-0013.

### D17: Retry, Stalls, and Idempotency
- **Chosen**: Three total BullMQ attempts with a custom 1s/4s backoff; terminal jobs remain failed and mirror once to `DeadLetterJob`. Graceful shutdown calls `Worker.close()`; stalled recovery is accepted as at-least-once execution.
- **Rationale**: BullMQ owns retry/lock state, but worker loss can cause re-execution. Idempotent result persistence and event/dead-letter guards protect domain state.
- **Alternatives considered**: Treat stalls as immediate terminal failure; delete failed jobs; publish terminal events from generic QueueEvents alone. These reduce recovery or make domain side effects race-prone.
- **KB reference**: ADR-0013; `kb/contracts/events.yaml`.

### D18: Worker Topology
- **Chosen**: Run BullMQ Worker inside NestJS for this feature.
- **Rationale**: `IEventBus` is EventEmitter2 and process-local. A separate worker could run the job but could not deliver `BacktestCompleted` to Leaderboard/Loop subscribers without another transport.
- **Alternatives considered**: Separate workers immediately; Redis Pub/Sub ad hoc inside the worker. Both expand scope or bypass `IEventBus`.
- **KB reference**: ADR-0005; ADR-0013.

### D8: Minimal Schema Corrections
- **Chosen**: Add `LeaderboardEntry.executedAt`; add unique `SearchLoopCandidate.jobId` and `updatedAt`; make `stopOnNoImprovementIterations` non-null default 50.
- **Rationale**: Deterministic tie-break needs execution time; terminal Events are correlated to candidates by job; status changes need observable update time; the safety bound cannot disappear.
- **Alternatives considered**: Use entry `createdAt`; correlate by version/iteration; keep safety bound nullable. These lose source semantics or allow ambiguity.
- **KB reference**: Leaderboard BR-3; Search Loop BR-2/BR-4.

### D9: Score Units and Projection
- **Chosen**: Accept `winRate` only in `[0,1]`; Total Return/Max Drawdown are percentages. Persist all entries, calculate global ranks deterministically, and return best-per-version Top-K for the default view.
- **Rationale**: `strategy.yaml` explicitly defines `winRate` as `0.0–1.0`. This keeps formula inputs normalized.
- **Alternatives considered**: Treat win rate as 0–100; store Top-K only. Both contradict the active contract/flow.
- **KB reference**: `kb/contracts/strategy.yaml`; Leaderboard flow BR-2/BR-5/BR-6.

### D10: Single Active Search Loop
- **Chosen**: Application-level single-process mutex plus transactional active-run check; no partial unique database index for MVP.
- **Rationale**: The deployment is one backend process and only one active run is required. A Postgres-specific partial index is awkward in Prisma and unnecessary for MVP.
- **Alternatives considered**: Database advisory locks; multi-run scheduler. Both are premature complexity.
- **KB reference**: Search Loop BR-6; Constitution IV.

### D11: Late Loop Results
- **Chosen**: Persist an in-flight result arriving after pause or terminal stop, but do not generate another candidate; after terminal stop, do not emit a later progress Event.
- **Rationale**: Preserves completed work without creating a confusing `progress` event after `stopped`.
- **Alternatives considered**: Drop the result; reopen the run; emit progress after stopped. Each breaks reproducibility or event ordering.
- **KB reference**: Search Loop alternative paths and BR-7.

### D12: Infrastructure WebSocket Topology
- **Chosen**: Add `/infrastructure` namespace for Leaderboard/Loop channels; preserve `/market-data` and its socket-room behavior unchanged.
- **Rationale**: Avoids rewriting a completed feature and keeps ownership boundaries explicit. The browser may maintain one connection per namespace through separate singletons.
- **Alternatives considered**: Add channels to Market Data gateway; replace both with one new gateway. Both expand the change surface and risk regression.
- **KB reference**: `kb/DESIGN.md` routes/channels; Market Data frontend lesson.

### D13: Snapshot and Realtime Reconciliation
- **Chosen**: REST is authoritative. Track `updatedAt`/applied revision timestamps, retain last successful data during disconnect, refetch on reconnect, and ignore snapshot data older than the latest applied realtime update.
- **Rationale**: Prevents stale snapshot responses from overwriting fresher live state.
- **Alternatives considered**: Clear state on disconnect; blindly apply last response. Both violate the stale-state UX contract.
- **KB reference**: Leaderboard error flow; DESIGN.md Shared UI States.

### D14: Frontend Testing
- **Chosen**: Add Vitest 2, jsdom, and React Testing Library for the new infrastructure hooks/components.
- **Rationale**: The architecture declares Vitest for frontend, while the current package has no configured frontend tests. Reconnect and state-preservation behavior require automated verification.
- **Alternatives considered**: Manual-only checks; browser E2E framework. Manual-only is insufficient; a new E2E stack is unnecessary.
- **KB reference**: `kb/ARCHITECTURE.md` Testing; `kb/CONTRIBUTING.md`.

### D15: Error Contract
- **Chosen**: Stable `{ error, code }` bodies with explicit validation, conflict, not-found, dependency-unavailable, and internal codes; never return stack traces.
- **Rationale**: Gives frontend predictable handling without leaking internals.
- **Alternatives considered**: Framework-default mixed bodies; raw errors. Both violate the active module quality rules.
- **KB reference**: `kb/modules/event-infrastructure.md` Security.

## Resolved Questions

- `winRate` is `[0,1]` per Strategy contract.
- Canonical names are `/strategies`, `getCandlesRange`, and `run`.
- Queue backend is BullMQ/Redis; the in-memory implementation and ADR-0012 are superseded.
- BullMQ workers remain in the NestJS process until `IEventBus` becomes cross-process.
- `MarketDataUpdated` and `NewsCollected` remain reserved with no MVP consumer.
- Strategy algorithms and Strategy-owned persistence are supplied through public ports, not implemented inside Event Infrastructure.
