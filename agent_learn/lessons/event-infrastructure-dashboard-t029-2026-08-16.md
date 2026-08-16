# Lessons: Event Infrastructure Dashboard T029 — 2026-08-16

## What Worked

- Dynamic target loading keeps the test files compilable before `StrategyLoopService`, `LoopController`, and `loop.dto.ts` exist. The targeted run is intentionally RED only at the two missing production targets; the behavior matrix remains pending until T031/T032 provide those symbols.
- The orchestration contract makes the durable boundary observable: Loop owns a UUID `jobId`, reuses one `correlationId`, awaits `IJobQueue.enqueue`, and only then publishes `BacktestRequested`. Queue rejection can therefore never produce a false observational event.
- Stateful terminal fixtures distinguish persistence from continuation. Late or duplicate results are still offered to the repository by `(loopRunId, jobId)`, but paused/terminal runs and `applied: false` results cannot emit progress or generate a successor.
- Supertest locks all success statuses and stable error codes from `loop-api.md`, including sanitized dependency failures and UUID validation that does not invoke repository reads.

## What Didn't Work

- The first contract-gate audit used a greedy regular expression and accidentally matched `strategyVersionId` in the following `IStrategyExecutionPort`. Slicing only the `IStrategyGenerator` declaration fixed the fixture; the validated RED run then contained exactly the two intended missing-target failures.

## Deviations from Plan

- The test-facing generator seam returns `{ strategyVersionId, strategyName }` instead of pretending the existing `IStrategyGenerator.generate(): IStrategy[]` is sufficient. This is an explicit blocker/assumption, not a contract change or production implementation.
- Loop scoring is represented as an injected policy seam because `BacktestCompleted` carries metrics but no score. T031 must reuse the Leaderboard scoring policy (or a shared exported interface/token) rather than copy the formula.
- The controller suite uses the existing Nest/Supertest and stable `{ error, code }` patterns and expects `loop.dto.ts` to own boundary normalization. No DTO, controller, service, shared contract, schema, Strategy, Queue, or Leaderboard production file was added or modified in T029.

## KB Updates Needed

- [ ] Reconcile before T031: Strategy generation must materialize and return an immutable Strategy-owned `StrategyVersion.id` before Loop can enqueue a backtest.
- [ ] Reconcile before T031: expose one shared scoring-policy interface/token so Loop and Leaderboard cannot drift.
- [ ] Reconcile before T031: align the `ISTRATEGY_GENERATOR` contract (`generate(count)`) with the `SearchEngine` facade (`generateCandidates(count, type)`) while preserving RANDOM/DOMAIN_GUIDED selection through a Strategy-owned boundary.
