# Contract Snapshot: Market Data Backend

> **Feature**: market-data-backend | **SDD phase**: Plan
> **Authoritative SSoT**: `kb/contracts/market-data.yaml` (entities, interfaces, endpoints, WS channels) and `kb/contracts/events.yaml` (`IEventBus`, `MarketDataUpdated`, `EventEnvelope`).
> This file is a feature-local pointer; **do not duplicate schema here**. If the contract must change, update the KB YAML first (Constitution V) and re-point.

## What this feature implements from the contract

### Entities (already in `libs/shared/src/types/market-data.ts`)
- `Candle` — `{ symbol, timeframe, openTime, closeTime, open, high, low, close, volume, isClosed }`
- `TradingPair` — `{ symbol, baseAsset, quoteAsset, isActive }`
- `Subscription` — `{ symbol, timeframe, subscribedAt, subscriberCount }`

### Interfaces (already in `libs/shared/src/interfaces/market-data.ts`)
- `IMarketDataAdapter` — `fetchKlines`, `connectStream`, `disconnectStream`, `onCandle`, `onDisconnect`, `onReconnect`
- `IMarketDataService` — `getCandles`, `getCandlesRange`, `subscribe`, `unsubscribe`

### REST endpoints (`@Controller('api/market-data')`)
| Method | Path | Handler |
|--------|------|---------|
| GET | `/candles` | `getCandles(symbol, timeframe, limit?)` |
| GET | `/pairs` | `getTradingPairs()` |
| GET | `/subscriptions` | `listSubscriptions()` |
| POST | `/subscribe` | `subscribe(symbol, timeframe)` |
| POST | `/unsubscribe` | `unsubscribe(symbol, timeframe)` |

### WebSocket channels (`MarketDataGateway`, namespace `market-data`)
| Channel | Events |
|---------|--------|
| `market-data:candles` | `candle:update` (isClosed:false), `candle:close` (isClosed:true) |
| `market-data:status` | `status:connected`, `status:disconnected`, `status:reconnected` |

### Event published
- `MarketDataUpdated` (payload `{ symbol, timeframe, candle }`) on `IEventBus` — `subscribersOnBus: []` in MVP.

## Shared-lib verification (already implemented, do NOT redo)
- `libs/shared/src/events/index.ts` defines `EventType.MarketDataUpdated` + `MarketDataUpdatedPayload`.
- `libs/shared/src/interfaces/infrastructure.ts` defines `IEventBus` (`publish`, `subscribe`, `unsubscribe`).
- `libs/shared/src/types/market-data.ts` + `interfaces/market-data.ts` define entities + interfaces.

## Cross-module contract obligations
- `MarketDataModule` **exports** `IMarketDataService` so Strategy Engine (Huy) and Job Queue Worker (Phương) can inject it.
- `MarketDataService` consumes `IEventBus` from `EventsModule` (Phương) — token convention must be agreed.
