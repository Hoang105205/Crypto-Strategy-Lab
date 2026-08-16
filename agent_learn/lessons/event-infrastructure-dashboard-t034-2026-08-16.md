# Event Infrastructure Dashboard T034 - 2026-08-16

## What worked

- Booting the production `LoopModule`, production Loop services, and production `EventBus` while replacing dependencies only at their public tokens exercised real orchestration without live domain or infrastructure services.
- A stateful Prisma fake implementing only Loop-owned delegates and `$transaction` made persistence, ordering, idempotency, concurrent start, and restart behavior observable without crossing the module boundary.
- Publishing terminal events through `IEVENT_BUS` verified the real subscription path. Polling observable state avoided coupling tests to internal scheduling details.
- Seeding an active run before `app.init()` made startup reconciliation deterministic for `QUEUED`, `PROCESSING`, `JOB_NOT_FOUND`, and `QUEUE_UNAVAILABLE`.
- The `maxCandidates=5` scenario asserted five terminal rows, five queue requests, five `BacktestRequested` events, and explicitly checked that no sixth request appeared.

## What did not work initially

- The first harness instantiated placeholder fake providers before their class declarations and failed with `ReferenceError: Cannot access 'ContractJobQueueFake' before initialization`. Moving placeholder modules below the fake classes fixed the harness-order error before behavior evidence was accepted.
- The first Events/Queue/Leaderboard regression run failed because Redis and Docker Desktop were not running. After starting Docker Desktop and the repository Redis 7 Compose service, the unchanged command passed 18 suites and 151 tests. This was an environment prerequisite failure, not a Loop behavior failure.

## Boundary decisions

- No production source was changed for T034. The new source file is an integration specification; the other edits are validation and learning metadata.
- The test uses no live Binance, sentiment, or frontend dependency.
- Generator/version and queue dependencies are contract fakes provided through `ISTRATEGY_CANDIDATE_PORT` and `IJOB_QUEUE`; production `ScoringPolicy` remains behind `ISCORING_POLICY`.
- Generator replaceability is proven by overriding only `ISTRATEGY_CANDIDATE_PORT`; `StrategyLoopService` remains the production provider.
- The stateful isolated Prisma fake was selected instead of a test database, as allowed by T034, and exposes only `searchLoopRun`, `searchLoopCandidate`, and `$transaction` behavior used by production Loop persistence.

## Reusable lesson

An orchestration integration checkpoint is strongest when it boots the production module and event transport, replaces external edges only through public tokens, and drives results through the runtime event boundary. Record prerequisite failures separately, rerun the identical command after restoring the dependency, and claim PASS only from the clean rerun.

## KB impact

No KB update is required. T034 validates accepted module ownership and public seams without changing architecture or contracts.
