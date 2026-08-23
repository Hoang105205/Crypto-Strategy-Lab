# Lessons: Per-user Leaderboard Live Toggle Phase 1 — 2026-08-23

## What Worked

- Source-reading contract assertions provided deterministic RED evidence even though the Jest transformer did not report TypeScript `satisfies` errors.
- Treating nullable `userId` as immutable request identity prevented an idempotent `jobId` replay from silently crossing ownership boundaries.
- The same explicit value flowed through `BacktestRequested -> BacktestResult -> BacktestCompleted`: a USER UUID stayed a UUID and SEARCH_LOOP stayed `null`.
- Running the final worker gate with real Redis preserved the existing BullMQ retry/non-retryable integration coverage.

## What Didn't Work

- Type-only assertions initially appeared GREEN because Jest transpiled the specs without diagnostics.
- The first full gate failed before behavior validation because the declared Supabase package was absent from `node_modules`, Redis was stopped, and Prisma Client was stale relative to the existing schema.

## Deviations from Plan

- Added `userId: entry.userId` to the existing leaderboard payload mapper so the backend could compile after the shared field became required. This was minimum contract-consumer alignment only; Phase 2 viewer scoping was not started.
- Repaired the Strategy controller test harness to supply its current execution-port dependency and a valid two-child composite fixture. No production controller or auth semantics changed.
- Restored declared dependencies, regenerated Prisma Client, and started the existing Redis service. No dependency manifest, schema, or migration was changed.

## KB Updates Needed

- [ ] Reconcile `kb/flows/strategy-search-loop.md` with the 2026-08-18 decision in the later documentation/handoff phase; keep SearchLoopRun global.
- [ ] Reconcile older module/design text that still describes user command controls for the system search loop.
- [ ] No new ADR is needed for Phase 1; the contract follows ADR-0016 and the approved feature artifacts.

