# Lessons: Per-user Leaderboard Live Toggle Phase 2 — 2026-08-23

## What Worked

- A single nullable-viewer Prisma predicate kept anonymous, user A and user B behavior symmetric and reviewable.
- Filtering before best-per-version, sorting, Top-K and `updatedAt` prevented both row leakage and metadata side channels.
- Recomputing ranks only on the returned projection produced contiguous `1..N` without changing the existing persisted global-rank compatibility path.
- Detail selection from the same visible ranked projection made a foreign existing identifier indistinguishable from a nonexistent identifier before crossing the Strategy result port.
- Dashboard tests explicitly proved the ownership boundary: viewer identity reaches only Leaderboard, while Loop and Queue remain zero-argument global reads.

## What Didn't Work

- Isolated integration modules initially failed after importing AuthModule because their test root did not provide AppModule's global ConfigService to SupabaseService.
- Legacy repository expectations asserted persisted ranks and unscoped Prisma calls, so they needed to be updated to the approved view-local rank and optional-auth semantics.

## Deviations from Plan

- Integration harnesses override SupabaseService and SupabaseJwtGuard with deterministic local fakes. This keeps tests independent of Supabase network access while exercising real controller metadata and module wiring.
- Persisted `rerank()` remains global for backward compatibility; public list/detail ranks are recomputed from the viewer-visible projection. No per-user rank storage or migration was introduced.

## KB Updates Needed

- [ ] Update `kb/flows/leaderboard-update.md` after feature approval to show viewer filtering before Top-K/rank/updatedAt.
- [ ] Update `kb/modules/event-infrastructure.md` after feature approval with optional-auth Leaderboard and Dashboard read signatures.
- [ ] Keep the existing follow-up to reconcile stale `kb/flows/strategy-search-loop.md`; SearchLoopRun remains global.
- [ ] No new ADR is needed; Phase 2 implements ADR-0016 and existing auth/event contracts.

