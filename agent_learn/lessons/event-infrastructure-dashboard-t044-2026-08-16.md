# Event Infrastructure Dashboard T044 - 2026-08-16

## What worked

- Runtime module paths let all missing table/detail contracts collect independently, producing eight actionable RED failures instead of one transform-time stop.
- Keeping the table prop-driven separates presentation from the T040 hook: the table emits exact ranking criteria while `sortBy` and selected Strategy Version remain explicit client-owned inputs across realtime rerenders.
- Mocking `fetch` for detail tests exercises the real typed API client path and ISO decoding while still avoiding a network dependency.
- Reading the installed lightweight-charts v5 declarations established the correct marker seam: `createSeriesMarkers`, `setMarkers`, and `detach`, not the removed `series.setMarkers` API described by the old stub comment.
- A deliberately inconsistent price delta and published P&L fixture makes accidental frontend P&L recomputation observable.
- DOM/class contracts cover mobile horizontal scrolling without pretending jsdom measures viewport pixels.

## Adjustment made during implementation

- The initial sort test checked only `winRate`. It was expanded to exercise all five UI-label-to-API-criterion mappings so T045 cannot silently send display labels or stale aliases to the hook.
- RED and static gates were run separately after the expected failing test command, ensuring a non-zero RED exit did not hide lint or TypeScript results.

## Reusable lesson

For chart-plugin tests, inspect the installed library declarations and test the smallest lifecycle boundary directly. For financial tables, keep backend ordering and client preference state outside the table, but lock formatting conversions at the presentation boundary—especially normalized rates, signed percentages, and accessible direction labels.

## KB updates needed

- [ ] No KB update is required; the tests implement existing Leaderboard, Strategy Version, Trade, responsive, and lightweight-charts v5 decisions without introducing a new architecture contract.
