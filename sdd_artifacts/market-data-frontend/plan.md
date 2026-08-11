# Implementation Plan: Market Data Frontend

**Feature**: `market-data-frontend` | **Date**: 2026-08-10 | **Spec**: spec.md

## Summary

Implements the frontend chart components that consume the live Market Data backend (REST + WebSocket). The dashboard (`/`) shows a 2×2 grid of real-time candlestick charts with pair/timeframe selectors, connection status indicator, and technical overlays. Built on Next.js 16 (App Router), React 19, lightweight-charts v5, socket.io-client v4, and Tailwind CSS v4.

## Technical Context

| Aspect | Value |
|---|---|
| **Language** | TypeScript 5.x (strict, `isolatedModules`) |
| **Framework** | Next.js 16.3.0 (App Router, React 19.2.8) |
| **Chart library** | lightweight-charts 5.2.0 (TradingView) |
| **WebSocket client** | socket.io-client 4.8.0 |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/postcss`) |
| **Shared types** | `@crypto-strategy-lab/shared` (Candle, TradingPair, Subscription, EventType) |
| **Testing** | Deferred to plan decision D2 — no frontend test runner configured yet |
| **Backend URL** | `NEXT_PUBLIC_API_URL` env var (default `http://localhost:3001`) |
| **WS namespace** | `/market-data` |
| **Constraints** | BR-3 (frontend never calls Binance directly), Constitution II (contract-driven), IV (simplicity) |

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Architecture Quality | ✅ PASS | Components follow DESIGN.md token system; composable/extensible (ADR-0003) |
| II. Contract-Driven | ✅ PASS | Frontend consumes `kb/contracts/market-data.yaml` SSoT — no Binance calls |
| III. Extension Points | ✅ PASS | ChartOverlay pluggable (new overlay type = new component); grid panels are independent |
| IV. Simplicity | ✅ PASS | YAGNI — no state management library (React hooks + context suffice for W2) |
| V. KB as Truth | ✅ PASS | DESIGN.md specifies exact colors, typography, responsive rules |
| VI. Explicit Over Implicit | ✅ PASS | Named constants for timeframes, colors, event names |

## Architecture Decision

**Approach**: Frontend module addition — new hooks, components, and services in `apps/frontend/src/`. No new backend modules. Consumes the existing Market Data backend via REST + WebSocket.

**Rationale**: The backend is complete and live. The frontend is a pure consumer — it adds no new APIs or data models, only renders data from existing contracts. This aligns with the modular monolith architecture (ARCHITECTURE.md "Communication Patterns": client → server via REST + WS).

**Modules affected**: Frontend (primary). Market Data (backend — read-only consumption, no changes).

**E2E flows affected**: `kb/flows/realtime-market-data.md` — frontend participates in steps 9–10 (candle:update → chart), 15 (candle:close → append), 5b (multi-timeframe grid), 5c (historical load), 6c (client disconnect cleanup).

**New modules needed**: None.

## Source Code Structure

```
apps/frontend/src/
├── app/
│   ├── layout.tsx          # (existing — add font + theme)
│   ├── page.tsx            # REWRITE — dashboard with grid + selectors
│   └── globals.css         # (existing — add @theme tokens)
├── hooks/
│   ├── use-market-data.ts  # NEW — REST candle fetching + subscription management
│   └── use-websocket.ts    # NEW — socket.io connection + event dispatch
├── components/
│   ├── chart/
│   │   ├── candlestick-chart.tsx     # NEW — lightweight-charts v5 wrapper
│   │   ├── chart-overlay.tsx         # NEW — MA, Bollinger, SR toggle + render
│   │   ├── trade-markers.tsx         # NEW (stub) — W3 deferred
│   │   └── multi-timeframe-grid.tsx  # NEW — 2×2 grid of chart panels
│   ├── pair-selector.tsx             # NEW — global pair dropdown
│   ├── timeframe-selector.tsx        # NEW — per-panel timeframe dropdown
│   └── status-indicator.tsx          # NEW — connection status (text + icon)
├── services/
│   ├── api-client.ts                 # NEW — fetch wrapper for REST endpoints
│   └── socket-client.ts             # NEW — socket.io singleton + typed events
└── lib/
    ├── constants.ts                  # NEW — timeframes, default pair, colors
    └── indicators.ts                 # NEW — MA, Bollinger, SR calculations
```

