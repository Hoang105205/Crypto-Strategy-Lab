# Lessons: Split Leaderboard Boxes Phase 4 — 2026-08-25

## What Worked

- Treating `(viewerKey, scope, criterion)` as the effective key let snapshots, controllers, generations, watermarks, and status metadata share one privacy-safe projection model.
- Keeping Combined SCORE permanently maintained while requiring an explicit provider-owned opt-in for full-page System/Mine reads preserved Dashboard request cost and prevented route components from becoming realtime owners.
- Sequential provider RED waves made cache/projection, realtime/listener, and identity/selection failures independently attributable before the provider rewrite.
- Exact-viewer v2 persistence plus identity-generation checks rejected delayed responses even when an aborted promise still resolved.
- Projection-owned retry functions made independent System/Mine status natural and let Dashboard consume only the Combined projection.

## What Didn't Work

- Criterion-only v1 regression fixtures contradicted the new no-migration contract and had to be rewritten as valid v2 fixtures or explicit v1-rejection tests.
- Initial ESLint validation rejected helper-mediated callbacks that close over refs as possible render-time ref access; constructing memoized projection view objects directly removed the ambiguity.
- Vitest intermittently could not read `vitest.config.ts` inside the filesystem sandbox. Approved reruns were required; startup failures were not counted as RED test evidence.
- An anonymous persistence expectation initially included Mine, which contradicted the required Mine HTTP short-circuit. The authenticated cache-uniqueness test remains the evidence for all three keys.

## Deviations from Plan

- No functional deviation. Transitional legacy aliases remain on the provider/hook only to keep the existing one-table page and older consumer fixtures type-safe until their scheduled Phase 5 migration; authoritative state is the new projection surface.
- `LeaderboardPreview` production code required no change; T022 added regression coverage only, as planned.

## KB Updates Needed

- [ ] Update `kb/modules/event-infrastructure.md` after the two-card route and E2E validation are complete, documenting the final scoped provider ownership without changing socket topology.
- [ ] Update `kb/flows/leaderboard-update.md` after Phase 6 to document maintained scoped REST reconciliation after system-safe invalidation.
- [ ] No new ADR is needed; the implementation follows ADR-0011 single-provider ownership and ADR-0016 server-authorized REST scope.
