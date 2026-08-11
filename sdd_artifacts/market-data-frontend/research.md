# Research: Market Data Frontend

## D1: lightweight-charts v5 API

- **Chosen**: Use v5's unified `chart.addSeries(CandlestickSeries, options)` API (breaking change from v4's `chart.addCandlestickSeries(options)`)
- **Rationale**: v5.2.0 is installed. The v5 API uses series definition constants (`CandlestickSeries`, `LineSeries`, `HistogramSeries`) passed to a unified `addSeries()` method. This is the only supported API in v5 — the old v4 methods are removed.
- **Key API patterns**:
  ```ts
  import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts';
  const chart = createChart(container, { layout: { background: { color: '#1e2329' } } });
  const candleSeries = chart.addSeries(CandlestickSeries, { upColor: '#0ecb81', downColor: '#f6465d' });
  candleSeries.setData([{ time: 1234567890, open: 100, high: 105, low: 95, close: 102 }]);
  candleSeries.update({ time: 1234567890, open: 100, high: 106, low: 94, close: 103 });
  ```
- **Time format**: `time` must be a UNIX timestamp in **seconds** (not milliseconds). Backend returns ISO8601 dates → frontend converts via `Math.floor(date.getTime() / 1000)`.
- **Real-time updates**: `series.update(bar)` handles both updating the last bar (same `time`) and appending a new bar (new `time`). No need to distinguish `candle:update` vs `candle:close` at the chart level — both call `series.update()`.
- **Alternatives considered**: recharts (no native candlestick), echarts (heavy), visx (too low-level). All rejected — lightweight-charts is purpose-built for financial charts.
- **KB reference**: ARCHITECTURE.md lists `lightweight-charts` in the tech stack.

## D2: Frontend testing strategy

- **Chosen**: Skip automated frontend tests for W2. Rely on manual smoke testing + the backend's 36/36 unit tests.
- **Rationale**: The project has no frontend test runner configured (ARCHITECTURE.md mentions Vitest but it's not installed). Configuring Vitest + jsdom + lightweight-charts mocking would take 1-2 hours with marginal value for a 4-week course project. The chart rendering is visual — manual verification is more effective than DOM assertions. The backend contract is already unit-tested.
- **Contingency**: If the frontend grows complex in W3, configure Vitest then. The hooks (`useMarketData`, `useWebSocket`) are the most testable units — pure logic with mockable fetch/socket.
- **Alternatives considered**: Vitest (added setup cost), Jest (already in backend but frontend has different transform needs), Playwright (too heavy for W2). All deferred.
- **KB reference**: ARCHITECTURE.md mentions "Jest (backend) + Vitest (frontend)" — this is aspirational, not yet configured.

## D3: Font substitution

- **Chosen**: Inter (BinanceNova substitute) + JetBrains Mono (BinancePlex substitute), loaded via `next/font/google`
- **Rationale**: DESIGN.md §"Note on Font Substitutes" explicitly says: "If BinanceNova and BinancePlex are unavailable, Inter is the closest open-source substitute for BinanceNova and JetBrains Mono or IBM Plex Sans is the closest substitute for BinancePlex." Inter is a humanist sans-serif matching BinanceNova's character. JetBrains Mono provides tabular monospace numbers matching BinancePlex's financial-data role.
- **Implementation**: Use `next/font/google` in `layout.tsx`:
  ```ts
  import { Inter, JetBrains_Mono } from 'next/font/google';
  const inter = Inter({ variable: '--font-sans', subsets: ['latin'] });
  const mono = JetBrains_Mono({ variable: '--font-mono', subsets: ['latin'] });
  ```
  Map to Tailwind v4 `@theme`: `--font-sans: var(--font-sans); --font-mono: var(--font-mono);`
- **Alternatives considered**: IBM Plex Mono (also acceptable per DESIGN.md, but JetBrains Mono has better tabular figures). System fonts (too generic, loses trading-platform character).
- **KB reference**: kb/DESIGN.md §"Note on Font Substitutes"

## D4: State management

- **Chosen**: React built-in state (useState, useRef, useCallback) + a WebSocket context provider. No external state library.
- **Rationale**: Constitution IV (Simplicity). The dashboard has one page with 4 chart panels sharing a global pair. State complexity is low:
  - Global: selected pair, connection status
  - Per-panel: selected timeframe, candle data, loading/error state
  - A single `WebSocketProvider` context wraps the page, providing the socket instance + status to all children.
- **Alternatives considered**: Zustand (lightweight but unnecessary for this scope), Redux (massive overkill), Jotai (unnecessary). All rejected by YAGNI.
- **KB reference**: Constitution IV (Simplicity Over Cleverness)

## D5: Tailwind v4 theme mapping

- **Chosen**: Map DESIGN.md color tokens to Tailwind v4's `@theme` CSS custom properties in `globals.css`
- **Rationale**: Tailwind v4 uses CSS-based configuration — no `tailwind.config.js`. Custom colors are defined via `@theme { --color-canvas-dark: #0b0e11; }` and used as `bg-canvas-dark`, `text-primary`, etc.
- **Mapping**:
  ```css
  @theme {
    --color-canvas-dark: #0b0e11;
    --color-surface-card: #1e2329;
    --color-surface-elevated: #2b3139;
    --color-primary: #fcd535;
    --color-primary-active: #f0b90b;
    --color-body: #eaecef;
    --color-muted: #707a8a;
    --color-trading-up: #0ecb81;
    --color-trading-down: #f6465d;
    --color-info: #3b82f6;
    --color-hairline-dark: #2b3139;
    --font-sans: var(--font-inter), sans-serif;
    --font-mono: var(--font-jetbrains-mono), monospace;
  }
  ```
- **KB reference**: kb/DESIGN.md (all color/typography tokens)

## D6: WebSocket lifecycle and room joining

- **Chosen**: The frontend emits `subscribe { symbol, timeframe }` over the socket.io connection to join per-`symbol:timeframe` rooms (in addition to the REST `POST /subscribe` that opens the Binance stream).
- **Rationale**: The backend gateway implementation deviated from the original plan — it requires socket-level `subscribe` to join rooms for per-client tracking (flow 6c: client disconnect cleanup). REST `POST /subscribe` opens the Binance stream but does not join a socket room. Both are needed:
  1. `POST /api/market-data/subscribe` → opens/increments the Binance stream (deduped)
  2. `socket.emit('subscribe', { symbol, timeframe })` → joins the `market-data:candles:${symbol}:${timeframe}` room to receive `candle:update`/`candle:close` events
- **Cleanup**: On component unmount or page navigation:
  1. `socket.emit('unsubscribe', { symbol, timeframe })` → leaves the room
  2. `POST /api/market-data/unsubscribe` → decrements subscriber count (closes stream at 0)
- **Alternatives considered**: REST-only (can't track per-client rooms for disconnect cleanup). Socket-only (doesn't open the Binance stream — the gateway delegates to the service). Both are needed.
- **KB reference**: `agent_learn/lessons/market-data-backend-2026-08-10.md` "Deviations from Plan" — "Gateway adds socket-level subscribe/unsubscribe handlers"
