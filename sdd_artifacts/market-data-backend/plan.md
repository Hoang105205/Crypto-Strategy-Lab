# Plan: Market Data Backend

> **Feature**: market-data-backend | **SDD phase**: Plan (2/6) | **Owner**: Hoàng | **Created**: 2026-08-09
> **Inputs**: spec.md + `kb/contracts/market-data.yaml`, `kb/contracts/events.yaml`, `kb/modules/market-data.md`, ADR-0004, ADR-0007

## 1. Implementation Strategy

Build bottom-up along the dependency chain so each layer is testable before the next is wired:

```
shared types/interfaces (DONE) ──▶ PrismaService + migrations ──▶ BinanceAdapter
                                                                    │
                                       ┌────────────────────────────┘
                                       ▼
                          MarketDataService (cache, dedup, persist, publish)
                                    │           │
                          ┌─────────┘           └──────────┐
                          ▼                                 ▼
                MarketDataGateway (WS)           MarketDataController (REST)
                          │                                 │
                          └────────── MarketDataModule ─────┘
```

Phases (each maps to tasks.md):
- **P0 — Foundation**: skeleton dirs, Prisma migrations, PrismaService wiring, BinanceAdapter REST + MarketDataService caching (unblocks Huy/Phương).
- **P1 — Realtime**: BinanceAdapter WS + auto-reconnect, gateway relay, REST subscribe/unsubscribe, event publication.

## 2. Component Design

### 2.1 BinanceAdapter (`market-data/adapters/binance.adapter.ts`)
- `@Injectable()` implementing `IMarketDataAdapter` (from `libs/shared`).
- **REST**: `fetchKlines()` uses `axios` → `GET {BINANCE_REST_BASE}/api/v3/klines?symbol&interval&limit&startTime&endTime`. Maps Binance array `[[openTime, open, high, low, close, volume, closeTime, ...]]` → `Candle[]` via a private `parseKline()`. On 429: read `Retry-After`, wait, retry (≤3). On 5xx: retry ≤3.
- **WS**: `connectStream()` opens a `ws.WebSocket` to `{BINANCE_WS_BASE}/<symbol>@kline_<interval>`. `on('message')` → parse `k` object → `onCandle` callbacks. `on('close'|'error')` → trigger `reconnect()`.
- **Reconnect**: private `reconnect()` loops `RECONNECT_DELAYS_MS` (max `MAX_RECONNECT_ATTEMPTS`). On success → `recoverGap(lastCandleTime)` + `notifyReconnect`. On exhaustion → `notifyDisconnect`. No `while(true)`.
- **Callbacks**: `onCandle`, `onDisconnect`, `onReconnect` register handlers in arrays.
- **Tracking**: per-stream `Map<string, { ws, lastCandleTime }>` keyed `symbol:timeframe` for gap recovery.
- Binance-specific keys (`k.t`, `k.c`) appear ONLY here (BR-5).

### 2.2 MarketDataService (`market-data/services/market-data.service.ts`)
- `@Injectable()` implementing `IMarketDataService`.
- **Cache**: `Map<string, { candles: Candle[], expiresAt: number }>` keyed `symbol:timeframe`, TTL 60s. `invalidate(key)` on candle close.
- **`getCandles(symbol, tf, limit)`**: cache hit → return; miss → `adapter.fetchKlines()` → cache → return. Clamp `limit` to ≤1000.
- **`getCandlesRange(symbol, tf, start, end)`**: DB-first (`prisma.candle.findMany` where `openTime` in range) then adapter backfill for gaps; return sorted `Candle[]`.
- **`subscribe/unsubscribe`**: `Map<string, Subscription>` with `subscriberCount`; 0→1 opens stream, 1→0 closes (`adapter.disconnectStream`).
- **Candle pipeline** (called from `adapter.onCandle`): persist if `isClosed` (upsert) → publish `MarketDataUpdated` via `IEventBus` → relay to gateway. `adapter.onDisconnect`/`onReconnect` → gateway status broadcast.
- Injects: `IMarketDataAdapter` (token), `PrismaService`, `IEventBus` (token).

### 2.3 MarketDataGateway (`market-data/websocket/market-data.gateway.ts`)
- `@WebSocketGateway({ namespace: 'market-data', cors: true })` using `@nestjs/platform-socket.io` + `socket.io`.
- `@WebSocketServer() server`.
- `handleConnection`/`handleDisconnect` — track per-client subscribed `symbol:timeframe` set; on disconnect call `service.unsubscribe` for each (flow 6c).
- Public methods called by the service: `emitCandle(symbol, tf, candle)` → emits `candle:update`/`candle:close` on `market-data:candles`; `emitStatus(state)` → `market-data:status` (`status:connected|disconnected|reconnected`).