## Implementation Phases

### Phase 0 — Foundation (Task #8)
**Goal**: Set up the infrastructure that all chart components depend on.

1. **Tailwind v4 theme** — map DESIGN.md color tokens to `@theme` in `globals.css` (canvas-dark, surface-card-dark, primary, trading-up/down, muted, etc.)
2. **Font setup** — add Inter (BinanceNova substitute) and JetBrains Mono (BinancePlex substitute) via `next/font/google` in `layout.tsx`
3. **Constants** — `lib/constants.ts`: `TIMEFRAMES`, `DEFAULT_PAIR`, `DEFAULT_TIMEFRAMES` (4 for the grid), `API_BASE_URL`, color hex values, WS event names
4. **API client** — `services/api-client.ts`: typed fetch wrappers for `/candles`, `/pairs`, `/subscriptions`, `/subscribe`, `/unsubscribe`
5. **Socket client** — `services/socket-client.ts`: singleton `io()` connection to `/market-data` namespace, typed event emitter/listener
6. **useMarketData hook** — `hooks/use-market-data.ts`: fetches historical candles, manages REST subscribe/unsubscribe, exposes `{ candles, loading, error, subscribe, unsubscribe }`
7. **useWebSocket hook** — `hooks/use-websocket.ts`: manages socket connection lifecycle, dispatches `candle:update`, `candle:close`, `status:*` events to subscribers via a callback registry

### Phase 1 — Core Chart (Task #9)
**Goal**: A single working candlestick chart with live updates.

1. **CandlestickChart component** — `components/chart/candlestick-chart.tsx`:
   - Creates a `lightweight-charts` v5 `IChartApi` instance in a `useRef` + `useEffect`
   - Adds a `CandlestickSeries` via `chart.addSeries(CandlestickSeries, options)`
   - Maps backend `Candle` → lightweight-charts `{ time: epochSeconds, open, high, low, close }`
   - On `candle:update` → `series.update(bar)` (updates last bar in place)
   - On `candle:close` → `series.update(bar)` (appends new bar)
   - Responsive resize via `ResizeObserver`
   - Colors: upColor `#0ecb81`, downColor `#f6465d`, background `#1e2329`

### Phase 2 — Selectors + Status (part of #10, #11)
**Goal**: User controls for pair/timeframe + connection status display.

1. **PairSelector** — dropdown populated from `GET /pairs`, emits selection change
2. **TimeframeSelector** — dropdown with `TIMEFRAMES` enum, emits selection change
3. **StatusIndicator** — listens to `status:*` events, shows text + icon (green/yellow/red dot + label)

### Phase 3 — Dashboard Grid (Tasks #10, #11)
**Goal**: The 2×2 grid dashboard page.

1. **MultiTimeframeGrid** — renders 4 `CandlestickChart` panels, each with its own `TimeframeSelector`. Manages per-panel `symbol:timeframe` subscriptions. Responsive: 2×2 (desktop) → 2×1 (tablet) → 1×1 (mobile) via Tailwind grid classes.
2. **page.tsx rewrite** — composes `PairSelector` (global), `MultiTimeframeGrid`, `StatusIndicator`. Manages global pair state. Uses the hooks to wire data flow.

### Phase 4 — Overlays (Task #12)
**Goal**: Technical analysis overlays.

1. **Indicators** — `lib/indicators.ts`: pure functions for SMA, Bollinger Bands, Support/Resistance levels
2. **ChartOverlay** — toggle buttons (MA, Bollinger, SR) per chart panel. Adds `LineSeries` to the chart for each active overlay. Recalculates on candle updates. Colors: primary for MA, info-blue for Bollinger, muted for SR.

### Phase 5 — Deferred (Task #13)
**Goal**: Trade markers stub.

1. **TradeMarkers** — component stub that renders "No trade data available" placeholder. Real implementation deferred to W3 when Phương's trade data pipeline is ready.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
