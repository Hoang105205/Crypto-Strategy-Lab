# Feature Specification: Event Infrastructure Dashboard

**Feature**: `event-infrastructure-dashboard`  
**Created**: 2026-08-11  
**Status**: Draft  
**Input**: User description: "Build Member D's complete brownfield Event Infrastructure and Dashboard scope, using the master `hoang-sdd-on` requirements, the current intent, active KB, and the identified contract-reconciliation gates. Separate acceptance criteria into typed-event-bus, backtest-job-queue, realtime-leaderboard, strategy-search-loop, and dashboard-realtime-ui."

## Scope Summary

This feature supplies the asynchronous coordination and realtime presentation layer for Crypto Strategy Lab. It accepts backtest requests without blocking callers, persists them in a Redis-backed BullMQ queue, executes them through bounded background work, reacts to completed results with a deterministic Leaderboard, orchestrates a bounded Search Loop, and exposes current state to users through snapshot queries and realtime updates.

This is a brownfield feature. Existing Market Data, Strategy Engine, News & Sentiment, shared contracts, charts, hooks, and completed SDD artifacts are preserved. Event Infrastructure may consume another module only through an active contract or shared interface and may not absorb that module's business logic.

## User Scenarios & Testing

### User Story 1 - Typed Event Bus (Priority: P1)

As a module owner, I can publish and subscribe to contract-defined Events without knowing another module's implementation, so completion, failure, ranking, and loop progress can trigger independent reactions safely.

**Why this priority**: Every other subfeature depends on reliable, contract-aligned event delivery and traceability.

**Independent Test**: Publish a contract-defined test Event to multiple subscribers, including one failing subscriber, and verify the envelope, correlation chain, successful deliveries, unsubscribe behavior, and failure isolation without running a queue, database, or frontend.

**Acceptance Scenarios**:

1. **Given** a publisher supplies a valid event type and payload without a correlation identifier, **When** the Event is published, **Then** subscribers receive one Event Envelope containing a unique event identifier, event type, schema version, UTC occurrence time, generated correlation identifier, and the original payload.
2. **Given** a publisher supplies an existing correlation identifier, **When** the Event is published, **Then** the same identifier is preserved for downstream tracing.
3. **Given** multiple subscribers listen to the same Event and one subscriber fails, **When** the Event is delivered, **Then** the failure is recorded and the publisher and other subscribers remain unaffected.
4. **Given** a subscriber has unsubscribed, **When** a matching Event is subsequently published, **Then** that subscriber receives no further delivery.
5. **Given** an event type or payload differs from the active event contract, **When** the change is proposed, **Then** the contract and shared event types must be reconciled before dependent implementation proceeds.
6. **Given** `MarketDataUpdated` and `NewsCollected` have no active MVP consumer, **When** Event Infrastructure is delivered, **Then** no speculative consumer is introduced for either Event.

---

### User Story 2 - Asynchronous Backtest Job Queue (Priority: P1)

As a user or Search Loop, I can submit a backtest and receive its identifier immediately while bounded workers process the job, retry transient failures, and retain terminal failures for operator recovery.

**Why this priority**: Asynchronous execution is the critical scalability and responsiveness boundary for both manual backtests and automated search.

**Independent Test**: Submit jobs through `BullMqJobQueue` against disposable Redis using test doubles for domain dependencies; verify durable storage, restart recovery, scheduling, concurrency, priority, success, retry, stalled-job handling, terminal failure, dead-letter inspection, manual recovery, and shutdown.

**Acceptance Scenarios**:

