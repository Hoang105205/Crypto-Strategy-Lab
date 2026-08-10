# Spec: Market Data Backend

> **Feature**: market-data-backend
> **Owner**: Hoàng
> **Status**: Specified
> **Created**: 2026-08-09
> **SDD phase**: Specify (1/6)
> **Source of truth**: `kb/contracts/market-data.yaml`, `kb/modules/market-data.md`, `kb/flows/realtime-market-data.md`, ADR-0004, ADR-0007

---

## 1. Purpose

Implement the **Market Data backend module** — the data spine of the Crypto Strategy Lab. It ingests historical + real-time crypto data from Binance, normalizes it into the system's `Candle` entity, caches it, persists closed candles, relays live updates to the frontend over WebSocket, and publishes `MarketDataUpdated` on the event bus for future consumers.

This feature delivers tasks **#1–#7** from `Hoang_planning_implemention.md`. Frontend chart components (tasks #8–#13) are explicitly out of scope.

## 2. Actors

| Actor | Role |
|-------|------|
| Frontend (Next.js) | Consumes REST for historical candles + WebSocket for live candles/status |
| Strategy Engine (Huy) | Consumes `IMarketDataService` interface for historical candle analysis |
| Job Queue Worker (Phương) | Calls `IMarketDataService.getCandlesRange()` to replay candles during backtesting |
| Binance REST API | External historical kline source |
| Binance WebSocket | External real-time kline stream |
| Future event consumers | Subscribe to `MarketDataUpdated` on `IEventBus` (none in MVP) |

## 3. Scope

### In scope
- `BinanceAdapter` implementing `IMarketDataAdapter` (REST klines + WS stream + auto-reconnect + gap recovery)
- `MarketDataService` implementing `IMarketDataService` (caching, subscription dedup, persistence of closed candles, event publication, REST delegation)
- `MarketDataGateway` (NestJS WebSocket gateway — `market-data:candles` + `market-data:status` channels)
- `MarketDataController` (5 REST endpoints from the contract)
- Prisma migrations applied for `Candle` + `TradingPair` models; `PrismaService` wired into DI
- 4 missing skeleton directories created for other members (F-013→F-016)

