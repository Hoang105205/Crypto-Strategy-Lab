# Research: Market Data Backend

> **Feature**: market-data-backend | **SDD phase**: Plan (research notes)

## 1. Binance REST — Historical Klines

- Endpoint: `GET https://api.binance.com/api/v3/klines`
- Query params: `symbol` (e.g. `BTCUSDT`), `interval` (`1m`,`5m`,`15m`,`30m`,`1h`,`2h`,`4h`,`1d`), `limit` (max 1000, default 500), `startTime`, `endTime` (ms epoch).
- Response: array of arrays — `[[ openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote, ignore ], ...]`. All numeric fields are strings.
- Mapping to `Candle`: `openTime`(idx0)→Date, `open`(1), `high`(2), `low`(3), `close`(4), `volume`(5), `closeTime`(6)→Date. `isClosed` is always `true` for historical klines.
- Rate limits: Binance returns 429 with `Retry-After` when limited (weight-based, 1200/min IP weight). `fetchKlines` weight = 2 (limit ≤100) or 1–10 by range. Honor `Retry-After`, default 60s.
- No API key required for public klines, but send `X-MBX-APIKEY` header if configured (raises weight allowance).

## 2. Binance WebSocket — Live Kline Stream

- URL: `wss://stream.binance.com:9443/ws/<symbol>@kline_<interval>` (e.g. `btcusdt@kline_5m`). Symbol lowercase.
- Message shape: `{ e: 'kline', E: <eventTime>, s: 'BTCUSDT', k: { t: openTime, T: closeTime, s, i: interval, o, h, l, c, v, x: isClosed, ... } }`. `o/h/l/c/v` are strings; `x` is boolean (`false`=forming, `true`=closed).
- Reconnect: Binance closes idle connections ~24h; the `ws` lib emits `close`/`error`. Use a bounded retry, NOT auto-reconnect built-ins.
- Library: `ws@8` (already a dependency + `@types/ws`). Open with `new WebSocket(url)`; listen `open|message|close|error`.

## 3. NestJS WebSocket Gateway

- `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io@4` are already dependencies.
- `@WebSocketGateway({ namespace: 'market-data', cors: true })`. Inject `@WebSocketServer() server`.
- Emit: `server.emit('candle:update', payload)` (broadcast) or `server.to(room).emit(...)` to scope per `symbol:timeframe` room. Rooms recommended so multi-timeframe grid clients only get their own feed (flow 5b).
- Lifecycle hooks: `handleConnection(client)`, `handleDisconnect(client)` — track per-client subscriptions to call `service.unsubscribe` (flow 6c).

## 4. Caching

- Simple `Map<string, Entry>` with `expiresAt = Date.now() + 60_000`. Check-and-evict on read. Invalidate key on `candle:close` (market-data.md §3 Caching).
- LRU not strictly needed for a course project; a TTL Map is sufficient (Constitution IV — simplicity). If size grows, cap entries.

## 5. Prisma

- `schema.prisma` already has `Candle` (`@@unique([symbol, timeframe, openTime])`, `@@index`) and `TradingPair`. Models confirmed in review-2026-08-09.
- Generate migration: `npx prisma migrate dev --name init_market_data` (run from `workspace/apps/backend`).
- Upsert closed candle: `prisma.candle.upsert({ where: { symbol_timeframe_openTime: {...} }, create: {...}, update: {...} })` — dedup via the compound unique (ADR-0007 clock-skew mitigation).
- Seed `TradingPair` (BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, XRPUSDT) so `/pairs` and subscribe validation work without manual inserts.

## 6. DI Tokens for Interfaces

- TS interfaces are erased at runtime → NestJS DI needs a token. Convention: `export const IMarketDataAdapter = Symbol('IMarketDataAdapter')`.
- Confirm with Phương how `IEventBus` is provided (Symbol token vs class). `EventsModule` must `exports` the provider. Until confirmed, `MarketDataService` can accept an optional `IEventBus`; if absent, skip event publication (graceful) but log a warning — do NOT hard-fail startup.

## 7. Open questions carried into tasks

- IEventBus token convention (Phương).
- `getCandlesRange` DB-first vs adapter-first (Huy) — spec chooses DB-first + backfill.