### 2.4 MarketDataController (`market-data/market-data.controller.ts`)
- `@Controller('api/market-data')`.
- `GET /candles` (query `symbol, timeframe, limit`) → `service.getCandles`.
- `GET /pairs` → `service.getTradingPairs()` (reads `TradingPair` table).
- `GET /subscriptions` → `service.listSubscriptions()`.
- `POST /subscribe` (body `{ symbol, timeframe }`) → `service.subscribe` → returns `{ status:'subscribed', symbol, timeframe }`.
- `POST /unsubscribe` → `service.unsubscribe` → `{ status:'unsubscribed' }`.
- Validation: 400 `{ error: 'Invalid symbol or timeframe' }` for unknown pair/inactive (flow 6d).

### 2.5 MarketDataModule (`market-data/market-data.module.ts`)
- Providers: `BinanceAdapter`, `MarketDataService`, `MarketDataGateway`, `MarketDataController`.
- Bind DI tokens: `{ provide: IMarketDataAdapter, useClass: BinanceAdapter }`, `{ provide: IMarketDataService, useExisting: MarketDataService }`.
- Imports: `DatabaseModule` (for `PrismaService`), `EventsModule` (for `IEventBus` — coordinate with Phương).
- Exports: `IMarketDataService` (so Huy/Phương can inject).

## 3. Data Persistence

See `data-model.md`. Net-new DB work: ensure `Candle` + `TradingPair` models exist in `schema.prisma` (they do), generate migration, apply via `prisma migrate dev`, seed `TradingPair` rows (BTCUSDT, ETHUSDT, …). `PrismaService` already extends `PrismaClient`; wire it as a provider in `DatabaseModule` and export.

## 4. DI & Interface Tokens

- `IMarketDataAdapter`, `IMarketDataService`, `IEventBus` are imported from `@crypto-strategy-lab/shared`.
- Use Symbol/string tokens for DI where interfaces have no runtime value. Pattern: `export const IMARKET_DATA_ADAPTER = Symbol('IMarketDataAdapter')`. **Confirm token convention with Phương** (Events module) so `IEventBus` injection is consistent.
- `BinanceAdapter` is the only concrete class bound; everything else codes to interfaces (Constitution II, ADR-0004).

## 5. Testing Approach (per CONTRIBUTING.md)

- **Unit (`*.spec.ts`)**:
  - `BinanceAdapter.parseKline()` — Binance JSON → `Candle` mapping incl. `isClosed`.
  - `MarketDataService.getCandles()` — cache hit/miss/expire.
  - `subscribe()`/`unsubscribe()` — dedup (2 calls → 1 stream; 2 unsubscribes → stream closed).
  - `reconnect()` — simulate drop → verify ≤3 attempts, gap recovery, terminal status.
- **Mock strategy**: inject a mock `IMarketDataAdapter` into `MarketDataService` tests; never hit Binance in unit tests. `axios`/`ws` mocked in adapter tests.
- **Integration**: a `GET /candles` supertest call against the NestJS app with a nock/mock Binance response.

## 6. File Inventory (new/modified)

| File | Action |
|------|--------|
| `apps/backend/src/market-data/adapters/binance.adapter.ts` | NEW |
| `apps/backend/src/market-data/services/market-data.service.ts` | NEW |
| `apps/backend/src/market-data/websocket/market-data.gateway.ts` | NEW |
| `apps/backend/src/market-data/market-data.controller.ts` | NEW |
| `apps/backend/src/market-data/market-data.module.ts` | MODIFY (wire providers) |
| `apps/backend/src/database/database.module.ts` | MODIFY (provide + export PrismaService) |
| `apps/backend/prisma/schema.prisma` | VERIFY (Candle, TradingPair already present) |
| `apps/backend/prisma/migrations/**` | NEW (generated migration) |
| `apps/backend/prisma/seed.ts` | NEW (TradingPair seed) |
| `apps/backend/src/strategy/versioning/.gitkeep` | NEW (F-013) |
| `apps/backend/src/news/cron/.gitkeep` | NEW (F-014) |
| `apps/backend/src/database/repositories/.gitkeep` | NEW (F-015) |
| `apps/backend/src/websocket/.gitkeep` | NEW (F-016) |
| `*.spec.ts` (4 files) | NEW |

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `IEventBus` not yet exported by Phương's EventsModule | Coordinate; if delayed, `MarketDataService` publishes via injected `EventEmitter2` behind a thin local adapter until `IEventBus` token is ready (do NOT couple to EventEmitter2 long-term) |
| Binance WS rate/connection limits | One stream per symbol:timeframe (dedup); bounded reconnect |
| Clock skew causing dup/missing boundary candle on gap recovery | `@@unique([symbol,timeframe,openTime])` + Prisma upsert dedup (ADR-0007 risk note) |
| Tests hitting real Binance | All external calls mocked; integration tests use mocked HTTP/WS |

## 8. Out of Scope (deferred)

Frontend charts/hooks (#8–#13), `OKXAdapter` (#17), Architecture Document (#19), `/hoang-sdd-analyze`+`converge` (#18).
