# System Architecture

## Architecture Style
**Modular Monolith**

> Rationale: 4 members / 4 weeks. A modular monolith gives clean module
> boundaries and independent development now, with the option to extract modules
> into services later if needed. Microservices would add infrastructure cost
> the team cannot afford within the timeline.

## High-Level Architecture Diagram

```mermaid
graph TD
  FE["Next.js Frontend<br/>Dashboard · Builder · Leaderboard · News"]
  MD["Market Data<br/>(Hoàng)<br/>Binance Adapter"]
  SE["Strategy Engine<br/>(Huy)<br/>Plugin Registry"]
  NW["News & Sentiment<br/>(Thuận)<br/>Python FastAPI"]
  INF["Event Bus + Job Queue<br/>Leaderboard + Loop<br/>(Phương)"]
  DB[("PostgreSQL + Prisma")]
  FE <-->|REST + WebSocket| MD
  FE <-->|REST + WebSocket| SE
  FE <-->|REST| NW
  MD --> INF
  SE --> INF
  NW --> INF
  INF --> DB
```

Modules depend on shared interfaces only — never on each other's implementations.

## Technology Stack
| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Frontend | Next.js (TypeScript) | 15.x | App router dashboard, real-time via WebSocket, `lightweight-charts` for candlesticks |
| Backend | NestJS (TypeScript) | 11.x | Each NestJS module maps to a domain module. Built-in DI, EventEmitter2, WebSocket Gateway |
| Database | PostgreSQL + Prisma | 16 / 6.x | Type-safe ORM, JSONB for flexible strategy params. Connection pooling |
| Module communication | EventEmitter2 | n/a (NestJS built-in) | In-process typed event bus behind `IEventBus` interface (ADR-0005). Swap to Redis Pub/Sub later |
| Extensibility | Strategy Registry + Adapter Pattern | n/a | Plugin arch for strategies (ADR-0003), adapters for data sources (ADR-0004) |
| Sentiment service | Python FastAPI | 0.115+ | Isolated process (ADR-0009); frontend never touches it directly. VADER sentiment model |
| Testing | Jest (backend) + Vitest (frontend) | 29.x / 2.x | Unit tests for business logic, integration tests for API endpoints |
| Monorepo | Turborepo | 2.x | `apps/backend` + `apps/frontend` + `libs/shared`. One `npm install`, one CI pipeline |

## Source Code Structure

```
crypto-strategy-lab/
├── apps/
│   ├── backend/                          # NestJS modular monolith
│   │   ├── src/
│   │   │   ├── shared/                   # Hoàng — shared infrastructure
│   │   │   │   ├── types/                # Candle, Trade, Signal...
│   │   │   │   ├── interfaces/           # IStrategy, IBacktester, IMarketDataAdapter, IEventBus, IJobQueue...
│   │   │   │   └── shared.module.ts
│   │   │   ├── market-data/             # Hoàng — Market Data module
│   │   │   │   ├── adapters/             # BinanceAdapter implements IMarketDataAdapter
│   │   │   │   ├── services/             # MarketDataService (caching, subscription dedup)
│   │   │   │   ├── websocket/            # MarketDataGateway (WS relay to frontend)
│   │   │   │   └── market-data.module.ts
│   │   │   ├── strategy/                # Huy — Strategy Engine (domain logic)
│   │   │   ├── news/                    # Thuận — News & Sentiment module
│   │   │   ├── events/                  # Phương — Event Bus (EventEmitter2 wrapper)
│   │   │   ├── queue/                   # Phương — Job Queue + Worker pool
│   │   │   ├── leaderboard/             # Phương — Leaderboard (Observer)
│   │   │   ├── loop/                    # Phương — Strategy Loop Controller
│   │   │   ├── dashboard/              # Phương — BFF composition layer
│   │   │   └── database/               # Shared — Prisma schema + repositories
│   │   └── test/
│   ├── frontend/                        # Next.js application
│   │   └── src/
│   │       ├── app/                     # App router pages
│   │       ├── components/              # Chart, strategy, leaderboard, news, dashboard components
│   │       ├── hooks/                   # useWebSocket, useMarketData, useLeaderboard, useNews
│   │       └── services/                # REST + WebSocket API clients
│   └── sentiment/                       # Thuận — Python FastAPI sentiment service
│       ├── app.py
│       ├── analyzer.py
│       └── requirements.txt
├── libs/
│   └── shared/                          # Shared TypeScript types & interfaces
│       └── src/
│           ├── types/                   # Candle, Signal, BacktestResult...
│           ├── interfaces/              # IMarketDataAdapter, IStrategy, IEventBus...
│           └── events/                  # Event type definitions
├── kb/                                  # Knowledge Base
├── sdd_artifacts/                       # Per-feature SDD artifacts
├── docker-compose.yml                   # PostgreSQL + Redis (for BullMQ if used)
├── package.json                         # Monorepo root
├── turbo.json                           # Turborepo config
└── README.md
```

