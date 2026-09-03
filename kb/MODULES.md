# Module Boundaries

> **Last Updated**: 2026-09-03

## Module Overview

| Module | Owner | Responsibility | Layer | Depends On |
|--------|-------|---------------|-------|------------|
| **Auth** | **Hoàng** | **Supabase Auth integration — JWT verification guard, @CurrentUser() decorator, frontend session management** | **Backend (cross-cutting) + Frontend** | **Supabase Auth service** |
| Market Data | Hoàng | Binance data ingestion, caching, real-time relay | Backend | Shared types |
| Strategy Engine | Huy | Strategy registry, analysis, composition, backtesting, search | Backend | Shared interfaces (`IMarketDataService`, `IEventBus`, `IJobQueue`) |
| News & Sentiment | Thuận | News collection (12-Factor RSS + Adaptive Web Crawler), sentiment analysis (Python VADER), auto-rescoring, sentiment strategy | Backend | Shared types + `IEventBus` |
| Event Infrastructure | Phương | Event bus, BullMQ/Redis backtest queue, leaderboard, search loop, dashboard BFF | Backend | Shared interfaces (`IBacktester`, `IStrategyGenerator`, `IMarketDataService`) + Redis |
| Frontend | All (shell: Phương) | Dashboard, builder, leaderboard, news feed; app-level cross-route leaderboard live state | Frontend | Auth session + REST + shared WebSocket infrastructure |

## Module Details

### Auth (Hoàng)
- **Scope**: SupabaseJwtGuard (verify Supabase JWT), @CurrentUser() decorator (extract userId), frontend @supabase/ssr session management, login/register pages
- **Exposes**: `SupabaseJwtGuard`, `@CurrentUser()`, `RequireAuth` guard — consumed by ALL modules
- **Dependencies**: Supabase Auth service (JWKS endpoint)
- **Module doc**: `kb/modules/auth.md`
- **Contracts**: `kb/contracts/auth.yaml`
- **Related ADRs**: ADR-0015 (Supabase Auth), ADR-0016 (app-level userId filtering)

### Market Data (Hoàng)
- **Scope**: BinanceAdapter (historical + WebSocket, auto-reconnect), MarketDataService (caching, rate-limit handling), WebSocket Gateway to frontend, shared/ interfaces + Prisma schema
- **Exposes**: `IMarketDataAdapter`, `IMarketDataService`, WebSocket candle stream
- **Dependencies**: Auth module (optional — market data is global, no userId filter)
- **Module doc**: `kb/modules/market-data.md`
- **Contracts**: `kb/contracts/market-data.yaml`

### Strategy Engine (Huy)
- **Scope**: StrategyRegistry (register + analyze pipeline), 4 strategies (MA, RSI, Bollinger, Support/Resistance), Composite combiners (MajorityVote, WeightedScore), Backtester + Evaluator, Search generators (Random, Domain-Guided)
- **Exposes**: `IBacktester`, `IStrategyGenerator`, strategy CRUD + backtest REST API
- **Dependencies**: `IMarketDataService`, `IEventBus`, `IJobQueue` interfaces, **Auth module** (`@CurrentUser()` + userId filter on StrategyVersion/BacktestResult queries)
- **Module doc**: `kb/modules/strategy-engine.md`
- **Contracts**: `kb/contracts/strategy.yaml`

