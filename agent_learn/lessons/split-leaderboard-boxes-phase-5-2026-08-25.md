# Lessons: Split Leaderboard Boxes Phase 5 — 2026-08-25

## What Worked

- Modeling each ranking card as a projection-state renderer kept System and Mine loading, error, stale, empty, retry, timestamp, and scrolling independent without duplicating the table component.
- Passing `sourceScope` through selection and using `scope:strategyVersionId` as the detail render/commit key prevented a same-ID response from an old scope from becoming visible; AbortController remained a transport optimization rather than the only race guard.
- A ranking-column wrapper naturally satisfied both layouts: System and Mine stay vertically stacked on desktop, while the shared detail becomes the adjacent column without changing mobile DOM order.
- Testing the public route as an early middleware return proved anonymous access without weakening the existing session behavior of login/register or unrelated protected routes.

## What Didn't Work

- Vitest again could not resolve its config inside the filesystem sandbox. Zero-test startup failures were excluded from RED/GREEN evidence and approved reruns supplied the real assertion results.
- A first scoped lint pass exposed the middleware's previously named but unused cookie callback argument. Making that no-op callback parameterless preserved behavior and produced a clean Phase 5 lint result.

## Deviations from Plan

- No functional deviation. `middleware.ts` remains in place even though Next.js 16 deprecates that convention in favor of `proxy.ts`; renaming the repository-wide auth boundary is outside T032.
- Dashboard preview production code was not changed. Phase 6 fixtures, Playwright, KB convergence, and release gates remain untouched.

## KB Updates Needed

- [ ] After Phase 6, update the Leaderboard UI/route documentation to describe the public System card, authenticated Mine card, shared criterion/detail, and responsive source order.
- [ ] Reconcile the KB route naming note (`/strategies`) with the accepted feature contract and existing canonical app route (`/strategy`) during the scheduled KB phase.