1. **Given** a valid manual or Search Loop request with a producer-generated `jobId`, **When** it is accepted, **Then** that same identifier is returned without waiting for backtest execution.
2. **Given** a `jobId` already known to the queue, **When** it is submitted again, **Then** the duplicate is rejected and no second execution is created.
3. **Given** more jobs than available workers, **When** workers process the queue, **Then** active execution never exceeds the configured concurrency and remaining jobs stay queued.
4. **Given** manual and Search Loop jobs are waiting, **When** a worker becomes available, **Then** a `USER` job is chosen before a `SEARCH_LOOP` job while FIFO order is preserved within each source group.
5. **Given** all dependencies return valid data, **When** a worker completes a backtest, **Then** the result is persisted, the job becomes `COMPLETED`, and one `BacktestCompleted` Event is published with the contract-defined metrics and identifiers.
6. **Given** attempt one or two encounters a retryable failure, **When** retry policy is applied, **Then** the job waits 1 second or 4 seconds respectively, remains internally observable, and no `BacktestFailed` Event is published.
7. **Given** attempt three fails, **When** the job becomes terminal, **Then** it enters the Dead-letter Queue and exactly one `BacktestFailed` and one `BacktestDeadLettered` Event are published.
8. **Given** no historical candles or an unknown Strategy Version, **When** the worker detects the non-retryable condition, **Then** remaining attempts are skipped and the job follows the terminal dead-letter path.
9. **Given** an operator retries a dead-lettered job, **When** recovery is accepted, **Then** its attempt counter resets to one, its original identity and payload are preserved, and it returns to `QUEUED`.
10. **Given** an operator requests queue health, **When** the snapshot is returned, **Then** it reports queued, processing, completed-in-last-24-hours, and dead-lettered counts accurately.
11. **Given** waiting or delayed jobs exist in Redis, **When** NestJS restarts while Redis remains available, **Then** jobs retain their identity and resume processing without being resubmitted.
12. **Given** a worker loses its lock or exits ungracefully, **When** BullMQ marks the job stalled, **Then** the job is recovered according to the stalled-job policy and idempotency prevents duplicate result or terminal side effects.
13. **Given** Redis is unavailable during an enqueue request, **When** the configured producer retry limit is exhausted, **Then** the caller receives a stable dependency-unavailable response and no false queued acknowledgement.
14. **Given** the backend receives a shutdown signal, **When** graceful shutdown begins, **Then** the BullMQ Worker stops taking new jobs, active work is allowed to finish within the application shutdown policy, and Redis connections close cleanly.

---

### User Story 3 - Realtime Leaderboard (Priority: P2)

As a user, I can see a deterministic Top-K ranking react to successful backtests and inspect a Strategy Version without refreshing the page or losing my selected sort and row.

**Why this priority**: The Leaderboard is the visible outcome of the backtest pipeline and the score source used by the Search Loop.

**Independent Test**: Deliver `BacktestCompleted` Events directly to the Leaderboard with an isolated store and realtime client; verify validation, score normalization, idempotency, ranking, tie-breaks, persistence, sorting, and reconnect resynchronization.

**Acceptance Scenarios**:

1. **Given** a valid `BacktestCompleted` Event, **When** the Leaderboard reacts, **Then** it validates the metrics, computes the configured score, persists the entry, reranks results, and publishes a fresh Top-K snapshot.
2. **Given** the same `backtestResultId` is delivered more than once, **When** duplicate delivery is handled, **Then** only one entry exists and no duplicate realtime update is emitted.
3. **Given** required metrics are missing or non-numeric, **When** the Event is handled, **Then** ranking is skipped, the contract violation is traceable, and the successful Backtest Result remains unaffected.
4. **Given** two results have scores equal to four decimal places, **When** ranks are assigned, **Then** higher Sharpe Ratio wins, followed by less severe Max Drawdown, followed by earlier execution time.
5. **Given** a result does not qualify for Top-K, **When** ranking completes, **Then** it remains persisted but is absent from the default Top-K snapshot.
6. **Given** the same immutable Strategy Version is backtested repeatedly, **When** results are ranked, **Then** every result remains stored while the default view surfaces only that version's best-scoring entry.
7. **Given** the user chooses a supported ranking criterion, **When** results are requested, **Then** they are sorted without rerunning backtests or broadcasting a global ranking change for that personal view.
8. **Given** a realtime update arrives, **When** the table refreshes in place, **Then** its timestamp changes while the user's selected criterion and selected Strategy remain unchanged.
9. **Given** a client missed updates while disconnected, **When** it reconnects, **Then** it reloads the authoritative snapshot and converges to current ranking state.

---

### User Story 4 - Bounded Strategy Search Loop (Priority: P2)

As a user, I can start, pause, resume, stop, and observe an automated generate-backtest-evaluate-rank cycle that never runs without a bound and does not couple orchestration to a specific generator or backtester.

