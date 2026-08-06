# Module Boundaries

## Module Overview

| Module | Owner | Responsibility | Layer | Depends On |
|--------|-------|---------------|-------|------------|
| Market Data | Hoàng | Binance data ingestion, caching, real-time relay | Backend | Shared types |
| Strategy Engine | Member B | Strategy registry, analysis, composition, backtesting, search | Backend | Shared interfaces (`IMarketDataService`, `IEventBus`, `IJobQueue`) |
| News & Sentiment | Thuận | News collection, sentiment analysis (Python), sentiment strategy | Backend | Shared types + `IEventBus` |
| Event Infrastructure | Member D | Event bus, job queue, leaderboard, search loop, dashboard BFF | Backend | Shared interfaces (`IBacktester`, `IStrategyGenerator`) |
| Frontend | All (shell: Member D) | Dashboard, builder, leaderboard, news feed | Frontend | REST + WebSocket APIs |

## Module Details

### Market Data (Hoàng)
- **Scope**: BinanceAdapter (historical + WebSocket, auto-reconnect), MarketDataService (caching, rate-limit handling), WebSocket Gateway to frontend, shared/ interfaces + Prisma schema
- **Exposes**: `IMarketDataAdapter`, `IMarketDataService`, WebSocket candle stream
- **Dependencies**: None (foundational)
- **Module doc**: `kb/modules/market-data.md`
- **Contracts**: `kb/contracts/market-data.yaml`

### Strategy Engine (Member B)
- **Scope**: StrategyRegistry (register + analyze pipeline), 4 strategies (MA, RSI, Bollinger, Support/Resistance), Composite combiners (MajorityVote, WeightedScore), Backtester + Evaluator, Search generators (Random, Domain-Guided)
- **Exposes**: `IBacktester`, `IStrategyGenerator`, strategy CRUD + backtest REST API
- **Dependencies**: `IMarketDataService`, `IEventBus`, `IJobQueue` interfaces
- **Module doc**: `kb/modules/strategy-engine.md`
- **Contracts**: `kb/contracts/strategy.yaml`

### News & Sentiment (Thuận)
- **Scope**: `INewsProvider` adapters (RSS, CryptoPanic), cron collection → normalize → dedupe → store, SentimentClient → isolated Python FastAPI (VADER), SentimentStrategy plugged into Registry (returns HOLD when service is down)
- **Exposes**: News + sentiment REST API, `SentimentStrategy`
- **Dependencies**: Shared types + `IEventBus`
- **Module doc**: `kb/modules/news-sentiment.md`
- **Contracts**: `kb/contracts/news.yaml`

### Event Infrastructure (Member D)
- **Scope**: events/ (EventEmitter2, typed events), queue/ (worker pool, retry, dead-letter), leaderboard/ (Observer of BacktestCompleted, Top-K), loop/ (search orchestration via events), dashboard/ (BFF composition)
- **Exposes**: `IEventBus`, `IJobQueue`, leaderboard + loop REST/WebSocket APIs
- **Dependencies**: `IBacktester`, `IStrategyGenerator` interfaces
- **Module doc**: `kb/modules/event-infrastructure.md`
- **Contracts**: `kb/contracts/events.yaml`

## Cross-Module Communication
- Market Data → Event Infrastructure: publishes `MarketDataUpdated`
- Strategy Engine → Event Infrastructure: publishes `BacktestRequested`
- Event Infrastructure → Strategy Engine: publishes `BacktestCompleted`
- News & Sentiment → Strategy Engine: `SentimentStrategy` registered in StrategyRegistry
- All modules → Frontend: REST + WebSocket only

## Module Boundary Rules
1. Modules communicate through defined contracts and events only — never direct imports
2. No direct database access across module boundaries
3. Shared interfaces go in `shared/` — owned by Hoàng
4. Circular dependencies are forbidden
5. Interface change → update `kb/contracts/` + notify team (same day)
