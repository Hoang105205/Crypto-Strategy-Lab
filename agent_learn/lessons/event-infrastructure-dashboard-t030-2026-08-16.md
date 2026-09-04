# Lessons: Event Infrastructure Dashboard T030 — 2026-08-16

## What Worked

- A FIFO promise mutex around `createRun()` serializes start attempts inside the approved one-Nest-process topology. The active `RUNNING`/`PAUSED` lookup is still repeated inside the interactive Prisma transaction, so check and create remain one database unit.
- Candidate completion/failure uses a conditional `updateMany` claim from `BACKTESTING` to a terminal status. Only the transaction whose claim count is one increments `testedCandidates`; duplicate or racing deliveries return `applied: false` with current state.
- Terminal candidate accounting intentionally does not constrain the owning run status. This preserves late results for paused and terminal runs without reopening or otherwise changing the run.
- The lifecycle service validates the current status before every conditional transition and treats a transition miss as `INVALID_LOOP_TRANSITION`, covering both explicitly illegal calls and races after the initial read.
- Restart reconciliation keeps active state for queue projections `QUEUED` and `PROCESSING`, converts only missing/unrecoverable work to `FAILED/orphaned_after_restart`, and propagates dependency unavailability unchanged for a later retry.

## What Didn't Work

- The first ownership-audit command used a negative look-ahead unsupported by default ripgrep. Listing every `prisma.` and transaction access directly produced clearer evidence: only `searchLoopRun`, `searchLoopCandidate`, and `$transaction` are used.

## Deviations from Plan

- None. T030 adds only `loop.repository.ts` and `loop-status.service.ts`; no Strategy Loop orchestration, controller, DTO, module wiring, shared contract, Prisma schema, or T029 test was changed.

## KB Updates Needed

- [ ] None identified. The implementation follows research D10/D11 and the existing Search Loop data ownership/restart rules without changing them.