### Out of scope
- Frontend chart components (`CandlestickChart`, `MultiTimeframeGrid`, `ChartOverlay`, `TradeMarkers`), hooks (`useWebSocket`, `useMarketData`), dashboard page — covered by tasks #8–#13
- `OKXAdapter` (extensibility proof, task #17, W4)
- Other modules' implementations (Strategy, News, Events, Queue, Leaderboard, Loop, Dashboard)

## 4. Functional Requirements

### FR-1: Historical candle fetch (REST)
- `MarketDataService.getCandles(symbol, timeframe, limit?)` returns `Candle[]` — served from in-memory cache on hit, else from `BinanceAdapter.fetchKlines()`.
- `getCandlesRange(symbol, timeframe, startTime, endTime)` returns candles for a date range — **used by the Backtest Worker** (contract line 80). Served from DB (persisted closed candles) first, falling back to the adapter for any missing range.
- Cache key: `symbol:timeframe`, TTL 60s, invalidated on `candle:close`.
- REST: `GET /api/market-data/candles?symbol&timeframe&limit` (default 500, max 1000).

### FR-2: Real-time WebSocket stream
- `BinanceAdapter.connectStream(symbol, timeframe)` opens `wss://stream.binance.com:9443/ws/<symbol>@kline_<interval>`.
- Incoming Binance kline messages are parsed into `Candle` (mapping `k.t→openTime`, `k.o→open`, `k.h→high`, `k.l→low`, `k.c→close`, `k.v→volume`, `k.x→isClosed`, `k.T→closeTime`). Binance field names never leave the adapter (BR-5).
- `onCandle` callback delivers normalized `Candle` to `MarketDataService`.

### FR-3: Auto-reconnect + gap recovery (ADR-0007)
- On WS `close`/`error`, reconnect with bounded exponential backoff `[1000, 4000, 16000]` ms, max 3 attempts. No `while(true)` (BR-6, spec §23).
- On successful reconnect: `fetchKlines(symbol, timeframe, { startTime: lastCandleTime })` to fill the gap; emit missed candles through the normal `onCandle` pipeline.
- On all attempts exhausted: stop; emit terminal `status:disconnected`.
- `onDisconnect` / `onReconnect` callbacks on `IMarketDataAdapter` surface state to `MarketDataService` → gateway.

### FR-4: Subscription deduplication
- `subscribe(symbol, timeframe)` increments `subscriberCount`; opens a Binance stream only on 0→1 transition (BR-1).
- `unsubscribe(symbol, timeframe)` decrements; closes the stream on 1→0.
- `POST /api/market-data/subscribe` + `POST /api/market-data/unsubscribe` REST endpoints.
- On frontend client disconnect, `MarketDataGateway.handleDisconnect` calls `unsubscribe` for each stream the client watched (flow 6c).

### FR-5: WebSocket relay to frontend
- `MarketDataGateway` emits on `market-data:candles` channel:
  - `candle:update` when `isClosed: false`
  - `candle:close` when `isClosed: true`
- `market-data:status` channel emits `status:connected`, `status:disconnected`, `status:reconnected`.

### FR-6: Persistence of closed candles
- Closed candles (`isClosed: true`) are persisted to the `Candle` table via Prisma upsert (dedup on `@@unique([symbol, timeframe, openTime])`) before relay (BR-2).
- Forming candles (`isClosed: false`) are never persisted.

### FR-7: Event publication
- `MarketDataService` publishes `MarketDataUpdated` on `IEventBus` (payload `{ symbol, timeframe, candle }`) for every new/updated candle. No bus subscribers in MVP — fire-and-forget.

### FR-8: REST reference data
- `GET /api/market-data/pairs` returns active `TradingPair[]` from DB.
- `GET /api/market-data/subscriptions` returns active `Subscription[]` (runtime state) for the status panel.

### FR-9: Skeleton directories (unblock teammates)
- Create `strategy/versioning/`, `news/cron/`, `database/repositories/`, `websocket/` with `.gitkeep` (review F-013→F-016).

## 5. Non-Functional Requirements

| Attribute | Requirement |
|-----------|-------------|
| **Performance** | In-memory LRU cache (TTL 60s) for historical candles; WebSocket for realtime (no polling); REST calls only on cache miss (§32.3, market-data.md §8) |
| **Reliability** | Bounded auto-reconnect + REST gap recovery; no lost candles (§32.4, ADR-0007) |
| **Security** | Binance API key/secret from `.env` only; never committed; no user auth (course project) (Constitution §Security) |
| **Modifiability** | Adapter pattern — new exchange = 1 class + 1 DI registration, zero changes elsewhere (ADR-0004, §32.1) |
| **Observability** | Connection status pushed to frontend via `market-data:status`; adequate non-verbose logging (§32.7) |
| **Rate-limit safety** | Honor Binance 429 `Retry-After` (default 60s) on REST; back off approaching limits |

## 6. Constraints (Constitution & ADRs)

- **Contract-Driven (II)**: Implement strictly to `kb/contracts/market-data.yaml` + `events.yaml`. Field names/types are the SSoT.
- **Extension points demonstrable (III)**: `IMarketDataAdapter` must be swappable (OKX proof is W4, but the DI seam must exist now).
- **Explicit over implicit (VI)**: Use named constants from `shared/constants.ts` (`BINANCE_WS_BASE`, `RECONNECT_DELAYS_MS`, `MAX_RECONNECT_ATTEMPTS`); no magic literals.
- **KB is truth (V)**: If implementation needs a contract change, update the KB + notify the team first.
- **No unbounded loops**: Reconnect has a stop condition (ADR-0007, spec §23).
- **No direct frontend→Binance**: All data flows through `MarketDataService` (BR-3).

## 7. Acceptance Criteria

1. `GET /api/market-data/candles?symbol=BTCUSDT&timeframe=5m&limit=100` returns normalized `Candle[]` from Binance (or cache).
2. `POST /api/market-data/subscribe {BTCUSDT,5m}` opens one Binance WS stream; a second identical subscribe does NOT open a second stream (subscriberCount=2).
3. Connected frontend clients receive `candle:update` (forming) and `candle:close` (finalized) events on `market-data:candles`.
4. Closing a Binance WS connection triggers ≤3 reconnect attempts with `[1s,4s,16s]` backoff; on success, missed candles are REST-fetched and the frontend shows `status:reconnected` with no timeline gap.
5. `getCandlesRange()` returns persisted closed candles from the DB (Backtest Worker contract).
6. `MarketDataUpdated` is published on `IEventBus` for each candle (verifiable via a test subscriber).
7. The 4 skeleton directories exist with `.gitkeep`; `PrismaService` connects on module init; `Candle` + `TradingPair` tables exist after migration.
8. All cross-module code depends on `IMarketDataService` / `IMarketDataAdapter` from `libs/shared` — never on `BinanceAdapter` directly.
9. `tsc --noEmit` passes for `apps/backend` and `libs/shared`; unit tests for cache hit/miss, subscription dedup, and kline parsing pass.

## 8. Dependencies & Touch Points

- **Consumes**: `libs/shared` (`Candle`, `TradingPair`, `Subscription`, `IMarketDataAdapter`, `IMarketDataService`, `IEventBus`, `EventType.MarketDataUpdated`, `MarketDataUpdatedPayload`); `shared/constants.ts`; `PrismaService`; `IEventBus` (owned by Phương's Events module — must be injectable).
- **Produces (for others)**: `IMarketDataService` (Huy + Phương consume), `MarketDataUpdated` event (future consumers), `market-data:candles`/`market-data:status` WS channels (frontend).
- **Coordination**: Confirm with Phương that `IEventBus` is exported from `EventsModule` for injection. Until then, `MarketDataService` can depend on the `IEventBus` token defensively.

## 9. Open Questions

- [ ] Does `IEventBus` need to be provided by `EventsModule` as a DI token, or does Phương expose a concrete `EventBus` class? (Assume `IEventBus` injectable token; confirm with Phương before implementation.)
- [ ] Should `getCandlesRange` read from DB-first or adapter-first? Spec says DB-first (persisted closed candles) + adapter backfill — confirm with Huy's Backtest Worker expectations.
