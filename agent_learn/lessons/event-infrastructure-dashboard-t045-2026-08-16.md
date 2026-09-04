# Event Infrastructure Dashboard T045 - 2026-08-16

## What worked

- Keeping `LeaderboardTable` prop-driven made realtime replacement a normal rerender: backend order remains authoritative while `sortBy` and `selectedStrategyVersionId` remain client-owned.
- Reusing the T040 typed API client kept ISO strings out of the component model and preserved stable HTTP status/code/message behavior for safe 404/503 presentation.
- The lightweight-charts v5 seam is a primitive lifecycle, not a series method: create once per series, call `setMarkers` for published trade changes, and `detach` on series replacement/unmount.
- A chart extension point can preserve Market Data ownership by accepting optional published `Trade[]` and exposing the already-created candlestick series without changing `useMarketData` or candle callbacks.
- React 19 lint correctly rejected reading `seriesRef.current` during render. Mirroring the externally created series into state gave the marker child a render-safe value while the ref continued to serve high-frequency candle callbacks.

## Adjustment made during implementation

- Shared Leaderboard entries are flat contract projections; they do not contain a nested `metrics` object. Formatting was aligned to the real shared type: return/drawdown are already percentage values, while only normalized `winRate` is multiplied by 100 for display.
- The detail component carries the requested Strategy Version ID in its state so an older response cannot become visible after selection changes, without synchronous setState calls inside an effect.
- Local Vitest does not resolve the `@/` alias used by Next, so the detail module uses the repository's established relative-import convention.

## Reusable lesson

When combining React with an imperative chart library, keep update refs for imperative callbacks but pass child-visible plugin ownership through React state. At contract boundaries, distinguish normalized rates from already-percent financial metrics; multiplying both produces plausible-looking but incorrect UI values.

## Validation limitation

- Targeted lint, TypeScript, all 45 frontend tests, T044's 11 tests, the available Market Data composition regression, and the Next 16 production build pass.
- Full frontend lint remains red only in pre-existing Strategy/News files outside T045 scope.
- No installed browser harness was available for honest manual viewport/keyboard/live-reconnect validation, so T045 was intentionally left unchecked.

## KB updates needed

- [ ] No KB contract update is required; implementation follows the active Leaderboard, Strategy/Trade, Dashboard realtime, responsive, and chart-library decisions.

## Browser follow-up - 2026-08-17

- A dedicated production-server port avoids silently reusing a developer's stale Next process on port 3000.
- On Windows, Playwright `webServer` launched through npm/cmd can leave child processes waiting during teardown. A PowerShell runner with owned PIDs and `try/finally` made build/server/browser execution repeatable and cleanup explicit.
- Cross-origin typed GET requests with `Content-Type: application/json` require a valid OPTIONS response in Playwright route mocks; mock the browser boundary, including CORS, rather than assuming jsdom fetch behavior.
- Vitest and Playwright both collect `*.spec.ts` by default. Assign explicit directory ownership (`e2e/**` excluded from Vitest) so the unit runner never imports Playwright's global `test()`.
- A minimal real Socket.IO namespace fixture is more meaningful than starting disconnected: it proves Connected -> offline stale retention -> reconnect refetch -> Connected in Chromium while REST snapshots remain deterministic.

## All-green completion follow-up - 2026-08-17

- A full-feature checkpoint can remain blocked by lint outside the task's production files; fixing it requires explicit owner/user authorization rather than suppressing rules or silently broadening scope.
- Write-only duplicated React state should be removed instead of retained merely to mirror the authoritative selected object. This reduces renders and removes competing state ownership.
- For client-side initial loading, keep the async loader free of React state mutation and apply the resolved value in an asynchronous completion with an unmount guard. This satisfies React 19 effect rules without hiding the rule.
- Prop-to-local-state effect mirroring is avoidable when component identity defines the reset boundary. Keying `ParameterEditor` by Strategy identity preserves local editing while making selection changes explicit.
- Replacing `any` with an `unknown` guard exposed a natural place to bound recursive composite traversal with a visited set, preventing malformed cyclic graphs from recursing indefinitely.
- The completed gate is full ESLint, TypeScript, 14/14 Vitest files (47/47 tests), an 8-route Next production build, and 4/4 Chromium scenarios with owned-port cleanup.
