# Module Boundaries

## Module Overview

| Module | Owner | Responsibility | Layer | Depends On |
|--------|-------|---------------|-------|------------|
| Market Data | Hoàng | Binance data ingestion, caching, real-time relay | Backend | Shared types |
| Strategy Engine | Huy | Strategy registry, analysis, composition, backtesting, search | Backend | Shared interfaces (`IMarketDataService`, `IEventBus`, `IJobQueue`) |
| News & Sentiment | Thuận | News collection, sentiment analysis (Python), sentiment strategy | Backend | Shared types + `IEventBus` |
| Event Infrastructure | Phương | Event bus, BullMQ/Redis backtest queue, leaderboard, search loop, dashboard BFF | Backend | Shared interfaces (`IBacktester`, `IStrategyGenerator`, `IMarketDataService`) + Redis |
| Frontend | All (shell: Phương) | Dashboard, builder, leaderboard, news feed | Frontend | REST + WebSocket APIs |

## Module Details

### Market Data (Hoàng)
- **Scope**: BinanceAdapter (historical + WebSocket, auto-reconnect), MarketDataService (caching, rate-limit handling), WebSocket Gateway to frontend, shared/ interfaces + Prisma schema
- **Exposes**: `IMarketDataAdapter`, `IMarketDataService`, WebSocket candle stream
- **Dependencies**: None (foundational)
- **Module doc**: `kb/modules/market-data.md`
- **Contracts**: `kb/contracts/market-data.yaml`

### Strategy Engine (Huy)
- **Scope**: StrategyRegistry (register + analyze pipeline), 4 strategies (MA, RSI, Bollinger, Support/Resistance), Composite combiners (MajorityVote, WeightedScore), Backtester + Evaluator, Search generators (Random, Domain-Guided)
- **Exposes**: `IBacktester`, `IStrategyGenerator`, strategy CRUD + backtest REST API
- **Dependencies**: `IMarketDataService`, `IEventBus`, `IJobQueue` interfaces
- **Module doc**: `kb/modules/strategy-engine.md`
- **Contracts**: `kb/contracts/strategy.yaml`

### News & Sentiment (Thuận)
- **Scope**: `INewsProvider` adapters (RSS multi-feeds, LLM-assisted Adaptive Web Crawler with Selector Caching & Self-Healing per ADR-0014), cron collection → normalize → dedupe → store, SentimentClient → isolated Python FastAPI (VADER per ADR-0009), NewsSentimentStrategy plugged into StrategyRegistry (returns HOLD when service is down)
- **Exposes**: News + sentiment REST API, `NewsSentimentStrategy`, `CrawlerRule` configuration
- **Dependencies**: Shared types + `IEventBus`
- **Module doc**: `kb/modules/news-sentiment.md`
- **Contracts**: `kb/contracts/news.yaml`
- **Related ADRs**: `kb/ADR/0009-sentiment-service-as-separate-process.md`, `kb/ADR/0010-news-provider-adapter-pattern.md`, `kb/ADR/0014-llm-assisted-crawler-selector-caching.md`

### Event Infrastructure (Phương)
- **Scope**: events/ (EventEmitter2, typed events), queue/ (BullMQ adapter, Redis-backed job state, BacktestWorker, retry, dead-letter), leaderboard/ (Observer of BacktestCompleted, Top-K), loop/ (search orchestration via events), dashboard/ (BFF composition)
- **Exposes**: `IEventBus`, `IJobQueue`, leaderboard + loop REST/WebSocket APIs
- **Dependencies**: `IBacktester`, `IStrategyGenerator`, `IMarketDataService` interfaces and Redis (the BullMQ worker calls `IMarketDataService.getCandlesRange()` to fetch candles for backtesting)
- **Module doc**: `kb/modules/event-infrastructure.md`
- **Contracts**: `kb/contracts/events.yaml`

## Cross-Module Communication
- Market Data → Event Infrastructure: publishes `MarketDataUpdated` (reserved; not yet consumed — see `kb/contracts/events.yaml`)
- Strategy Engine → Event Infrastructure: awaits `IJobQueue.enqueue` for USER work, then publishes observational `BacktestRequested`
- Event Infrastructure Loop Controller → Job Queue: awaits `IJobQueue.enqueue` for SEARCH_LOOP work, then publishes observational `BacktestRequested`
- Event Infrastructure → Redis: BullMQ persists queue state, priorities, delays, locks, and bounded job history
- Event Infrastructure → Strategy Engine: publishes `BacktestCompleted` / `BacktestFailed`
- Event Infrastructure → Market Data: calls `IMarketDataService.getCandlesRange()` (interface only) from the BullMQ worker to fetch candles for backtesting
- News & Sentiment → Strategy Engine: `SentimentStrategy` registered in StrategyRegistry
- All modules → Frontend: REST + WebSocket only

## Module Boundary Rules
1. Modules communicate through defined contracts and events only — never direct imports
2. No direct database access across module boundaries
3. Shared interfaces go in `shared/` — owned by Hoàng
4. Circular dependencies are forbidden
5. Interface change → update `kb/contracts/` + notify team (same day)