**Why this priority**: The Search Loop turns individual backtests into an experiment platform while demonstrating replaceable search and execution boundaries.

**Independent Test**: Run the Loop with fake candidate generation and terminal result Events; verify state transitions, candidate accounting, stop conditions, failure isolation, single-active-run protection, and restart reconciliation without a real backtester or frontend.

**Acceptance Scenarios**:

1. **Given** no active run and a valid bounded configuration, **When** the user starts a Search Loop, **Then** one `RUNNING` run is created, `SearchLoopStarted` is published, and candidate generation begins.
2. **Given** a run is already `RUNNING` or `PAUSED`, **When** another start is requested, **Then** the request is rejected as a conflict and identifies the active run.
3. **Given** a candidate is generated, **When** it is submitted for backtesting, **Then** the Loop creates `jobId` + `correlationId`, awaits durable `IJobQueue.enqueue`, and then publishes observational `BacktestRequested` with source `SEARCH_LOOP` and a non-null `loopRunId`.
4. **Given** a candidate receives terminal completion, **When** the result is recorded, **Then** tested count, iteration, candidate status, score, and best Strategy are updated and `SearchLoopProgress` is published.
5. **Given** a candidate receives terminal failure, **When** it is recorded, **Then** it counts as tested, is excluded from best-score calculation, and does not stop the Loop by itself.
6. **Given** the user pauses a run, **When** a job is already in flight, **Then** no new candidate is generated, the in-flight job may finish and be recorded, and the run remains non-terminal.
7. **Given** a paused run, **When** the user resumes it, **Then** the same run identifier, iteration, tested candidates, and best score are retained.
8. **Given** the user stops a running or paused run, **When** stop is accepted, **Then** no new candidate is generated, in-flight work may finish and be recorded, and the run ends as `STOPPED_BY_USER` with a `SearchLoopStopped` Event.
9. **Given** maximum candidates, maximum duration, or no-improvement limit is reached, **When** stop conditions are evaluated, **Then** the run ends as `COMPLETED` with a deterministic reason.
10. **Given** a score changes by no more than `0.01`, **When** improvement is evaluated, **Then** it does not reset the no-improvement counter.
11. **Given** candidate generation fails three consecutive times, **When** the retry allowance is exhausted, **Then** the run ends as `FAILED` with reason `generator_error`.
12. **Given** the process restarts with a persisted `RUNNING` run, **When** startup reconciliation finds its matching BullMQ job in waiting, delayed, or active state, **Then** the run remains recoverable; if no matching job exists, it becomes `FAILED` with reason `orphaned_after_restart`.

---

### User Story 5 - Dashboard and Realtime UI (Priority: P3)

As a user, I can navigate a consistent application shell, monitor live market data alongside queue and Search Loop health, control the Loop, and inspect the Leaderboard across desktop and mobile without stale-state confusion.

**Why this priority**: This subfeature makes the infrastructure observable and operable, but it can be delivered after the underlying snapshots and Events are independently correct.

**Independent Test**: Run the UI against stubbed snapshot and realtime sources and verify navigation, Dashboard composition, Loop controls, ranking interaction, loading/error/empty/stale states, accessibility, responsive behavior, and state-preserving updates.

**Acceptance Scenarios**:

1. **Given** a user opens any application page, **When** the shared shell renders, **Then** navigation exposes Dashboard, Strategy Builder, Leaderboard, and News Feed at `/`, `/strategies`, `/leaderboard`, and `/news` with an accessible active state.
2. **Given** Dashboard data is available, **When** the summary loads, **Then** current Leaderboard, Search Loop, and queue health appear together without the client reconstructing business rules.
3. **Given** a desktop viewport, **When** Dashboard renders, **Then** existing Market Data charts remain in the main region and Loop status, queue health, and Leaderboard preview appear in the side region.
4. **Given** a user operates Loop controls, **When** start, pause, resume, or stop succeeds, **Then** status, tested candidates, current candidate, best score, and progress update without a page refresh.
5. **Given** a realtime connection becomes stale or disconnected, **When** the UI reports connection state, **Then** the last successful data and timestamp remain visible and status is conveyed with text or an accessible label rather than color alone.
6. **Given** the connection is restored, **When** realtime delivery resumes, **Then** authoritative snapshots are reloaded before normal live updates continue.
7. **Given** data is loading, empty, or failed, **When** the corresponding state renders, **Then** layout remains stable, the condition is explained, and the user receives at most one clear next action or retry action without internal errors.
8. **Given** a keyboard or assistive-technology user, **When** controls and sortable headers are used, **Then** every control is reachable, visibly focused, labeled, and exposes sort state without relying on color.
9. **Given** a viewport narrower than 768px, **When** Dashboard or Leaderboard renders, **Then** navigation and panels collapse appropriately and financial tables remain usable through horizontal scrolling without dropping required columns.
10. **Given** a user opens Strategy detail or trade visualization, **When** result data is displayed, **Then** immutable version, evaluation metrics, trades, and available Entry/Exit markers are rendered from published data without calculating trading or ranking logic in the client.

