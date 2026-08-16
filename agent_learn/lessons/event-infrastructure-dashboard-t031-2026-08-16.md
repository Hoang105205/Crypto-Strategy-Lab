# Lessons: Event Infrastructure Dashboard T031 — 2026-08-16

## What Worked

- The reconciled Strategy-owned `IStrategyCandidatePort` lets Loop request one candidate and receive a real immutable `StrategyVersion.id` without importing `SearchEngine`, `StrategyVersioningService`, or Strategy-owned Prisma models.
- Injecting the canonical `ISCORING_POLICY` token through a structural scoring port keeps Loop and Leaderboard on one scoring provider without coupling Loop to Leaderboard implementation files.
- A per-run generation epoch makes pause/stop win while asynchronous generation is pending. Once candidate dispatch reaches its explicit linearization point, it is treated as in-flight work and remains eligible for late-result persistence.
- A single scheduling promise per run prevents duplicate successors, while repository terminal claims remain the authoritative idempotency gate on `(loopRunId, jobId)`.
- Candidate persistence precedes acknowledged queue submission; observational `BacktestRequested` is published only after enqueue succeeds and reuses the producer correlation identity.
- Terminal handling checks user pause/stop before automatic bounds, then maximum candidates, duration, and no-improvement. Improvement requires a score strictly greater than `bestScore + 0.01`.

## What Didn't Work

- The original deferred-enqueue fixture flushed only two microtasks. The required `createRun → materialize → persist candidate → enqueue` path needs one additional microtask before the test can capture the pending enqueue resolver. The fixture wait was corrected without weakening ordering assertions.

## Deviations from Plan

- T031 consumes the reconciled `IStrategyCandidatePort` rather than the older raw `IStrategyGenerator` wording in `tasks.md`; this is the approved contract-gate resolution documented in the Phase 4 guide.
- Module subscriptions and Nest module wiring remain intentionally deferred to T033. T031 exposes terminal handlers but does not subscribe itself.

## KB Updates Needed

- [ ] None identified. The implementation follows the active Search Loop flow, event contract, and accepted Strategy/scoring seams.
