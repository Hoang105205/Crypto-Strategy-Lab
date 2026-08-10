# note.md — Release / Merge Checklist for `market-data-backend`

> **Owner**: Hoàng | **Feature**: market-data-backend (tasks #1–#7)
> **Purpose**: Everything that must be configured/verified **before** this code is released for teammates to consume or merged into the `develop` branch.
> **Status**: **All code + infra tasks complete (2026-08-10)** — tsc clean, ESLint clean, 36/36 jest, migration + seed applied to **Supabase**, live smoke test passed. Only §7 coordination, §8 PR, and 2 optional smoke checks remain.

---

## 1. Database infrastructure (Supabase — replaces local docker Postgres)

- [x] Supabase project exists and its Postgres instance is active (Supabase Dashboard). *(Verified 2026-08-10: migration applied.)*
- [x] Connection string obtained: Dashboard → **Connect** → **Session mode** (direct connection, port 5432). Do NOT use the transaction pooler (port 6543) — Prisma `migrate dev` needs a direct connection. *(Pitfall fixed: password special chars must be URL-encoded (`@`→`%40`, `#`→`%23`) and the whole value quoted in `.env`, else dotenv truncates at `#`.)*
- [x] Docker is no longer required for this feature. (`docker-compose.yml` still defines a Redis container for the future BullMQ queue — only needed later by Phương.)

## 2. Environment variables (`.env`)

- [x] Env lives at `workspace/apps/backend/.env` (NestJS `ConfigModule` + Prisma both read it from that cwd). Root `workspace/.env` deleted — Turbo does not load env files. **Never commit `.env`** (gitignored).
- [x] `DATABASE_URL` = Supabase **Session mode** connection string + `?schema=public`. Real password in `.env` only.
- [x] `BACKEND_PORT=3001`.
- [x] `BINANCE_API_KEY` / `BINANCE_API_SECRET` — public klines don't strictly require a key, but set them if you have one (raises rate-limit weight). Placeholder left.
- [ ] `NEXT_PUBLIC_API_URL=http://localhost:3001` (frontend will need this later — belongs in the frontend env, not backend).
- [x] Verify: no secrets are hardcoded in source (CONTRIBUTING review checklist). Binance keys read via `ConfigService` only.

## 3. Dependencies

- [x] From `workspace/`: `npm install` (already 0 vulnerabilities per restructure memory).
- [x] Confirm these are present in `apps/backend/package.json` (they are): `axios`, `ws`, `@types/ws`, `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`, `@prisma/client`, `prisma`, `@nestjs/event-emitter`, `@nestjs/config`. **No new deps were added** during implementation.
- [x] `libs/shared` builds (`npm run build -w @crypto-strategy-lab/shared` clean) — it provides `IMarketDataAdapter`, `IMarketDataService`, `IEventBus`, `EventType.MarketDataUpdated`.

## 4. Database migration & seed

- [x] `cd workspace/apps/backend && npx prisma migrate dev --name init_market_data` — migration `20260810005335_init_market_data` applied to **Supabase** 2026-08-10. Creates **all 10 models** of the system schema (Candle, TradingPair, StrategyVersion, BacktestResult, NewsArticle, SentimentScore, LeaderboardEntry, SearchLoopRun, SearchLoopCandidate, DeadLetterJob) — teammates' tables already exist; they do NOT need their own schema migrations.
- [x] `npx prisma generate` — client regenerated 2026-08-10 (Prisma 6.19.3). Note: Prisma warns `package.json#prisma` (seed config) is deprecated in Prisma 7 — migrate to `prisma.config.ts` when upgrading.
- [x] `npx prisma db seed` — ran 2026-08-10, 5 `TradingPair` rows present.
- [x] Commit the generated `prisma/migrations/` folder + `seed.ts` so teammates get the schema by running `prisma migrate deploy` (not `dev`). *(Resolved 2026-08-10: `**/prisma/migrations/` removed from `.gitignore` — migrations are now tracked; include them in the PR.)*

## 5. Build & run

- [x] `npx tsc --noEmit` passes for `libs/shared` and `apps/backend` (T2.1, verified 2026-08-10).
- [x] `npm test` (jest) green — **5 suites / 36 tests** (parseKline REST+WS, REST retry, cache hit/miss/expire, subscription dedup, bounded reconnect, gap recovery, candle upsert, event publish, gateway relay/status/lifecycle, controller endpoints + 400 shape, module DI wiring). **No test hits real Binance** (T2.2, verified 2026-08-10).
- [x] `npm run start:dev` (from `apps/backend`) boots on port 3001 with no DI errors. **Verified live 2026-08-10 against Supabase** (expected `IEventBus not available` warning only).
- [x] CORS: `main.ts` enables CORS for the Next.js origin (`http://localhost:3000`). Socket.io handshake on the `/market-data` namespace verified (`EIO=4` polling returned a sid).

## 6. Smoke test (before PR) — T2.3

- [x] `GET http://localhost:3001/api/market-data/pairs` → 200, 5 `TradingPair` rows. *(Verified 2026-08-10.)*
- [x] `GET http://localhost:3001/api/market-data/candles?symbol=BTCUSDT&timeframe=5m&limit=100` → 200, `Candle[]` (normalized — no Binance field names). *(Verified 2026-08-10.)*
- [ ] `GET .../candles` again within 60s → served from cache (faster / single Binance call). *(Unit-tested; not re-verified live.)*
- [x] `POST /api/market-data/subscribe { "symbol":"BTCUSDT", "timeframe":"5m" }` → 200 `{ status:'subscribed' }`; server log shows `Stream connected: BTCUSDT:5m`; socket.io namespace handshake verified. *(Live candle:update push to a browser client still to be eyeballed when the frontend lands.)*
- [ ] Second identical `subscribe` does NOT open a 2nd Binance stream (subscription dedup). *(Unit-tested; not re-verified live.)*
- [x] `POST /api/market-data/subscribe { "symbol":"FAKESYMBOL", "timeframe":"5m" }` → 400 `{ error: 'Invalid symbol or timeframe' }`. *(Verified exact body 2026-08-10.)*
- [ ] (Optional) Kill the Binance WS externally / block network → observe ≤3 reconnect attempts, then `status:disconnected`.

## 7. Teammate coordination (BLOCKING for downstream work)

- [ ] **Huy (Strategy Engine)**: `IMarketDataService` is exported from `MarketDataModule` and injectable via the `IMARKET_DATA_SERVICE` token (`apps/backend/src/shared/tokens.ts`). Tell him he can now call `getCandles()` / `getCandlesRange()` for the Backtester. Confirm `getCandlesRange` is DB-first + adapter backfill (spec §9 open question) matches his Backtest Worker expectations.
- [ ] **Phương (Event Infrastructure)**: (a) **DI tokens are now defined** in `apps/backend/src/shared/tokens.ts` (`IEVENT_BUS = Symbol('IEventBus')`) — her `EventsModule` should `provide + export` the bus under this token. `MarketDataService` currently injects it optionally and skips publication with a startup warning (graceful degradation, as agreed). (b) Tell her the Job Queue Worker can call `getCandlesRange()` for backtests. (c) Note: `MarketDataUpdated` has **no bus subscribers** in MVP (fire-and-forget) — this is intentional per `events.yaml`.
- [x] If `IEventBus` is NOT yet available from Phương, the implementation degrades gracefully (optional inject + skip+log) so the backend still boots — **implemented & unit-tested** (`market-data.service.spec.ts` — "survives a missing IEventBus"). Flag this as a temporary stub in the PR description.

## 8. Git / PR (per `kb/CONTRIBUTING.md`)

- [ ] Branch: `feature/market-data-backend` (naming: `[feature]/[module]-[short-description]`).
- [ ] Commits: Conventional Commits — e.g. `feat(market-data): add BinanceAdapter historical klines`, `feat(market-data): wire WebSocket gateway + auto-reconnect`, `chore(db): seed trading pairs`.
- [ ] PR target: `develop` (not `main`). Hoàng reviews architecture-impacting PRs.
- [ ] Review checklist (CONTRIBUTING): style ok · no hardcoded secrets · error handling covers adapter/service-down · logging adequate not verbose · `kb/contracts/` unchanged OR updated with team notification · GLOSSARY terms consistent · cross-refs (`modules/`, `flows/`, `ADR/`) intact.
- [ ] Confirm no contract drift: if implementation deviated from `kb/contracts/market-data.yaml`, update the KB + notify team (Constitution V) **before** merge.

## 9. Known limitations / TODOs to communicate

- [ ] `OKXAdapter` extensibility proof is deferred to W4 (task #17) — the DI seam exists now (`IMARKET_DATA_ADAPTER` token), but only `BinanceAdapter` is implemented.
- [ ] Frontend chart components / hooks (tasks #8–#13) are NOT in this PR — frontend consumes the WS/REST only later.
- [ ] **Frontend WS note**: to receive candle pushes, the frontend must connect to socket.io namespace `/market-data` and emit `subscribe { symbol, timeframe }` (joins the per-`symbol:timeframe` room and counts toward dedup). REST `POST /subscribe` opens the Binance stream but does not join a socket room.
- [ ] `status:connected` is emitted optimistically when the first subscriber opens a stream (the `IMarketDataAdapter` contract has no `onConnect` callback); `status:disconnected`/`status:reconnected` come from real adapter events.
- [ ] `getCandlesRange` backfill logic assumes closed candles are persisted; until a stream has run long enough to accumulate closed candles, ranges may be sparse — acceptable for W2.
- [ ] Cache is a simple TTL `Map` (no LRU eviction) — fine for a course project; revisit if memory grows.
- [ ] If `IEventBus` token was stubbed (§7), open a follow-up task to swap the stub for the real `IEventBus` once Phương ships it.

## 10. Definition of Done (merge gate)

All of: §1–§6 checked · §7 coordination messages sent · §8 PR opened to `develop` · §9 limitations written in PR description · `tsc` + `npm test` green.
