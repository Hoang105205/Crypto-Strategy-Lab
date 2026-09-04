# Contract: Market Data Frontend API (Consumer View)

> **SSoT**: `kb/contracts/market-data.yaml` is the Single Source of Truth.
> This file documents the frontend's consumption of those contracts — it does not define new APIs.

## REST Endpoints (consumed)

### GET /api/market-data/candles
- **Purpose**: Fetch historical candles for initial chart load (spec FR-1, flow 5c)
- **Params**: `symbol` (string), `timeframe` (string), `limit` (number, optional, default 500, max 1000)
- **Response**: `Candle[]`
- **Errors**: 400 `{ error: 'Invalid symbol or timeframe' }` (flow 6d)
- **Frontend usage**: Called once per chart panel on mount, and on pair/timeframe change

### GET /api/market-data/pairs
- **Purpose**: List available trading pairs for PairSelector (spec FR-8)
- **Response**: `TradingPair[]`
- **Frontend usage**: Called once on dashboard mount to populate PairSelector

### GET /api/market-data/subscriptions
- **Purpose**: List active subscriptions for status/debug panel
- **Response**: `Subscription[]`
- **Frontend usage**: Optional — for a debug panel showing active streams

### POST /api/market-data/subscribe
- **Purpose**: Open/increment a Binance WebSocket stream (spec FR-2, flow step 1)
- **Request**: `{ symbol: string, timeframe: string }`
- **Response**: `{ status: 'subscribed', symbol: string, timeframe: string }`
- **Errors**: 400 `{ error: 'Invalid symbol or timeframe' }` (flow 6d)
- **Frontend usage**: Called when a chart panel subscribes to a new `symbol:timeframe`

### POST /api/market-data/unsubscribe
- **Purpose**: Decrement subscriber count, close stream at 0 (spec FR-10, flow 6c)
- **Request**: `{ symbol: string, timeframe: string }`
- **Response**: `{ status: 'unsubscribed' }`
- **Frontend usage**: Called on chart panel unmount / pair/timeframe change

## WebSocket Events (consumed)

### Namespace: `/market-data`

### Client → Server Events

| Event | Payload | Purpose |
|---|---|---|
| `subscribe` | `{ symbol: string, timeframe: string }` | Join the `market-data:candles:${symbol}:${timeframe}` room to receive candle events |
| `unsubscribe` | `{ symbol: string, timeframe: string }` | Leave the room |

> **Note**: Both REST `POST /subscribe` AND socket `emit('subscribe')` are required.
> REST opens the Binance stream; socket joins the room for per-client tracking (research D6).

### Server → Client Events

| Event | Channel | Payload | Frontend Action |
|---|---|---|---|
| `candle:update` | `market-data:candles` | `{ symbol, timeframe, candle: { openTime, closeTime, open, high, low, close, volume, isClosed } }` | `series.update(bar)` — update last bar in place (FR-3) |
| `candle:close` | `market-data:candles` | same shape | `series.update(bar)` — append new bar (FR-4) |
| `status:connected` | `market-data:status` | `{ connected: true, exchange: string, lastReconnectAt: null }` | StatusIndicator → "Connected" (FR-7) |
| `status:disconnected` | `market-data:status` | `{ connected: false, exchange: string, lastReconnectAt: null }` | StatusIndicator → "Reconnecting..." (FR-7) |
| `status:reconnected` | `market-data:status` | `{ connected: true, exchange: string, lastReconnectAt: Date }` | StatusIndicator → "Connected" + timestamp (FR-7) |
