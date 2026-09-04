# Data Model: Market Data Backend

> **Feature**: market-data-backend | **SDD phase**: Plan

## 1. Persisted models (Prisma — already in `apps/backend/prisma/schema.prisma`)

### Candle
```prisma
model Candle {
  id          Int      @id @default(autoincrement())
  symbol      String
  timeframe   String
  openTime    DateTime
  closeTime   DateTime
  open        Float
  high        Float
  low         Float
  close       Float
  volume      Float
  isClosed    Boolean

  @@unique([symbol, timeframe, openTime])
  @@index([symbol, timeframe, openTime])
}
```
- Only **closed** candles persisted (`isClosed: true`). Forming candles are transient.
- Compound unique `@@unique([symbol, timeframe, openTime])` enables idempotent `upsert` (gap-recovery dedup, ADR-0007).
- Index `[symbol, timeframe, openTime]` supports `getCandlesRange` range queries used by the Backtest Worker.

### TradingPair
```prisma
model TradingPair {
  id          Int      @id @default(autoincrement())
  symbol      String   @unique
  baseAsset   String
  quoteAsset  String
  isActive    Boolean  @default(true)
}
```
- Static reference data. Seeded at migration time (BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, XRPUSDT).
- `GET /pairs` reads this; `subscribe` validates `isActive`.

## 2. In-memory (non-persisted) structures

### Cache (MarketDataService)
```ts
Map<string, { candles: Candle[]; expiresAt: number }>
// key = `${symbol}:${timeframe}`  TTL = 60_000 ms
```
- Invalidated on `candle:close` for that key.

### Subscriptions (MarketDataService)
```ts
Map<string, Subscription>
// key = `${symbol}:${timeframe}`
// Subscription { symbol, timeframe, subscribedAt, subscriberCount }
```
- `subscribe` → `subscriberCount++`; open Binance stream on 0→1.
- `unsubscribe` → `subscriberCount--`; close stream on 1→0.
- `GET /subscriptions` returns `Subscription[]` for the status panel.

### Stream tracking (BinanceAdapter)
```ts
Map<string, { ws: WebSocket; lastCandleTime: Date }>
// key = `${symbol}:${timeframe}`
```
- `lastCandleTime` drives gap-recovery `fetchKlines({ startTime })` on reconnect.

## 3. Event payload (published)

`MarketDataUpdated` (from `libs/shared` → `MarketDataUpdatedPayload`):
```ts
{ symbol: string; timeframe: string; candle: Candle }
```
Wrapped automatically by `IEventBus.publish()` in an `EventEnvelope` (`eventId`, `eventType`, `eventVersion`, `occurredAt`, `correlationId`, `payload`). Per `events.yaml`, `subscribersOnBus: []` in MVP — fire-and-forget.

## 4. Migration plan

1. Verify `schema.prisma` contains `Candle` + `TradingPair` (confirmed present).
2. `npx prisma migrate dev --name init_market_data` (creates `prisma/migrations/<ts>_init_market_data/`).
3. `npx prisma generate` (regenerate client if schema changed).
4. Add `prisma/seed.ts` + `prisma.seed` config in `package.json` (or run seed manually) to populate `TradingPair`.

## 5. Relationships to other modules

- `Candle` rows are read by the **Strategy Engine** (analysis) and **Job Queue Worker** (`getCandlesRange`) — both via `IMarketDataService`, never direct Prisma access (Constitution II, MODULES.md Rule 2: cross-module by ID/interface only).
- No foreign keys from `Candle`/`TradingPair` to other modules' tables (decoupled).
