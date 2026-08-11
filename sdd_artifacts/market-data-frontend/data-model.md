# Data Model: Market Data Frontend

> The frontend does not define new entities — it consumes the backend's contracts.
> This document maps the backend entities to the frontend's internal data shapes.

## Entity Relationship

```
Backend (kb/contracts/market-data.yaml)     Frontend (internal shapes)
─────────────────────────────────────────    ──────────────────────────────
Candle (REST + WS)                    ──→    CandleData (consumed as-is)
TradingPair (REST)                    ──→    PairOption (for dropdown)
Subscription (REST)                   ──→    SubscriptionInfo (for status panel)
WS Candle Payload                     ──→    WsCandleEvent (parsed by hooks)
WS Status Payload                     ──→    WsStatusEvent (parsed by hooks)
                                           ↓
                                    CandleData.time (seconds) ──→ lightweight-charts Bar
```

## Entities

### CandleData (from backend Candle)

| Field | Type | Source | Notes |
|---|---|---|---|
| symbol | string | REST + WS | e.g. "BTCUSDT" |
| timeframe | string | REST + WS | e.g. "5m" |
| openTime | Date (ISO8601) | REST + WS | Candle open timestamp |
| closeTime | Date (ISO8601) | REST + WS | Candle close timestamp |
| open | number | REST + WS | Opening price |
| high | number | REST + WS | Highest price |
| low | number | REST + WS | Lowest price |
| close | number | REST + WS | Closing price |
| volume | number | REST + WS | Trading volume |
| isClosed | boolean | REST + WS | false = forming, true = finalized |

### ChartBar (lightweight-charts v5 internal)

| Field | Type | Mapping | Notes |
|---|---|---|---|
| time | number (epoch seconds) | `Math.floor(candle.openTime.getTime() / 1000)` | v5 requires seconds, not ms |
| open | number | `candle.open` | Direct |
| high | number | `candle.high` | Direct |
| low | number | `candle.low` | Direct |
| close | number | `candle.close` | Direct |

### WsCandleEvent (WebSocket payload)

| Field | Type | Source | Notes |
|---|---|---|---|
| symbol | string | `candle:update` / `candle:close` event | |
| timeframe | string | same | |
| candle.openTime | Date | same | |
| candle.closeTime | Date | same | |
| candle.open | number | same | |
| candle.high | number | same | |
| candle.low | number | same | |
| candle.close | number | same | |
| candle.volume | number | same | |
| candle.isClosed | boolean | same | Determines update vs append (both use `series.update()`) |

### WsStatusEvent (WebSocket payload)

| Field | Type | Source | Notes |
|---|---|---|---|
| connected | boolean | `status:*` events | |
| exchange | string | same | e.g. "binance" |
| lastReconnectAt | Date \| null | same | Present only on `status:reconnected` |

### PairOption (for PairSelector dropdown)

| Field | Type | Mapping | Notes |
|---|---|---|---|
| symbol | string | `TradingPair.symbol` | e.g. "BTCUSDT" |
| label | string | `${baseAsset}/${quoteAsset}` | e.g. "BTC/USDT" |
| isActive | boolean | `TradingPair.isActive` | Filter to active only |

## Migration Notes

- No database migration — the frontend has no database.
- No new backend entities — all shapes are consumed from `kb/contracts/market-data.yaml`.
- The `ChartBar` type is internal to the frontend and never sent to or received from the backend.