## Communication Patterns
- **Client → Server**: REST API (JSON) + WebSocket for real-time charts
- **Module → Module**: EventEmitter2 events (typed events, see `contracts/events`)
- **External**: Binance REST + WebSocket adapters; news providers via adapters; NestJS → Python sentiment via HTTP

## Data Flow

### Realtime Market Data Flow (primary use case)
1. **Binance** → BinanceAdapter (WebSocket stream for `symbol@kline_timeframe`)
2. BinanceAdapter → MarketDataService (normalized `Candle` via `onCandle` callback)
3. MarketDataService → EventBus (publishes `MarketDataUpdated` — reserved for future consumers)
4. MarketDataService → MarketDataGateway (relays candle for WebSocket push)
5. MarketDataGateway → Frontend (emits `candle:update` or `candle:close` on `market-data:candles` channel)
6. Frontend `CandlestickChart` re-renders with the new/updated candle

> See `kb/flows/realtime-market-data.md` for full step-by-step flow with error handling.

### Strategy Backtest Flow (secondary use case)
1. User request → Strategy Engine; search candidate → Loop Controller. The applicable producer generates `jobId` and publishes the complete `BacktestRequested` event (`source=USER` or `source=SEARCH_LOOP`).
2. Job Queue subscribes → preserves the producer-supplied `jobId` → enqueues BACKTEST job → Worker picks it up
3. Worker calls `IMarketDataService.getCandlesRange()` to fetch historical candles
4. Worker calls `IBacktester.run(strategy, candles, config)` → produces `Trade[]`
5. Worker calls `IEvaluator.evaluate(trades, capital)` → produces `EvaluationMetrics`
6. Worker persists `BacktestResult` and publishes `BacktestCompleted` with metrics; on terminal failure it publishes `BacktestFailed` exactly once
7. Leaderboard subscribes → updates Top-K ranking → publishes `LeaderboardUpdated`
8. WebSocket Gateway relays `LeaderboardUpdated` to frontend

> See `kb/flows/strategy-backtest.md` and `kb/flows/strategy-search-loop.md` for full flows.

### News & Sentiment Flow (parallel, independent)
1. Cron job triggers News Service → `INewsProvider` adapters collect articles
2. News Service normalizes + deduplicates → stores `NewsArticle` records
3. SentimentClient calls Python FastAPI `/analyze` → stores `SentimentScore`
4. `NewsSentimentStrategy` reads aggregate sentiment → returns BUY/SELL/HOLD signal
5. If Python service is down → `SentimentStrategy` returns HOLD (graceful degradation)

> See `kb/flows/news-sentiment-pipeline.md` for full flow.

## Security Model
- **Authentication**: None (course project, no user accounts)
- **Authorization**: n/a
- **Data protection**: External API keys in `.env` (never committed); rate-limit handling in adapters

## Deployment Topology

### Development (W1–W4)
- **Backend**: NestJS dev server (`npm run dev:backend`) — runs on `localhost:3001`
- **Frontend**: Next.js dev server (`npm run dev:frontend`) — runs on `localhost:3000`
- **Database**: PostgreSQL via `docker-compose up` — runs on `localhost:5432`
- **Sentiment Service**: Python FastAPI (`python -m uvicorn app:app`) — runs on `localhost:8000`
- **All 4 processes** run locally on the developer's machine. Turborepo orchestrates parallel startup.

### Production (if deployed for demo)
- **Option A (simplest)**: Single VPS running all processes via `docker-compose` (NestJS + Next.js + PostgreSQL + Python)
- **Option B (if needed)**: Vercel for Next.js frontend, Railway/Fly.io for NestJS backend, managed PostgreSQL
- **Not a concern for grading**: The spec focuses on architecture quality, not production deployment. Local dev is sufficient for the demo.

### Scalability Path (not built, documented for interview)
- If backtesting needs to scale from 100 → 100,000 candidates: swap in-memory queue → BullMQ/Redis (ADR-0012), add worker processes
- If real-time data needs to scale: swap EventEmitter2 → Redis Pub/Sub (ADR-0005), extract Market Data as a separate service
- These are migration paths, not current architecture — see ADR-0002 (Modular Monolith) for rationale
