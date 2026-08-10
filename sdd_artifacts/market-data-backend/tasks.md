# Tasks: Market Data Backend

> **Feature**: market-data-backend | **SDD phase**: Tasks (3/6) | **Owner**: Hoàng
> **STOP POINT**: This file ends the pre-implementation phases. The user switches model before running `/hoang-sdd-implement`.
> **Legend**: `[ ]` pending · `[X]` done · `[P]` parallelizable within a phase · `→` dependency on a prior task.

Phases are ordered by the dependency chain in `plan.md`. Do not start a phase until its `→` prerequisites are checked. Mark a task `[X]` only after its acceptance check passes.

---

## Phase 0 — Foundation & Unblocks (P0)

- [X] **T0.1** Create the 4 missing skeleton directories with `.gitkeep` (review F-013→F-016):
  - `apps/backend/src/strategy/versioning/.gitkeep`
  - `apps/backend/src/news/cron/.gitkeep`
  - `apps/backend/src/database/repositories/.gitkeep`
  - `apps/backend/src/websocket/.gitkeep`
  - Acceptance: `git status` shows 4 new `.gitkeep` files; dirs persist on push.

- [X] **T0.2** Wire `PrismaService` into `DatabaseModule` (provide + export), so other modules can inject it. *(Already complete in codebase — verified 2026-08-10.)*
  - File: `apps/backend/src/database/database.module.ts`
  - Acceptance: `PrismaService` is importable from `DatabaseModule`; `tsc --noEmit` passes.

- [X] **T0.3** Generate + apply the initial Prisma migration for `Candle` + `TradingPair`. *(Migration `20260810005335_init_market_data` applied to Supabase 2026-08-10; seeded 5 pairs.)*
  - From `workspace/apps/backend`: `npx prisma migrate dev --name init_market_data`
  - Acceptance: `prisma/migrations/<ts>_init_market_data/` exists; `Candle` + `TradingPair` tables exist in the Supabase Postgres (check via Supabase Dashboard → Table Editor). `npx prisma generate` succeeds.

- [X] **T0.4** Create `prisma/seed.ts` to seed `TradingPair` rows (BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, XRPUSDT) and wire `prisma.seed` in `package.json`. *(Seed run itself needs the DB — see T0.3.)*
  - Acceptance: `npx prisma db seed` populates the `TradingPair` table; `GET /pairs` will return 5 rows once the controller exists.

- [X] **T0.5** `→ T0.2` Implement `BinanceAdapter.fetchKlines()` (REST) + private `parseKline()` mapping (research §1).
  - File: `apps/backend/src/market-data/adapters/binance.adapter.ts`
  - Use `axios`, `BINANCE_REST_BASE` from `shared/constants.ts`. Honor 429 `Retry-After` (default 60s), retry 5xx ≤3.
  - Binance field names (`k.t`, array indices) appear ONLY here (BR-5).
  - Acceptance: unit test `parseKline()` maps a sample Binance array → `Candle` with correct types + `isClosed:true`.

- [X] **T0.6** `→ T0.5, T0.2` Implement `MarketDataService.getCandles()` + caching + `getTradingPairs()` + `listSubscriptions()` skeleton.
  - File: `apps/backend/src/market-data/services/market-data.service.ts`
  - Cache: `Map<string,{candles,expiresAt}>`, TTL 60s, invalidate on close (stub the invalidation hook for now).
  - `getCandles`: cache hit → return; miss → `adapter.fetchKlines()` → cache → return. Clamp `limit` ≤1000.
  - Acceptance: unit test — 1st call hits adapter (mock), 2nd call within TTL returns cached (adapter not called); expired entry re-fetches.

- [X] **T0.7** `→ T0.6` Implement `getCandlesRange(symbol, tf, start, end)` — DB-first (`prisma.candle.findMany`) + adapter backfill for missing range (spec FR-1, used by Backtest Worker).
  - Acceptance: unit test with mocked Prisma + adapter returns merged + sorted `Candle[]`; DB hits return first, adapter only fills gaps.

