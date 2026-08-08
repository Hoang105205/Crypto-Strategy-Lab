# Business Flow: Realtime Market Data

> **Owner**: Hoàng
> **Status**: Active
> **Last Updated**: 2026-08-07

## 1. Overview
- **Description**: Binance streams live candle data into the system; the Market Data module normalizes it, caches closed candles, publishes events, and relays updates to connected frontend charts in real time
- **Primary Actor**: Binance WebSocket (external) → BinanceAdapter (system trigger)
- **Business Value**: Users see live market data without refreshing — spec Section 4 requires real-time updates, not polling (`GET /price` repeated)
- **Modules Involved**: Market Data (BinanceAdapter, MarketDataService, MarketDataGateway), Frontend (CandlestickChart, MultiTimeframeGrid, StatusIndicator)

## 2. Preconditions
- The NestJS backend is running and the Market Data module is initialized
- At least one frontend client is connected via WebSocket and has called `POST /api/market-data/subscribe` for a `symbol` + `timeframe` combination
- Binance API is reachable (network connectivity, valid API key if required for the endpoint)
- The `TradingPair` for the requested `symbol` exists and `isActive = true` in the system

## 3. Flow Steps

### Main Flow: Live Candle Update
1. Frontend calls `POST /api/market-data/subscribe { symbol: "BTCUSDT", timeframe: "5m" }` — Frontend → MarketDataService via REST
2. MarketDataService checks `Subscription` table — if no existing stream for `BTCUSDT:5m`, calls `BinanceAdapter.connectStream("BTCUSDT", "5m")` — MarketDataService → BinanceAdapter
3. BinanceAdapter opens WebSocket to Binance: `wss://stream.binance.com:9443/ws/btcusdt@kline_5m` — BinanceAdapter → Binance
4. Binance sends kline update (forming candle, `x: false`) — Binance → BinanceAdapter
5. BinanceAdapter parses Binance JSON (`k.t` → `openTime`, `k.o` → `open`, `k.h` → `high`, `k.l` → `low`, `k.c` → `close`, `k.v` → `volume`, `k.x` → `isClosed`) into a `Candle` object — BinanceAdapter
6. BinanceAdapter invokes `onCandle(candle)` callback — BinanceAdapter → MarketDataService
7. MarketDataService publishes `MarketDataUpdated` event on `IEventBus` (for future event-driven consumers) — MarketDataService → EventBus
8. MarketDataService relays the candle to MarketDataGateway — MarketDataService → MarketDataGateway
9. MarketDataGateway emits `candle:update` event to all connected frontend clients on the `market-data:candles` WebSocket channel — MarketDataGateway → Frontend
10. Frontend `CandlestickChart` updates the last (forming) candle on the chart — Frontend

### Sub-flow: Candle Close
11. Binance sends final kline update for the interval (`x: true`) — Binance → BinanceAdapter
12. BinanceAdapter parses into `Candle { isClosed: true }` — BinanceAdapter
13. MarketDataService receives the closed candle, persists it to the database (Prisma `Candle` table), and invalidates the REST cache for this `symbol:timeframe` — MarketDataService
14. MarketDataGateway emits `candle:close` event — MarketDataGateway → Frontend
15. Frontend `CandlestickChart` appends a new candle and starts tracking the next interval — Frontend

## 4. Postconditions
- The frontend chart displays the latest candle data in real time
- Closed candles are persisted in the database for historical queries and backtesting
- The REST cache for the `symbol:timeframe` is updated with the latest closed candle
- The `MarketDataUpdated` event has been published on the event bus (even if no subscribers currently listen — future consumers can subscribe without changes)
- The `Subscription` record's `subscriberCount` accurately reflects the number of connected frontend clients

## 5. Alternative Paths

### 5a: Multiple Clients Subscribe to the Same Stream
- When a second frontend client calls `POST /api/market-data/subscribe` for the same `symbol:timeframe`, MarketDataService increments `subscriberCount` (1 → 2) but does **not** open a second Binance WebSocket stream
- Both clients receive `candle:update` / `candle:close` events from the single shared stream
- When either client unsubscribes, `subscriberCount` decrements. The Binance stream is only closed when `subscriberCount` reaches 0

### 5b: Multi-Timeframe Grid (4 Charts)
- The frontend opens 4 independent subscriptions (e.g., `BTCUSDT:5m`, `BTCUSDT:15m`, `BTCUSDT:1h`, `BTCUSDT:4h`)
- MarketDataService opens 4 separate Binance WebSocket streams — one per `symbol:timeframe` combination
- Each `CandlestickChart` component in the `MultiTimeframeGrid` receives only its own `symbol:timeframe` updates
- A user can change a chart's timeframe (e.g., `5m` → `1m`) — this triggers an unsubscribe from `5m` and a subscribe to `1m` for that chart only. Other charts are unaffected

