# Feature Specification: Market Data Frontend

**Feature**: `market-data-frontend`
**Created**: 2026-08-10
**Status**: Draft
**Input**: User description: "P2 — Frontend charts for the Crypto Strategy Lab dashboard (tasks #8–#13). Implements React hooks and chart components that consume the live Market Data backend (REST + WebSocket) to render real-time candlestick charts, a multi-timeframe grid, technical overlays, and trade markers on the dashboard route (/)."

---

## User Scenarios & Testing

### User Story 1 — View a Live Candlestick Chart (Priority: P1)

A user opens the dashboard (`/`) and sees a candlestick chart for the default trading pair (BTCUSDT) at a default timeframe (5m). The chart loads historical candles first, then updates in real time as new ticks arrive. When a candle closes, a new candle appears on the right edge of the chart.

**Why this priority**: The candlestick chart is the dashboard centerpiece — without it, there is no demo. It is the foundation for all other chart components (#9, #10, #12, #13 all depend on it).

**Independent Test**: Start the backend (`npm run start:dev` from `apps/backend`), start the frontend (`npm run dev` from `apps/frontend`), open `http://localhost:3000`. A candlestick chart should render within 2 seconds and update live.

**Acceptance Scenarios**:
1. **Given** the backend is running and the frontend loads the dashboard, **When** the page finishes mounting, **Then** a candlestick chart renders with up to 500 historical BTCUSDT:5m candles fetched from `GET /api/market-data/candles`.
2. **Given** the chart is showing historical candles, **When** a `candle:update` WebSocket event arrives, **Then** the last (rightmost) candle bar updates its OHLCV values in place without a full re-render.
3. **Given** the chart is showing live data, **When** a `candle:close` event arrives, **Then** a new candle bar appears on the right edge and the chart auto-scrolls to show it.
4. **Given** the chart is rendered, **When** the viewport is resized, **Then** the chart resizes responsively without distortion.

---

### User Story 2 — View Multi-Timeframe Grid (Priority: P1)

A user sees a 2×2 grid of candlestick charts on the dashboard, each showing a different timeframe for the same trading pair (e.g., BTCUSDT at 5m, 15m, 1h, 4h). Each chart panel has its own timeframe selector. Changing one chart's timeframe does not affect the others.

**Why this priority**: The multi-timeframe grid is a core spec requirement (§5) and the primary dashboard layout. It demonstrates the system's ability to manage multiple concurrent WebSocket streams with subscription deduplication.

**Independent Test**: Open the dashboard. Verify 4 chart panels render. Change one panel's timeframe from 5m to 1m. Verify only that panel changes; the other 3 remain unaffected.

**Acceptance Scenarios**:
1. **Given** the dashboard loads, **When** the MultiTimeframeGrid mounts, **Then** 4 chart panels render in a 2×2 grid on desktop (≥1024px), 2×1 on tablet (768–1023px), and 1×1 on mobile (<768px).
2. **Given** 4 charts are showing, **When** the user changes chart #2's timeframe from 15m to 1h, **Then** chart #2 unsubscribes from 15m, subscribes to 1h, fetches historical 1h candles, and resumes live updates. Charts #1, #3, #4 are unaffected.
3. **Given** 4 charts are active, **When** the user navigates away from the dashboard, **Then** all 4 subscriptions are cleaned up (WebSocket `unsubscribe` emitted for each `symbol:timeframe`).

---

### User Story 3 — See Connection Status (Priority: P1)

A user sees a status indicator on the dashboard showing whether the live data connection is active. When the Binance WebSocket disconnects, the indicator shows "Reconnecting...". When it reconnects, the indicator shows "Connected". The indicator never relies on color alone — it always includes text and an icon.

**Why this priority**: Connection status is essential for a real-time trading dashboard. Without it, users can't distinguish between "no new data" and "connection broken." DESIGN.md explicitly requires text + icon, never color alone.

**Independent Test**: Open the dashboard. Stop the backend. Verify the status indicator changes to show a disconnected state with text. Restart the backend. Verify it returns to connected.

**Acceptance Scenarios**:
1. **Given** the dashboard is open and the backend is running, **When** the WebSocket connects, **Then** the StatusIndicator shows "Connected" with a green dot icon.
2. **Given** the dashboard is connected, **When** a `status:disconnected` event arrives, **Then** the StatusIndicator shows "Reconnecting..." with a yellow icon.
3. **Given** the status is "Reconnecting...", **When** a `status:reconnected` event arrives, **Then** the StatusIndicator returns to "Connected" and shows the `lastReconnectAt` timestamp.
4. **Given** the status is "Reconnecting...", **When** no `status:reconnected` arrives (all 3 backend reconnect attempts fail), **Then** the StatusIndicator shows "Connection lost" with a red icon and a retry button.

---

### User Story 4 — Select Trading Pair and Timeframe (Priority: P1)

A user can change the trading pair displayed across all charts in the grid, and change the timeframe of individual chart panels. The pair selector is a global control; the timeframe selector is per-panel.

**Why this priority**: Pair/timeframe selection is the primary user interaction on the dashboard. Without it, the charts are static.

**Independent Test**: Open the dashboard. Change the pair from BTCUSDT to ETHUSDT. Verify all 4 charts switch to ETHUSDT data. Change chart #3's timeframe. Verify only chart #3 changes.

**Acceptance Scenarios**:
1. **Given** the dashboard shows BTCUSDT, **When** the user selects ETHUSDT from the PairSelector, **Then** all 4 charts unsubscribe from BTCUSDT, subscribe to ETHUSDT, and fetch historical ETHUSDT candles.
2. **Given** a chart panel shows 5m, **When** the user selects 1h from the TimeframeSelector, **Then** that chart unsubscribes from 5m, subscribes to 1h, and fetches historical 1h candles.
3. **Given** the user selects an invalid or inactive pair, **When** the subscribe request returns 400, **Then** the chart panel shows an error message: "Invalid symbol or timeframe" and reverts to the previous valid selection.

---

### User Story 5 — Apply Technical Overlays (Priority: P2)

A user can toggle technical analysis overlays on any chart: Moving Average (MA), Bollinger Bands, and Support/Resistance lines. The selected overlay uses the primary accent color; secondary indicators use a muted color. Overlays must not reduce candle contrast.

**Why this priority**: Overlays add analytical value for the demo but are not foundational — the charts work without them. This is W3 polish.

**Independent Test**: Open the dashboard. Click "MA" on chart #1. Verify a moving average line appears over the candles. Click "MA" again. Verify it disappears.

**Acceptance Scenarios**:
1. **Given** a chart is showing candles, **When** the user toggles "MA" on, **Then** a moving average line renders over the candlestick data using the primary accent color.
2. **Given** MA is active, **When** the user toggles "Bollinger Bands" on, **Then** upper and lower band lines render using a secondary/info color, and the MA line remains visible.
3. **Given** overlays are active, **When** new candle data arrives, **Then** the overlay lines recalculate and update in real time.
4. **Given** overlays are active, **When** the user toggles them off, **Then** the overlay lines are removed and the chart returns to candlesticks-only.

---

### User Story 6 — View Trade Markers (Priority: P3, Deferred to W3)

A user sees buy/sell signal markers on the chart at price points where a strategy generated a trade. Markers are small arrows or badges colored by direction (green for buy, red for sell).

**Why this priority**: Trade markers depend on Phương's trade data pipeline (BacktestResult trades), which is not yet implemented. This feature is deferred to W3 and will be stubbed in the initial implementation.

**Independent Test**: Deferred — depends on trade data from the Strategy Engine / Event Infrastructure modules.

**Acceptance Scenarios**:
1. **Given** a chart has historical trade data available, **When** the user enables "Show Trades", **Then** buy markers (green up-arrows) and sell markers (red down-arrows) appear at the corresponding candle positions.
2. **Given** trade markers are displayed, **When** the user hovers over a marker, **Then** a tooltip shows the trade details (price, quantity, signal type).
3. **Given** no trade data is available, **When** the user enables "Show Trades", **Then** the chart shows "No trades for this period" and no markers appear.

---

### Edge Cases

- **Backend not running**: The dashboard shows a loading state, then an error message: "Unable to connect to the server." The status indicator shows "Disconnected." No crash.
- **WebSocket drops mid-session**: The status indicator shows "Reconnecting..." The last successful candle data stays visible (stale state with timestamp). Charts do not blank out.
- **Rate-limited REST (429)**: Historical candle fetch is slow. The chart shows a loading skeleton. Real-time WebSocket updates continue normally.
- **Rapid timeframe switching**: User clicks multiple timeframes in quick succession. Only the last selection takes effect; intermediate requests are cancelled or ignored (no race condition).
- **Empty candle array**: The backend returns `[]` for a brand-new pair with no history. The chart shows "No data available" instead of an empty canvas.
- **Client disconnect (browser close/tab switch)**: All subscriptions are cleaned up. The backend's `handleDisconnect` fires and decrements subscriber counts.

---

## Requirements

### Functional Requirements

- **FR-1**: The dashboard MUST fetch historical candles via `GET /api/market-data/candles?symbol=X&timeframe=Y&limit=500` on initial chart load (flow 5c).
- **FR-2**: The dashboard MUST establish a WebSocket connection to the `/market-data` namespace and emit `subscribe { symbol, timeframe }` to join the per-`symbol:timeframe` room (flow step 1 + gateway deviation note).
- **FR-3**: On receiving a `candle:update` event, the chart MUST update the last (forming) candle bar in place without a full re-render (flow step 10).
- **FR-4**: On receiving a `candle:close` event, the chart MUST append a new candle bar and auto-scroll (flow step 15).
- **FR-5**: The MultiTimeframeGrid MUST render 4 independent chart panels, each with its own timeframe selector (flow 5b).
- **FR-6**: Changing a chart panel's timeframe MUST unsubscribe from the old `symbol:timeframe` and subscribe to the new one (flow 5b).
- **FR-7**: The StatusIndicator MUST display connection state from `status:*` WebSocket events, combining text + icon (never color alone) per DESIGN.md.
- **FR-8**: The PairSelector MUST list pairs from `GET /api/market-data/pairs` and allow switching the global pair across all 4 charts.
- **FR-9**: On receiving a 400 error from subscribe, the chart panel MUST display "Invalid symbol or timeframe" and revert to the previous valid selection (flow 6d).
- **FR-10**: On component unmount or page navigation, the dashboard MUST emit `unsubscribe` for each active `symbol:timeframe` subscription (flow 6c).
- **FR-11**: The ChartOverlay MUST support toggling MA, Bollinger Bands, and Support/Resistance lines per chart panel.
- **FR-12**: Overlays MUST recalculate in real time as new candle data arrives.
- **FR-13** [DEFERRED W3]: TradeMarkers MUST render buy/sell markers from trade data when available. Initial implementation stubs this with "No trade data" placeholder.
- **FR-14**: The dashboard MUST be responsive: 2×2 grid on desktop (≥1024px), 2×1 on tablet (768–1023px), 1×1 on mobile (<768px) per DESIGN.md.
- **FR-15**: The dashboard MUST display prices, volumes, and metrics in a tabular/monospace font (BinancePlex substitute) per DESIGN.md.

### Key Entities

- **Candle**: Normalized OHLCV price bar — `{ symbol, timeframe, openTime, closeTime, open, high, low, close, volume, isClosed }`. Consumed from both REST and WebSocket. Source: `kb/contracts/market-data.yaml`.
- **TradingPair**: `{ symbol, baseAsset, quoteAsset, isActive }`. Consumed from `GET /api/market-data/pairs`. Used to populate the PairSelector.
- **Subscription**: `{ symbol, timeframe, subscribedAt, subscriberCount }`. Consumed from `GET /api/market-data/subscriptions`. Used for the status/debug panel.
- **WebSocketCandlePayload**: `{ symbol, timeframe, candle: { openTime, closeTime, open, high, low, close, volume, isClosed } }`. Received on `candle:update` / `candle:close` events.
- **WebSocketStatusPayload**: `{ connected: boolean, exchange: string, lastReconnectAt: DateTime | null }`. Received on `status:*` events.

---

## Success Criteria

- **SC-1**: The dashboard renders a live candlestick chart within 2 seconds of page load (historical fetch + initial render).
- **SC-2**: Real-time candle updates appear on the chart within 500ms of the WebSocket event arriving.
- **SC-3**: The 2×2 grid layout is correct on desktop, tablet, and mobile breakpoints.
- **SC-4**: Changing a pair or timeframe updates the affected charts without errors or stale data.
- **SC-5**: Connection status is always visible and accurate (text + icon, never color alone).
- **SC-6**: Navigating away from the dashboard cleans up all WebSocket subscriptions (no leaked streams on the backend).
- **SC-7**: Overlays (MA, Bollinger, SR) render correctly over candle data and update in real time.
- **SC-8**: The frontend never calls Binance APIs directly (BR-3) — all data flows through the backend REST + WebSocket.

---

## Assumptions

- The backend Market Data service is running and accessible at `http://localhost:3001` (configurable via `NEXT_PUBLIC_API_URL`).
- The `lightweight-charts` v5 library API is suitable for the chart rendering needs (plan phase will research the v5 API specifics).
- Font substitutes (Inter for BinanceNova, JetBrains Mono for BinancePlex) are acceptable since the proprietary Binance fonts are unavailable. DESIGN.md confirms this substitution.
- The nav shell (top-nav-dark, 64px) is out of scope for this feature — it belongs to Phương's frontend shell task. The dashboard page will render without it for now.
- Task #13 (TradeMarkers) is deferred to W3. The initial implementation creates the component stub with a "No trade data" placeholder.
- Frontend testing uses Jest (not Vitest as ARCHITECTURE.md suggests) — the project currently has no frontend test runner configured. The plan phase will decide: configure Vitest or skip frontend tests for W2.

---

## KB Cross-References

- **Modules affected**: Frontend (primary — all chart components + hooks), Market Data (backend — consuming its REST + WS contracts, already implemented)
- **E2E flows affected**: `kb/flows/realtime-market-data.md` — steps 9–10 (candle:update → chart update), step 15 (candle:close → append), 5b (multi-timeframe grid), 5c (historical load), 6c (client disconnect cleanup), 6d (invalid symbol 400)
- **Architecture constraints**: Modular monolith — frontend communicates with backend exclusively via REST + WebSocket (ARCHITECTURE.md "Communication Patterns"). Frontend never calls Binance directly (BR-3).
- **Constitution gates**: II (Contract-Driven — consume `market-data.yaml` SSoT), IV (Simplicity — YAGNI, no premature optimization), VI (Explicit over implicit — named constants, clear naming)
- **Glossary terms**: Candle, TradingPair, Subscription Deduplication, MarketDataGateway, Auto-Reconnect, WebSocket Gateway
- **Design system**: `kb/DESIGN.md` — Dashboard route spec (§"Dashboard — /"), component tokens (CandlestickChart, MultiTimeframeGrid, ChartOverlay, StatusIndicator, PairSelector, TimeframeSelector), color tokens (canvas-dark, primary, trading-up/down), typography (BinancePlex for numbers), responsive rules (2×2 → 2×1 → 1×1), shared UI states (LoadingState, ErrorBoundary, stale state)
- **ADRs**: ADR-0003 (plugin architecture — frontend components should be composable/extensible), ADR-0007 (auto-reconnect — frontend must handle status:disconnected/reconnected)
- **Backend deviation note**: The gateway requires socket clients to emit `subscribe { symbol, timeframe }` to join rooms (not just REST subscribe). See `agent_learn/lessons/market-data-backend-2026-08-10.md` "Deviations from Plan".
