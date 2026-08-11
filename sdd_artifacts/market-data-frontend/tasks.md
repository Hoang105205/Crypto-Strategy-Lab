# Tasks: Market Data Frontend

**Input**: spec.md, plan.md, research.md, data-model.md, contracts/frontend-api.md, quickstart.md
**Prerequisites**: Backend market-data service running (REST + WS live on port 3001)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6 from spec.md)

---

## Phase 0: Setup

**Purpose**: Tailwind theme, fonts, constants — everything the components import

- [X] **T0.1** Configure Tailwind v4 `@theme` in `apps/frontend/src/app/globals.css` — map DESIGN.md color tokens (canvas-dark `#0b0e11`, surface-card `#1e2329`, surface-elevated `#2b3139`, primary `#fcd535`, primary-active `#f0b90b`, body `#eaecef`, muted `#707a8a`, trading-up `#0ecb81`, trading-down `#f6465d`, info `#3b82f6`, hairline-dark `#2b3139`) and font families (`--font-sans`, `--font-mono`). See research.md D5.
- [X] **T0.2** Set up fonts in `apps/frontend/src/app/layout.tsx` — replace Geist with Inter + JetBrains Mono via `next/font/google`. Map CSS variables `--font-sans` and `--font-mono`. See research.md D3.
- [X] **T0.3** [P] Create `apps/frontend/src/lib/constants.ts` — export `API_BASE_URL` (from `NEXT_PUBLIC_API_URL` env), `WS_NAMESPACE` (`/market-data`), `TIMEFRAMES` array (`['1m','5m','15m','30m','1h','2h','4h','1d']`), `DEFAULT_PAIR` (`'BTCUSDT'`), `DEFAULT_GRID_TIMEFRAMES` (`['5m','15m','1h','4h']`), `CANDLE_LIMIT` (`500`), `WS_EVENTS` object (`{ candleUpdate: 'candle:update', candleClose: 'candle:close', statusConnected: 'status:connected', statusDisconnected: 'status:disconnected', statusReconnected: 'status:reconnected' }`), `COLORS` object (hex values from DESIGN.md).
- [X] **T0.4** [P] Create `apps/frontend/.env` with `NEXT_PUBLIC_API_URL=http://localhost:3001`.

---

## Phase 1: Foundation (Hooks + Services)

**Purpose**: The data layer that all chart components depend on. MUST complete before any UI work.

**⚠️ CRITICAL**: No component can be built until the hooks and services are in place.

- [X] **T1.1** Create `apps/frontend/src/services/api-client.ts` — typed fetch wrappers: `getCandles(symbol, timeframe, limit)`, `getPairs()`, `getSubscriptions()`, `subscribe(symbol, timeframe)`, `unsubscribe(symbol, timeframe)`. All hit `API_BASE_URL + '/api/market-data/...'`. Parse JSON, throw on non-2xx with the `{ error: string }` body. See contracts/frontend-api.md.
- [X] **T1.2** [P] Create `apps/frontend/src/services/socket-client.ts` — singleton `io(API_BASE_URL + WS_NAMESPACE)` from `socket.io-client`. Export `getSocket()` that lazily creates the connection and caches it. Type the emitted/listened events.
- [X] **T1.3** Create `apps/frontend/src/hooks/use-websocket.ts` — React hook that manages the socket connection lifecycle. Returns `{ socket, status, lastReconnectAt }`. Listens to `status:connected`, `status:disconnected`, `status:reconnected` events and updates state. Exposes a `subscribe(symbol, timeframe, onUpdate, onClose)` function that: emits `subscribe` over socket, registers `candle:update`/`candle:close` callbacks filtered by `symbol:timeframe`, and returns a cleanup function that emits `unsubscribe` and deregisters callbacks. See research.md D6.
- [X] **T1.4** Create `apps/frontend/src/hooks/use-market-data.ts` — React hook for a single chart panel. Accepts `{ symbol, timeframe }`. On mount/change: calls `apiClient.getCandles()` for historical data, calls `apiClient.subscribe()` (REST), calls `useWebSocket().subscribe()` (socket room join). Returns `{ candles, loading, error }`. On unmount: calls both unsubscribe paths. See contracts/frontend-api.md, research.md D6.
- [X] **T1.5** Verify: `npx tsc --noEmit` passes for `apps/frontend`. `next build` compiles. Fix any type errors.

