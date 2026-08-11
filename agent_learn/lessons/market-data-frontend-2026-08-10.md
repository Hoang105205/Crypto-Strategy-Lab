# Lessons: market-data-frontend — 2026-08-10

## What Worked
- Self-contained `CandlestickChart` component that calls `useMarketData` internally — the parent just passes `symbol` + `timeframe`, and the chart manages its own data lifecycle (fetch, subscribe, cleanup). Clean separation of concerns.
- lightweight-charts v5 `chart.addSeries(CandlestickSeries, options)` API works as expected — the migration from v4's `chart.addCandlestickSeries()` is a one-line change per series type.
- `series.update(bar)` handles both real-time updates (same `time` → updates last bar) and new candle appends (new `time` → adds bar). No need to distinguish `candle:update` vs `candle:close` at the chart level.
- Tailwind v4 `@theme` CSS custom properties map cleanly to DESIGN.md tokens — `--color-canvas-dark: #0b0e11` becomes `bg-canvas-dark` in JSX.
- `next/font/google` with Inter + JetBrains Mono provides the BinanceNova/BinancePlex font substitutes per DESIGN.md's recommendation.

## What Didn't Work
- Accessing `chartRef.current` during render (passing it to `<ChartOverlay chart={chartRef.current} />`) triggers React 19's `react-hooks/refs` lint rule. Fix: store the chart instance in `useState` instead of `useRef`, so it's available during render.
- Updating `cbRef.current = callbacks` during render triggers the same rule. Fix: wrap in `useEffect(() => { cbRef.current = callbacks; })`.
- Calling `setLoading(true)` synchronously in a `useEffect` triggers `react-hooks/set-state-in-effect`. This is a valid pattern for resetting state on dependency change — suppressed with `eslint-disable-next-line`.
- Unused imports (`UTCTimestamp`, `LinePoint`) in `chart-overlay.tsx` — the types were used implicitly through return types but the explicit imports were flagged. Removed them.

## Deviations from Plan
- `useWebSocket` hook is simpler than planned — it only manages connection status (not a full subscribe/unsubscribe API). The subscription logic lives in `useMarketData` instead, which calls `getSocket()` directly. This avoids a layer of indirection.
- `ChartOverlay` receives the chart instance as a prop (from `useState` in `CandlestickChart`) rather than accessing it via a shared ref. This is cleaner and avoids the ref-during-render lint error.
- `TradeMarkers` is a pure stub (returns `null`) — no "No trade data" text rendered. The component exists for W3 integration but is invisible for now.
- No frontend tests configured (research.md D2 decision — deferred to W3 if needed).
- Nav shell (top-nav-dark) not implemented — out of scope, belongs to Phương's frontend shell task.

## KB Updates Needed
- [ ] Update kb/DESIGN.md: confirm lightweight-charts v5 API (`addSeries(CandlestickSeries, ...)`) and font substitution (Inter + JetBrains Mono) are in use.
- [ ] Update kb/modules/market-data.md: document the frontend consumption pattern (REST + socket.io subscribe + room joining).
- [ ] Update kb/flows/realtime-market-data.md: add a frontend step for socket-level `subscribe` emit (in addition to REST subscribe) — the backend gateway requires this for room joining.