## Edge Cases

- A producer sends `source=USER` with a non-null `loopRunId`, or `source=SEARCH_LOOP` with a missing `loopRunId`.
- A queue request contains an empty, malformed, or duplicate `jobId`.
- A delayed retry becomes available while all workers are occupied.
- Manual jobs continue arriving while Search Loop jobs are waiting; neither source group may lose FIFO ordering within its own priority.
- A worker finishes after the user paused or stopped the originating Loop.
- A terminal failure path is invoked more than once because of overlapping error handling.
- Dead-letter recovery is requested for an unknown, unresolved, or already-resolved job.
- A Backtest completes with zero trades or non-finite metrics.
- Leaderboard persistence succeeds but realtime publication fails, or persistence fails before publication.
- Scores are negative, exceed expected percentage ranges, or tie after rounding.
- A `BacktestCompleted` Event has a `loopRunId` that does not match the active run.
- A late result arrives after a Loop has reached a terminal state.
- Maximum duration elapses while a candidate is in flight.
- The user pauses and immediately requests stop or resume.
- A Search Loop is restored with inconsistent run and candidate state after restart.
- Realtime Events arrive out of order, repeat, or are missed during disconnect.
- Snapshot refresh completes after a newer realtime update; the UI must not regress to stale state.
- Mobile navigation, table scrolling, or loading states must not hide Loop controls or financial columns.

## Requirements

### Functional Requirements

#### Contract Reconciliation Requirements

- **FR-001**: The active event contract MUST remain the sole source of truth for Event names, publishers, subscribers, envelope fields, and payload fields.
- **FR-002**: Before dependent implementation, shared queue contracts MUST require the producer-supplied `jobId` and preserve it through the complete job lifecycle.
- **FR-003**: Before dependent implementation, the shared `BacktestFailed` payload MUST remove retry-intent data and represent terminal failure only.
- **FR-004**: Retry policy MUST define three total execution attempts with waits of 1 second after attempt one and 4 seconds after attempt two; attempt three failure MUST be terminal. The obsolete 16-second post-attempt value MUST be reconciled out of the active contract before implementation.
- **FR-005**: Leaderboard scoring MUST consume `winRate` in the Strategy contract's normalized `[0,1]` range; boundary validation MUST reject or explicitly normalize data outside that contract.
- **FR-006**: Queue ordering MUST give `USER` jobs precedence over `SEARCH_LOOP` jobs while retaining FIFO order within each source group.
- **FR-007**: Canonical public naming MUST use `/strategies`, `getCandlesRange`, and `run` as established by active design/contracts and current shared interfaces.

#### Typed Event Bus Requirements

- **FR-010**: The system MUST support publishing, subscribing, and unsubscribing through the shared Event Bus contract.
- **FR-011**: Every published Event MUST carry a complete Event Envelope with unique identity, type, schema version, UTC occurrence time, correlation identity, and payload.
- **FR-012**: A supplied correlation identifier MUST be preserved; an absent correlation identifier MUST be generated.
- **FR-013**: Subscriber failure MUST be isolated from the publisher and all sibling subscribers and MUST remain observable in logs.
- **FR-014**: Event names and payloads MUST match all ten active event definitions without reduced local copies.
- **FR-015**: Reserved Events without active consumers MUST remain publishable but MUST NOT gain speculative behavior.
- **FR-016**: Event chains for backtest, ranking, and Search Loop progress MUST retain enough correlation data to trace one logical request end to end.