**Checkpoint**: Foundation ready — chart components can now be built.

---

## Phase 2: Core Chart (US1 — Live Candlestick Chart) 🎯 MVP

**Goal**: A single candlestick chart that loads historical data and updates in real time.
**Independent Test**: quickstart.md Scenario 1 (single chart, live updates)

- [X] **T2.1** Create `apps/frontend/src/components/chart/candlestick-chart.tsx` — React component wrapping lightweight-charts v5. Props: `{ symbol, timeframe, candles, onCandleUpdate, onCandleClose }`. Creates `IChartApi` via `createChart(container, options)` in a `useRef`+`useEffect`. Adds `CandlestickSeries` via `chart.addSeries(CandlestickSeries, { upColor, downColor, borderVisible: false })`. Maps `Candle` → `{ time: epochSeconds, open, high, low, close }` via `data-model.md` ChartBar mapping. Calls `series.setData()` on initial candles. See research.md D1.
- [X] **T2.2** Wire real-time updates in `candlestick-chart.tsx` — expose an imperative handle (via `useImperativeHandle` or a ref callback) that calls `series.update(bar)` when the parent passes a new/updated candle. Both `candle:update` and `candle:close` call `series.update()` — the library handles update-vs-append by comparing `time` values. See research.md D1.
- [X] **T2.3** Add responsive resize in `candlestick-chart.tsx` — use `ResizeObserver` on the container div to call `chart.applyOptions({ width: container.clientWidth })` on resize. Clean up the observer on unmount. Also call `chart.timeScale().fitContent()` after initial `setData()`.
- [X] **T2.4** Manual smoke test: render a single `CandlestickChart` in `page.tsx` with BTCUSDT:5m. Verify historical candles render, live updates work, resize works. See quickstart.md Scenario 1.

**Checkpoint**: Single chart works end-to-end with live Binance data.

---

## Phase 3: Selectors + Status (US3, US4)

**Goal**: User controls for pair/timeframe + connection status display.

- [X] **T3.1** [P] Create `apps/frontend/src/components/pair-selector.tsx` — dropdown populated from `apiClient.getPairs()`. Props: `{ value, onChange }`. Renders pairs as `baseAsset/quoteAsset` labels. Styled per DESIGN.md (surface-card-dark background, primary accent on focus). Filter to `isActive: true` pairs only.
- [X] **T3.2** [P] Create `apps/frontend/src/components/timeframe-selector.tsx` — dropdown with `TIMEFRAMES` from constants. Props: `{ value, onChange }`. Compact design for per-panel use. Styled per DESIGN.md (surface-card-dark, small padding).
- [X] **T3.3** [P] Create `apps/frontend/src/components/status-indicator.tsx` — listens to `useWebSocket().status`. Shows text + icon dot (never color alone per DESIGN.md). States: connected (green dot + "Connected"), reconnecting (yellow dot + "Reconnecting..."), disconnected (red dot + "Connection lost"). Shows `lastReconnectAt` timestamp when reconnected.

**Checkpoint**: Selectors and status indicator ready for dashboard composition.

---

## Phase 4: Dashboard Grid (US2 — Multi-Timeframe Grid)

**Goal**: The 2×2 grid dashboard page.