> **P0 gate (unblocks Huy + Phương)**: T0.1–T0.7 done → `IMarketDataService` is injectable and serves real historical candles. Notify Huy (Backtester can call `getCandlesRange`) and Phương (Job Queue Worker can call `getCandlesRange`).

---

## Phase 1 — Realtime & Relay (P1)

- [X] **T1.1** `→ T0.5` Implement `BinanceAdapter` WebSocket: `connectStream`, `disconnectStream`, `onCandle` registration + `parseKline` for WS messages (research §2).
  - Use `ws`, `BINANCE_WS_BASE`. URL `wss://stream.binance.com:9443/ws/<symbol-lower>@kline_<interval>`.
  - `on('message')` → parse `k` object → invoke `onCandle` callbacks. Track `lastCandleTime` per stream in a `Map`.
  - Acceptance: unit test with a fake `ws` message → `onCandle` receives a normalized `Candle` with correct `isClosed`.

- [X] **T1.2** `→ T1.1` Implement bounded auto-reconnect + gap recovery (ADR-0007).
  - `onDisconnect`/`onReconnect` callback registration. `reconnect()` loops `RECONNECT_DELAYS_MS` (max `MAX_RECONNECT_ATTEMPTS`), NO `while(true)`.
  - On success: `recoverGap(lastCandleTime)` → `fetchKlines({startTime})` → emit missed candles via `onCandle`; call `onReconnect` callbacks. On exhaustion: call `onDisconnect` (terminal).
  - Acceptance: unit test — simulate `close` → verify exactly ≤3 attempts, gap fetch invoked on success, terminal `onDisconnect` on full failure.

- [X] **T1.3** `→ T0.6` Implement `subscribe`/`unsubscribe` with subscription dedup (BR-1) + wire adapter callbacks.
  - `Map<string, Subscription>` with `subscriberCount`; 0→1 opens `adapter.connectStream`; 1→0 calls `adapter.disconnectStream`.
  - Register `adapter.onCandle` → candle pipeline (persist if closed, publish event, relay to gateway). Register `onDisconnect`/`onReconnect` → gateway status.
  - Acceptance: unit test — 2 `subscribe` calls → 1 `connectStream`; 2 `unsubscribe` → 1 `disconnectStream`; candle pipeline invoked on `onCandle`.

- [X] **T1.4** `→ T1.3` Implement closed-candle persistence: upsert to `Candle` table on `isClosed:true` (BR-2), then invalidate the `symbol:timeframe` cache. Skip persistence for forming candles.
  - Use `prisma.candle.upsert` with compound unique `symbol_timeframe_openTime` (clock-skew dedup, ADR-0007).
  - Acceptance: unit test — forming candle not persisted; closed candle upserted exactly once even on duplicate `openTime`.

- [X] **T1.5** `→ T1.3` Implement `MarketDataGateway` (NestJS WS gateway, namespace `market-data`, cors).
  - File: `apps/backend/src/market-data/websocket/market-data.gateway.ts`
  - `handleConnection`/`handleDisconnect` (track per-client subscriptions → `service.unsubscribe` on disconnect, flow 6c).
  - `emitCandle(symbol,tf,candle)` → `candle:update` (forming) / `candle:close` (closed) on `market-data:candles` (use per-`symbol:timeframe` rooms).
  - `emitStatus(state)` → `market-data:status` (`status:connected|disconnected|reconnected`).
  - Acceptance: integration test — a socket.io client receives `candle:close` after a closed candle is pushed; `handleDisconnect` decrements subscription.

- [X] **T1.6** `→ T0.6, T1.3` Implement `MarketDataController` (5 REST endpoints, research §contract).
  - File: `apps/backend/src/market-data/market-data.controller.ts` (`@Controller('api/market-data')`)
  - `GET /candles`, `GET /pairs`, `GET /subscriptions`, `POST /subscribe`, `POST /unsubscribe`.
  - Validate symbol/timeframe against `TradingPair.isActive` → 400 `{ error: 'Invalid symbol or timeframe' }` (flow 6d).
  - Acceptance: supertest — `GET /candles?symbol=BTCUSDT&timeframe=5m&limit=100` returns 200 `Candle[]`; invalid symbol → 400.