#### Backtest Job Queue Requirements

- **FR-020**: A valid backtest submission MUST be acknowledged with its producer-generated `jobId` after BullMQ accepts it, without waiting for execution; `BacktestRequested` is published afterward and MUST NOT be consumed to enqueue work.
- **FR-021**: The queue MUST reject duplicate `jobId` values and MUST NOT replace a producer-generated identifier.
- **FR-022**: Jobs MUST expose `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, and `DEAD_LETTER` lifecycle states.
- **FR-023**: Worker concurrency MUST be configurable, default to three, and never exceed the active configuration.
- **FR-024**: Workers MUST obtain candles, strategy behavior, evaluation, and persistence only through approved public boundaries.
- **FR-025**: A successful job MUST persist one immutable Backtest Result and publish one contract-valid `BacktestCompleted` Event.
- **FR-026**: Retryable intermediate failure MUST remain internal to queue state and MUST NOT publish `BacktestFailed`.
- **FR-027**: A terminal failure MUST publish `BacktestFailed` exactly once per `jobId`.
- **FR-028**: A dead-letter transition MUST publish `BacktestDeadLettered` exactly once per transition.
- **FR-029**: Zero historical candles and an unknown Strategy Version MUST be treated as non-retryable.
- **FR-030**: A Dead-letter Job MUST retain original identity, type, payload, attempt count, last error, and dead-letter time.
- **FR-031**: An operator MUST be able to list Dead-letter Jobs and retry an eligible job with its attempt reset to one.
- **FR-032**: Queue health MUST report queued, processing, completed-in-last-24-hours, and dead-lettered counts.
- **FR-033**: A replacement queue backend MUST be possible without changing queue consumers or business flows.
- **FR-034**: The active `IJobQueue` implementation MUST use BullMQ backed by Redis and MUST use the producer UUID as BullMQ `jobId`.
- **FR-035**: `USER` jobs MUST use BullMQ priority `1`, `SEARCH_LOOP` jobs priority `10`, and equal-priority jobs MUST remain FIFO.
- **FR-036**: Automatic retry MUST use three total attempts and deterministic waits of 1 second then 4 seconds; non-retryable failures MUST discard remaining attempts.
- **FR-037**: Waiting and delayed jobs MUST survive a NestJS restart while Redis remains available.
- **FR-038**: BullMQ completed and failed job retention MUST be bounded by configurable age/count policies; Redis MUST use an explicitly documented persistence policy.
- **FR-039**: Queue processing, result persistence, terminal events, and dead-letter mirroring MUST be idempotent under stalled-job recovery and at-least-once execution.

#### Realtime Leaderboard Requirements

- **FR-040**: The Leaderboard MUST react to `BacktestCompleted` without direct invocation from the worker or Strategy Engine.
- **FR-041**: A Leaderboard update MUST be idempotent on `backtestResultId`.
- **FR-042**: Required metrics MUST be finite and contract-valid before an entry is ranked.
- **FR-043**: The default score MUST equal `0.5 * clamp(totalReturn / 100, -1, 1) + 0.2 * winRate + 0.3 * (1 - min(abs(maxDrawdown) / 50, 1))`.
- **FR-044**: Results with zero completed trades MUST remain rankable with return and win rate treated as zero rather than causing failure.
- **FR-045**: Ties at four decimal places MUST be resolved by higher Sharpe Ratio, then less severe Max Drawdown, then earlier execution time.
- **FR-046**: Every valid result MUST remain stored even when it does not qualify for Top-K.
- **FR-047**: Default Top-K MUST be 10 and MUST be configurable.
- **FR-048**: Default Leaderboard presentation MUST expose at most the best result per immutable Strategy Version.
- **FR-049**: Re-backtesting a Strategy Version MUST create a new result and entry rather than overwrite history.
- **FR-050**: Users MUST be able to sort by score, Total Return, Win Rate, Max Drawdown, and Sharpe Ratio without rerunning a backtest.
- **FR-051**: A realtime ranking Event MUST be published only after successful persistence and ranking.
- **FR-052**: Changing scoring policy MUST NOT require changes to backtest execution or evaluation.

#### Strategy Search Loop Requirements

- **FR-060**: The Search Loop MUST orchestrate candidate generation and terminal result Events without implementing generation, backtesting, or evaluation algorithms.
- **FR-061**: Only one run may be `RUNNING` or `PAUSED` at a time in MVP.
- **FR-062**: A start request MUST require a safe bound: maximum candidates, maximum duration, or an always-active no-improvement limit.
- **FR-063**: No Search Loop execution path may be unbounded.
- **FR-064**: Each generated candidate MUST link to an immutable Strategy Version and a producer-generated backtest `jobId`.
- **FR-065**: Search-originated requests MUST carry source `SEARCH_LOOP` and a non-null `loopRunId`.
- **FR-066**: A candidate MUST count as tested only after terminal completion or terminal failure.
- **FR-067**: A failed candidate MUST be recorded, excluded from best-score improvement, and MUST NOT stop the run by itself.
- **FR-068**: Improvement MUST exceed epsilon `0.01` to reset the no-improvement counter.
- **FR-069**: Stop conditions MUST be evaluated in order: user stop/pause, maximum candidates, maximum duration, then no-improvement limit.
- **FR-070**: Pausing MUST stop new generation without cancelling in-flight work.
- **FR-071**: Resuming MUST preserve the run identity, iteration, tested candidates, and best result.
- **FR-072**: Stopping MUST prevent new generation, permit in-flight result recording, and publish terminal status.
- **FR-073**: Candidate generation MUST allow no more than three consecutive failures before terminal `generator_error`.
- **FR-074**: Startup reconciliation MUST preserve an active run when BullMQ contains its matching waiting/delayed/active job; only an unrecoverable orphan MUST become `FAILED` with reason `orphaned_after_restart`.
- **FR-075**: Loop state and each candidate outcome MUST remain queryable and reproducible.
- **FR-076**: Replacing the Strategy Generator MUST NOT require changes to queueing, backtesting, evaluation, or ranking.

#### Dashboard, API, and Realtime UI Requirements

- **FR-080**: The system MUST expose current Leaderboard, Loop, queue, Dead-letter, and Dashboard summary operations defined by the active module KB.
- **FR-081**: Dashboard summary MUST compose current Leaderboard, active Loop, and queue health into one coherent snapshot.
- **FR-082**: Invalid commands and missing resources MUST return stable, user-safe error information without stack traces or raw provider failures.
- **FR-083**: Realtime clients MUST receive Leaderboard updates and Search Loop started, progress, and stopped updates on the active channels.
- **FR-084**: Realtime delivery MUST relay authoritative state and MUST NOT calculate ranking, trading, or Loop business rules.
- **FR-085**: The application shell MUST provide canonical navigation for `/`, `/strategies`, `/leaderboard`, and `/news`.
- **FR-086**: Dashboard MUST integrate existing Market Data controls and charts without duplicating or replacing their completed behavior.
- **FR-087**: Dashboard MUST display current Loop status, iteration, tested candidates, current candidate, best score, elapsed progress, and valid controls for the current state.
- **FR-088**: Dashboard MUST display queue health and a compact Leaderboard preview alongside Market Data.
- **FR-089**: Leaderboard UI MUST expose an accessible sortable table, last-updated time, selected Strategy detail, immutable version, metrics, and trades.
- **FR-090**: Realtime table updates MUST preserve the user's current sort and selected Strategy.
- **FR-091**: Reconnect MUST retain the last successful display and reload authoritative snapshots before normal live updates continue.
- **FR-092**: Loading states MUST preserve final layout dimensions; empty and error states MUST explain the condition and provide a valid next action or retry.
- **FR-093**: Connection, ranking, and control state MUST NOT be communicated by color alone.
- **FR-094**: All interactive controls MUST be keyboard reachable, visibly focused, and accessibly labeled; sortable headers MUST expose sort state.
- **FR-095**: At widths below 768px, navigation and panels MUST collapse, controls MUST remain available, and financial tables MUST scroll horizontally without dropping required data.
- **FR-096**: Trading colors MUST be reserved for market direction and P&L, while primary accent color MUST be reserved for primary actions and emphasis.
- **FR-097**: Trade and marker presentation MUST consume published Backtest Result data and MUST NOT calculate trading or ranking logic in the client.

#### Quality and Governance Requirements

- **FR-100**: All business-significant failures and state transitions MUST be traceable by correlation identity and structured operational information.
- **FR-101**: External secrets MUST remain outside source control, and the MVP MUST NOT introduce real-fund trading or user-account behavior.
- **FR-102**: Completed Market Data and News behavior MUST be preserved; integration changes MUST be minimal and contract-compatible.
- **FR-103**: Contract or shared-interface changes MUST be completed and communicated before implementation that depends on them.
- **FR-104**: The feature MUST demonstrate replaceability of Event subscribers, queue backend, Strategy Generator, scoring policy, and worker concurrency at final verification.
- **FR-105**: Unit and integration verification MUST cover the acceptance scenarios for all five subfeatures, including exactly-once terminal Events, idempotency, state transitions, and reconnect convergence.

## Key Entities

- **Event Envelope**: Immutable wrapper for one Event occurrence, carrying event identity, type, version, UTC occurrence time, correlation identity, and payload.
- **Job Request**: One asynchronous unit of work with producer-owned identity, type, payload, attempt information, correlation identity, creation time, and availability time.
- **Job Status**: Current lifecycle state, attempt, last error, and update time for a Job.
- **Dead-letter Job**: Terminally failed Job retained with its original payload and operational failure details for inspection and recovery.
- **Leaderboard Entry**: Ranked projection of one immutable Backtest Result, uniquely identified by `backtestResultId` and linked by identifier to its Strategy Version.
- **Search Loop Run**: One bounded execution of automated strategy search, including state, generator type, progress, stop configuration, best result, and lifecycle timestamps.
- **Search Loop Candidate**: One generated Strategy Version within a Search Loop Run, linked to its Backtest Result when available and carrying iteration, score, and terminal status.
- **Queue Stats**: Snapshot of queued, processing, recently completed, and dead-lettered work.
- **Dashboard Summary**: Read model combining current Leaderboard, active Search Loop, and queue health for the Dashboard.

## Success Criteria

- **SC-001**: 100% of contract-defined Event types compile against one shared payload definition, and no active source retains the obsolete `BacktestFailed.willRetry` field.
- **SC-002**: In an isolated acceptance test, one failing subscriber causes zero missed deliveries to other subscribers and zero publisher failures.
- **SC-003**: A valid backtest submission is acknowledged with the unchanged producer `jobId` before backtest execution begins.
- **SC-004**: Under a concurrency setting of three, observed simultaneous job execution never exceeds three and reaches three when at least three executable jobs are available.
- **SC-005**: A permanently retryable failing job runs exactly three attempts, waits according to the two active delays, and emits exactly one terminal failure Event and one dead-letter Event.
- **SC-006**: Duplicate submission of a known `jobId` results in one stored Job and one execution path.
- **SC-007**: Duplicate delivery of one `BacktestCompleted` Event results in exactly one Leaderboard Entry and at most one corresponding ranking update.
- **SC-008**: For a fixed metrics dataset, score, Top-10 membership, best-per-version projection, and every tie-break produce deterministic repeatable results.
- **SC-009**: A Search Loop configured for five candidates produces exactly five terminal candidate records and stops without generating a sixth request.
- **SC-010**: Pause produces no new candidate requests, resume retains the same run state, and stop prevents all later candidate generation while allowing already in-flight results to be recorded.
- **SC-011**: Replacing the active Strategy Generator test double requires zero changes to queue, worker, Leaderboard, or Loop acceptance tests.
- **SC-012**: After simulated realtime disconnection and missed updates, reconnect plus snapshot reload yields the same Dashboard and Leaderboard state as a fresh client.
- **SC-013**: Dashboard and Leaderboard remain fully operable at representative desktop and sub-768px mobile widths with keyboard-only navigation and no hidden required data.
- **SC-014**: All five subfeature acceptance suites pass without live Binance or live sentiment service; queue integration suites run against disposable Redis with the production BullMQ adapter.
- **SC-015**: Architecture analysis reports no direct implementation import, circular dependency, duplicated shared contract, or cross-module database access introduced by this feature.
- **SC-016**: Waiting and delayed jobs keep the same `jobId` and complete after a NestJS restart while Redis stays running.
- **SC-017**: A duplicate BullMQ execution caused by stalled recovery creates no duplicate Backtest Result, Leaderboard Entry, terminal Event, or Dead-letter record.

## Assumptions

- The current Strategy contract is authoritative: `winRate` is normalized to `[0,1]`, while Total Return and Max Drawdown are percentage values.
- Three total attempts means two retry waits: 1 second after attempt one and 4 seconds after attempt two. The current 16-second value is obsolete and must be reconciled before implementation.
- Manual `USER` jobs have priority over `SEARCH_LOOP` jobs; FIFO is retained within each source group.
- Default worker concurrency is three, default Top-K is ten, and default no-improvement limit is fifty iterations.
- The MVP supports one active Search Loop and has no authentication, user accounts, or real-fund trading.
- BullMQ/Redis is the required queue delivery. Workers run inside the NestJS backend process for this feature because `IEventBus` remains process-local.
- Existing Prisma models are available, but their owner must review any schema change requested during planning.
- Existing Market Data frontend and backend SDD features are complete. Their charts, hooks, subscription behavior, and controls are integration dependencies, not rewrite targets.
- Strategy Engine owns Strategy implementations, immutable Strategy Versions, Backtester, Evaluator, and Backtest Result domain behavior.
- Trade visualization is limited to presenting published trade data and available markers; generating trades or signals is outside scope.
- Realtime transport is a live-update mechanism, while snapshot queries remain authoritative for initial load and reconnect recovery.

## Out of Scope

- Trading strategy, Strategy Registry, Backtester, Evaluator, or Strategy Generator algorithm implementation.
- Binance ingestion, historical-data parsing, Market Data chart rewrite, or News/Sentiment implementation.
- Separate BullMQ worker processes, a cross-process/durable Event Bus, multiple simultaneous Search Loops, microservice extraction, authentication, authorization, or real trading.
- Client-side calculation of signals, trades, evaluation metrics, Leaderboard scores, or Search Loop decisions.
- A separate dynamic Strategy-detail route; detail remains inline or in a side panel for MVP.

## KB Cross-References

- **Modules affected**: Event Infrastructure (primary), Frontend application shell/Dashboard/Leaderboard (primary), Strategy Engine and Market Data (contract integrations).
- **E2E flows affected**: `kb/flows/strategy-backtest.md`, `kb/flows/strategy-search-loop.md`, and `kb/flows/leaderboard-update.md`.
- **Architecture constraints**: Modular Monolith; contract and shared-interface boundaries; Events for notification and side effects; public interfaces for operations requiring a result; REST snapshots plus realtime push; no cross-module implementation imports.
- **Constitution gates**: architecture quality over profitability; contract-first delivery; demonstrable extension points; simple MVP implementation; KB as truth; explicit naming and behavior.
- **Relevant ADRs**: ADR-0005 Event-Driven Communication, ADR-0006 Job Queue/Worker, ADR-0011 Leaderboard as Observer, ADR-0013 BullMQ/Redis Queue (supersedes ADR-0012).
- **Design constraints**: canonical routes, shared 64px dark shell, Dashboard 8/4 desktop layout, responsive single-column mobile behavior, financial numeric typography, semantic trading colors, accessible focus/status/sort states, stable loading/error/stale states.
- **Glossary terms**: Event, Event Bus, Event Envelope, Correlation ID, Job, Worker, BullMQ, Redis, Stalled Job, Retry Policy, Backoff, Dead-letter Queue, Idempotent handler, Leaderboard, Leaderboard Score, Top-K, Search Loop, Search Loop Run, WebSocket Gateway, BFF, Strategy Version, and Reproducibility.

## Brownfield Dependencies and Gates

- `market-data-backend`, `market-data-frontend`, and `news-sentiment-pipeline` have completed task lists and must remain intact.
- Existing Event Infrastructure backend modules and Leaderboard/Strategy pages are skeletons suitable for incremental completion.
- Existing shared code already confirms `getCandlesRange`, `run`, normalized `winRate`, and the canonical event list.
- Planning MUST schedule contract reconciliation before Event Bus or queue implementation that consumes the changed types.
- Planning MUST include test doubles for Strategy Engine capabilities that are not yet implemented so each subfeature remains independently verifiable.