### News & Sentiment (Thuận)
- **Scope**: `INewsProvider` adapters (12-Factor RSS multi-feeds, LLM-assisted Adaptive Web Crawler with Selector Caching & Self-Healing per ADR-0014, Data-Driven `COIN_SYNONYMS` dictionary), cron collection → normalize → dedupe → store, SentimentClient → isolated Python FastAPI (VADER per ADR-0009), auto re-scoring for fallback 0.0/NEUTRAL articles (`POST /api/news/rescore`), NewsSentimentStrategy plugged into StrategyRegistry (returns HOLD when service is down)
- **Exposes**: News + sentiment REST API (`GET /api/news`, `GET /api/sentiment/aggregate`, `POST /api/news/crawl`, `POST /api/news/rescore`), `NewsSentimentStrategy`, `CrawlerRule` configuration
- **Dependencies**: Shared types + `IEventBus`
- **Module doc**: `kb/modules/news-sentiment.md`
- **Contracts**: `kb/contracts/news.yaml`
- **Related ADRs**: `kb/ADR/0009-sentiment-service-as-separate-process.md`, `kb/ADR/0010-news-provider-adapter-pattern.md`, `kb/ADR/0014-llm-assisted-crawler-selector-caching.md`

### Event Infrastructure (Phương)
- **Scope**: events/ (EventEmitter2, typed events), queue/ (BullMQ adapter, Redis-backed job state, BacktestWorker, retry, dead-letter), leaderboard/ (Observer of BacktestCompleted, Top-K), loop/ (bounded run orchestration plus persistent 24/7 supervisor/DB lease and database-authoritative bootstrap default), dashboard/ (BFF composition)
- **Exposes**: `IEventBus`, `IJobQueue`, leaderboard + loop REST/WebSocket APIs, operator-authorized Search Loop lifecycle and persistent control APIs
- **Dependencies**: `IBacktester`, `IStrategyGenerator`, `IMarketDataService` interfaces, Redis, PostgreSQL lease/control state, Nest `ConfigModule`, and **Auth module** (`@CurrentUser()` + userId filter on LeaderboardEntry reads; verified identity consumed by `SearchLoopOperatorGuard`). `SearchLoopRun` remains one global system process and is not user-scoped.
- **Module doc**: `kb/modules/event-infrastructure.md`
- **Contracts**: `kb/contracts/events.yaml`
- **Related ADRs**: ADR-0005, ADR-0006, ADR-0011, ADR-0013, ADR-0017, ADR-0018, ADR-0019

## Cross-Module Communication
- Market Data → Event Infrastructure: publishes `MarketDataUpdated` (reserved; not yet consumed — see `kb/contracts/events.yaml`)
- Strategy Engine → Event Infrastructure: awaits `IJobQueue.enqueue` for USER work, then publishes observational `BacktestRequested`
- Event Infrastructure Loop Controller → Job Queue: awaits `IJobQueue.enqueue` for SEARCH_LOOP work, then publishes observational `BacktestRequested`
- Event Infrastructure Search Loop Supervisor → PostgreSQL: materializes a missing desired-state row from the environment once, then treats PostgreSQL as authoritative and atomically acquires/renews the singleton coordination lease before starting bounded runs
- Event Infrastructure Loop Controller → Config: authorizes every global mutation against the deny-by-default `SEARCH_LOOP_OPERATOR_USER_IDS` allowlist
- Event Infrastructure → Frontend: broadcasts system-safe `leaderboard:update`; the app-level provider refetches caller-scoped REST while ON and never filters private broadcast rows client-side
- Event Infrastructure → Redis: BullMQ persists queue state, priorities, delays, locks, and bounded job history
- Event Infrastructure → Strategy Engine: publishes `BacktestCompleted` / `BacktestFailed`
- Event Infrastructure → Market Data: calls `IMarketDataService.getCandlesRange()` (interface only) from the BullMQ worker to fetch candles for backtesting
- News & Sentiment → Strategy Engine: `SentimentStrategy` registered in StrategyRegistry
- All modules → Frontend: REST + WebSocket only

## Module Boundary Rules
1. Modules communicate through defined contracts and events only — never direct imports
2. No direct database access across module boundaries. Cross-module identifiers are logical ID references, not Prisma relations/database foreign keys; lifecycle consistency must use public ports, events, or an owning-module reconciler.
3. Shared interfaces go in `shared/` — owned by Hoàng
4. Circular dependencies are forbidden
5. Interface change → update `kb/contracts/` + notify team (same day)