### 5c: Historical Data Request (Initial Chart Load)
- Before the first WebSocket update, the frontend calls `GET /api/market-data/candles?symbol=BTCUSDT&timeframe=5m&limit=500` to populate the chart with historical candles
- MarketDataService serves from cache if available, otherwise fetches from Binance REST API
- Once historical candles are rendered, the WebSocket stream provides incremental updates (appending new candles, updating the forming candle)

## 6. Error & Exception Flows

### 6a: Binance WebSocket Disconnects
- **Detection**: BinanceAdapter's WebSocket connection emits a `close` or `error` event
- **Action**: BinanceAdapter triggers auto-reconnect with exponential backoff (1s → 4s → 16s, max 3 attempts — ADR-0007)
- **Frontend notification**: MarketDataGateway emits `status:disconnected` event to all frontend clients on the `market-data:status` channel. The `StatusIndicator` component shows "Reconnecting..."
- **Recovery**: On successful reconnect, BinanceAdapter emits `status:reconnected`. The adapter fetches any candles missed during the disconnect via REST API (`fetchKlines` with `startTime` = last known candle time). Frontend resumes live updates.
- **If all 3 reconnect attempts fail**: MarketDataGateway emits `status:disconnected` with `connected: false` and no further auto-reconnect. Frontend shows "Connection lost — click to retry." User can manually trigger a re-subscribe.

### 6b: Binance REST API Rate Limited (429)
- **Detection**: Binance REST API returns HTTP 429
- **Action**: BinanceAdapter reads the `Retry-After` header (or defaults to 60s) and waits before retrying
- **Impact**: Historical candle requests (`GET /api/market-data/candles`) may be slow. Real-time WebSocket streams are unaffected (WebSocket is not rate-limited the same way)
- **Frontend**: REST request may time out — frontend shows a loading state. WebSocket updates continue normally

### 6c: Frontend Client Disconnects (Browser Closes)
- **Detection**: MarketDataGateway detects the WebSocket client disconnect (NestJS `@SubscribeMessage` lifecycle or `handleDisconnect`)
- **Action**: MarketDataService.unsubscribe() is called for each `symbol:timeframe` the client was watching. `subscriberCount` decrements. If it reaches 0, the Binance WebSocket stream for that pair is closed
- **Impact**: Other frontend clients watching the same stream are unaffected (their `subscriberCount` is still > 0)

### 6d: Invalid Symbol or Timeframe
- **Detection**: BinanceAdapter.connectStream() receives an error from Binance (invalid symbol or interval)
- **Action**: MarketDataService returns HTTP 400 `Bad Request` with `{ error: "Invalid symbol or timeframe" }` to the subscribe request
- **Impact**: No stream is opened. Frontend shows an error message in the chart panel

## 7. Business Rules
- **BR-1**: Only one Binance WebSocket stream per `symbol:timeframe` combination, regardless of how many frontend clients are watching. Subscription deduplication is mandatory.
- **BR-2**: Closed candles (`isClosed: true`) must be persisted to the database before being relayed to the frontend. Forming candles (`isClosed: false`) are never persisted — they are transient and replaced on each tick.
- **BR-3**: The frontend must never call Binance APIs directly. All data flows through `MarketDataService` (REST for historical, WebSocket via `MarketDataGateway` for real-time). This is the spec's Section 4 hard requirement.
- **BR-4**: If a Binance WebSocket stream drops and reconnects, the adapter must fetch any candles missed during the gap via REST API. The frontend must not see a gap in the candle timeline.
- **BR-5**: The `Candle` entity is the normalized format — Binance-specific field names (`k.t`, `k.c`, `k.h`, etc.) must never leave the `BinanceAdapter`. All downstream code (services, events, frontend) uses `Candle.openTime`, `Candle.close`, `Candle.high`, etc.
- **BR-6**: Auto-reconnect must use exponential backoff (1s, 4s, 16s) with a maximum of 3 attempts. An unbounded `while(true)` reconnect loop is forbidden — spec Section 23 requires a stop condition for all loops.

## 8. Related
- **Contracts**: `kb/contracts/market-data.yaml` (Candle entity, IMarketDataAdapter, IMarketDataService, REST + WebSocket), `kb/contracts/events.yaml` (MarketDataUpdated event)
- **ADRs**: ADR-0004 (Adapter Pattern for Data Sources), ADR-0007 (Auto-Reconnect for External APIs)
- **Module files**: `kb/modules/market-data.md`, `kb/modules/event-infrastructure.md`
- **Spec sections**: §4 (Realtime Market Data), §5 (Multi-Timeframe Chart), §32.3 (Realtime), §32.4 (Reliability)
