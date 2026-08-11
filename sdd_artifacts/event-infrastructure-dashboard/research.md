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
- **Chosen**: Two FIFO source queues; dequeue `USER` first, otherwise `SEARCH_LOOP`.
- **Rationale**: Prevents a long search from starving interactive requests while maintaining deterministic ordering.
- **Alternatives considered**: Strict global FIFO; numeric heap priority. Global FIFO harms responsiveness; a heap is unnecessary for two fixed classes.
- **KB reference**: `kb/modules/event-infrastructure.md` open question and ADR-0006 consequence.

### D4: Event Delivery Semantics
- **Chosen**: Fire-and-forget publication with subscriber wrappers that catch sync failures and attach rejection handlers to async work; Event Envelope version starts at 1.
- **Rationale**: Matches `IEventBus.publish(): void`, isolates handlers, and keeps publishers unaware of subscriber results.
- **Alternatives considered**: Await all subscribers; expose the underlying emitter. Both change the contract/coupling model.
- **KB reference**: ADR-0005 and `kb/contracts/events.yaml` `IEventBus`.

### D5: Deterministic Queue Scheduling and Testing
- **Chosen**: In-memory source queues plus a job registry, bounded dispatcher, and injectable clock/scheduler abstraction; test with fake timers and polling predicates.
- **Rationale**: Meets MVP simplicity and makes retry timing/concurrency deterministic without long sleeps or constructor-injected primitive arrays.
- **Alternatives considered**: BullMQ now; raw `setTimeout` sleeps in tests. BullMQ is out of scope; sleeps are flaky per agent learning.
- **KB reference**: ADR-0006, ADR-0012, `agent_learn/lessons/market-data-backend-2026-08-10.md`.

### D6: Strategy Engine Integration Boundary
- **Chosen**: Add Strategy Engine-owned public ports for resolving immutable Strategy Versions/executable Strategies and saving/reading Backtest Results. Event Infrastructure consumes tokens only and uses test doubles independently.
- **Rationale**: Current shared interfaces expose algorithms but not version lookup or result persistence. Direct Prisma access would violate Strategy Engine data ownership.
- **Alternatives considered**: Worker queries `StrategyVersion`/`BacktestResult` directly; internal HTTP calls; import `StrategyRegistry`. All introduce forbidden coupling or needless transport.
- **KB reference**: `kb/MODULES.md` boundary rules; `kb/modules/event-infrastructure.md` data ownership.

### D7: Event Infrastructure Persistence
- **Chosen**: Prisma repositories inside Event Infrastructure for `LeaderboardEntry`, `SearchLoopRun`, `SearchLoopCandidate`, and `DeadLetterJob`; queue/status remains in memory.
- **Rationale**: These are the module's owned entities. Persistence supports restart reconciliation and snapshot reads while keeping MVP queue simple.
- **Alternatives considered**: Persist all queue jobs; keep Loop/Leaderboard entirely in memory. The former exceeds MVP; the latter contradicts existing models and recovery/read requirements.
- **KB reference**: ADR-0012; module data model Section 6.

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
- Queue backend is in memory for MVP; BullMQ is a migration path only.
- `MarketDataUpdated` and `NewsCollected` remain reserved with no MVP consumer.
- Strategy algorithms and Strategy-owned persistence are supplied through public ports, not implemented inside Event Infrastructure.