- [X] **T1.7** `→ T1.3` Publish `MarketDataUpdated` on `IEventBus` in the candle pipeline (spec FR-7).
  - Use `EventType.MarketDataUpdated` + `MarketDataUpdatedPayload` from `libs/shared`. Fire-and-forget.
  - **Dependency note**: confirm `IEventBus` DI token with Phương (open question). If `IEventBus` not yet provided, inject optionally and skip+log — do not crash startup. Track in `note.md`.
  - Acceptance: unit test — a test subscriber on `IEventBus` receives the envelope for each `onCandle`; if `IEventBus` absent, no throw (warning logged).

- [X] **T1.8** `→ T1.1–T1.7` Wire `MarketDataModule`: providers, DI token bindings (`IMarketDataAdapter→BinanceAdapter`, `IMarketDataService→MarketDataService`), imports (`DatabaseModule`, `EventsModule`), export `IMarketDataService`. *(Tokens: `apps/backend/src/shared/tokens.ts`; boot verified by `market-data.module.spec.ts`.)*
  - File: `apps/backend/src/market-data/market-data.module.ts`
  - Acceptance: `AppModule` boots without DI errors; `IMarketDataService` is injectable from outside the module; `tsc --noEmit` passes.

---

## Phase 2 — Verify (gate before hand-off)

- [X] **T2.1** `→ T1.8` `tsc --noEmit` passes for `libs/shared` + `apps/backend`.
- [X] **T2.2** `→ T1.8` `npm test` (jest) passes: parseKline, cache hit/miss, subscription dedup, reconnect bounded, candle persistence upsert, event publication. *(5 suites / 36 tests, 2026-08-10.)*
- [X] **T2.3** `→ T1.8` Manual smoke (local): set Supabase `DATABASE_URL` → migrate → seed → `npm run start:dev` → `GET /pairs` returns 5 → `GET /candles?...` returns candles → `POST /subscribe` opens a stream → a socket.io client receives `candle:update`. *(Verified live 2026-08-10: boot clean, pairs/candles/subscribe/400-exact-body all pass; socket.io namespace handshake ok. Cache-hit + dedup live re-checks skipped (unit-tested); see note.md §6.)*
- [X] **T2.4** `→ T2.3` Fill `note.md` release/merge checklist (config, env, seed, coordination, known limitations) — see note.md. *(Finalized 2026-08-10; remaining unchecked items: migrations-commit decision, §7 coordination, §8 PR.)*

---

## Dependency summary

```
T0.1 ─┐
T0.2 ─┼─▶ T0.3 ─▶ T0.4
      │
      └─▶ T0.5 ─▶ T0.6 ─▶ T0.7   (P0 GATE — unblock Huy/Phương)
                │
                └─▶ T1.1 ─▶ T1.2
                │   │
                │   └─▶ T1.3 ─▶ T1.4
                │        │   └─▶ T1.5
                │        │   └─▶ T1.6
                │        └─▶ T1.7
                └─▶ T1.8 ─▶ T2.1/T2.2/T2.3 ─▶ T2.4
```

## Notes for the implementing model

- Code to interfaces (`IMarketDataAdapter`, `IMarketDataService`, `IEventBus`) from `@crypto-strategy-lab/shared` — never import `BinanceAdapter` into the service.
- Use constants from `shared/constants.ts` (`BINANCE_WS_BASE`, `BINANCE_REST_BASE`, `RECONNECT_DELAYS_MS`, `MAX_RECONNECT_ATTEMPTS`) — no magic literals (Constitution VI).
- Honor the open questions in `spec.md` §9 + `research.md` §7 (IEventBus token, getCandlesRange ordering) — do not silently decide; if forced, follow the spec's stated default and log it in `note.md`.
- Unit tests must mock Binance (axios/ws) and Prisma — never hit the network in `npm test`.