- [X] **T4.1** Create `apps/frontend/src/components/chart/multi-timeframe-grid.tsx` — renders 4 `CandlestickChart` panels. Props: `{ pair, onPairChange }`. Each panel has its own `TimeframeSelector` and manages its own `useMarketData` hook. Default timeframes: `['5m', '15m', '1h', '4h']`. Responsive: `grid-cols-1 md:grid-cols-2` (1 col mobile, 2 col tablet+). Per DESIGN.md: `surface-card-dark` cards, `rounded-xl`, `spacing-md` gaps, `spacing-md` internal padding.
- [X] **T4.2** Rewrite `apps/frontend/src/app/page.tsx` — compose `PairSelector` (global), `StatusIndicator`, and `MultiTimeframeGrid`. Manage global pair state with `useState`. Pass pair to grid; pass `onPairChange` to PairSelector. Layout: header row (pair selector + status), then grid below. Background: `canvas-dark`. Per DESIGN.md Dashboard route spec (8/4 split — but for W2, full-width grid is acceptable; 8/4 split needs LoopStatusPanel which is Phương's task).
- [X] **T4.3** Manual smoke test: open `http://localhost:3000`. Verify 2×2 grid renders, pair switch works, per-panel timeframe switch works, subscriptions clean up on navigation. See quickstart.md Scenarios 1–3, 6–7.

**Checkpoint**: Full dashboard works with live data, pair switching, timeframe switching.

---

## Phase 5: Overlays (US5 — Technical Analysis)

**Goal**: MA, Bollinger Bands, Support/Resistance overlays.

- [X] **T5.1** [P] Create `apps/frontend/src/lib/indicators.ts` — pure functions: `sma(candles, period)` → `Array<{ time, value }>`, `bollingerBands(candles, period, stdDev)` → `{ upper, middle, lower }` arrays, `supportResistance(candles, lookback)` → `{ support, resistance }` price levels. All return data in `{ time: epochSeconds, value: number }` format for `LineSeries.setData()`.
- [X] **T5.2** Create `apps/frontend/src/components/chart/chart-overlay.tsx` — toggle buttons (MA, Bollinger, SR) per chart panel. When toggled on, adds `LineSeries` to the chart via `chart.addSeries(LineSeries, options)`. MA: primary color `#fcd535`. Bollinger: info color `#3b82f6` (upper/lower) + muted `#707a8a` (middle). SR: muted-strong `#929aa5` (horizontal lines). Recalculates on candle updates by calling indicator functions and `series.setData()`. Props: `{ chart, candles, activeOverlays, onToggle }`.
- [X] **T5.3** Manual smoke test: toggle MA on chart #1, verify line appears. Toggle Bollinger, verify bands. Toggle off, verify lines removed. See quickstart.md (overlay validation).

**Checkpoint**: Overlays render and update in real time.

---

## Phase 6: Deferred (US6 — Trade Markers Stub)

**Goal**: Component stub for W3 integration.

- [X] **T6.1** Create `apps/frontend/src/components/chart/trade-markers.tsx` — stub component that renders "No trade data available" placeholder text. Props: `{ symbol, timeframe }`. No markers rendered. Real implementation deferred to W3 when Phương's trade data pipeline (BacktestResult trades) is available. Note in component JSDoc: "TODO W3: integrate with BacktestResult.trades from Strategy Engine."

---

## Phase 7: Polish & Validation

**Purpose**: Final quality gate before the feature is demo-ready.

- [X] **T7.1** Run `npx eslint "src/**/*.ts" "src/**/*.tsx" --fix` from `apps/frontend`. Resolve all errors.
- [X] **T7.2** Run `npx tsc --noEmit` from `apps/frontend`. Must be clean.
- [X] **T7.3** Run `next build`. Must compile successfully.
- [X] **T7.4** Run all quickstart.md validation scenarios (1–7). Document pass/fail.
- [X] **T7.5** Update `Hoang_planning_implemention.md` — mark tasks #8–#13 as ✅ Done with dates.
- [X] **T7.6** Write `sdd_artifacts/market-data-frontend/note.md` — release checklist: env setup, known limitations (TradeMarkers deferred, no frontend tests, nav shell not included), teammate coordination notes.

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 0 (Setup)**: No dependencies — start immediately
- **Phase 1 (Foundation)**: Depends on Phase 0 — BLOCKS all UI work
- **Phase 2 (Core Chart)**: Depends on Phase 1 — MVP checkpoint
- **Phase 3 (Selectors + Status)**: Depends on Phase 1 — can run in parallel with Phase 2
- **Phase 4 (Dashboard Grid)**: Depends on Phase 2 + Phase 3
- **Phase 5 (Overlays)**: Depends on Phase 2 (needs chart instance)
- **Phase 6 (Trade Markers)**: Depends on Phase 2 (needs chart component) — stub only
- **Phase 7 (Polish)**: Depends on all above

### Parallel Opportunities
- T0.3 + T0.4 can run in parallel (different files)
- T1.1 + T1.2 can run in parallel (different files)
- T3.1 + T3.2 + T3.3 can all run in parallel (different files)
- T5.1 can run in parallel with Phase 3/4 (pure functions, no dependencies)

### Execution Strategy
1. Phase 0 → Phase 1 → Phase 2 (MVP: single chart with live data)
2. Phase 3 (in parallel with Phase 2 if desired)
3. Phase 4 (compose everything into the dashboard)
4. Phase 5 (overlays — W3 polish)
5. Phase 6 (stub — quick)
6. Phase 7 (validate + document)
