# Crypto Strategy Lab — Project Plan

> **Version**: 3.0  
> **Author**: LƯU, Huy Hoàng (Leader / Architect / Fullstack)  
> **Team**: 4 fullstack members, 4 weeks  
> **Date**: 2026-08-04

---

## 1. Project Overview

**Crypto Strategy Lab** — A platform for analyzing, combining, and evaluating crypto trading strategies. The system ingests real-time market data from Binance, provides multi-timeframe candlestick charts, allows composing individual strategies into composite strategies, backtests them on historical data, ranks them on a leaderboard, and runs a continuous search loop to discover better strategy combinations.

**The core thesis**: Architecture quality over trading profitability. The grading criterion is whether new strategies, new search algorithms, new data providers, and new sentiment models can be added with minimal code changes — demonstrating modifiability, scalability, and extensibility.

---

## 2. Architecture-First Design Decisions

These are **my decisions as the architect**. The team implements within these boundaries.

### 2.1 Architecture Style & Tech Stack

| Decision | Choice | Rationale |
|---|---|---|
| **Architecture** | Modular Monolith | 4 people, 4 weeks. Clean module boundaries now, option to extract services later. |
| **Backend** | NestJS (TypeScript) | Modular by design — each NestJS module maps to our domain module. Built-in DI, event emitter, WebSocket gateway. Enforces clean boundaries. |
| **Frontend** | Next.js (TypeScript) | SSR + client-side interactivity. App router for dashboard pages. Real-time via WebSocket. |
| **Monorepo** | Single repo, `apps/backend` + `apps/frontend` + `libs/shared` | Shared types between NestJS and Next.js. One `npm install`, one CI pipeline. |
| **Event-Driven** | NestJS EventEmitter2 (in-process) | Modules communicate through events. Backtester publishes `BacktestCompleted`, Leaderboard reacts. Swap to Redis Pub/Sub later if needed. |
| **Plugin Arch** | Strategy Registry + Adapter Pattern | `StrategyRegistry.register(strategy)` — one file + one call to add a strategy. `MarketDataAdapter` interface for data sources. |
| **Database** | PostgreSQL + Prisma | Type-safe ORM. Relational model fits our data (candles, trades, experiments). JSONB for flexible strategy params. |
| **Realtime** | NestJS WebSocket Gateway → Next.js client | Binance WS → Backend → Frontend. No polling. |
| **Sentiment** | Python FastAPI (separate process) | Python ML ecosystem (transformers, VADER). Backend calls it via HTTP. Frontend never touches it. |

### 2.2 High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       Next.js Frontend                            │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐ │
│  │  Dashboard  │ │  Strategy   │ │ Leaderboard│ │  News Feed   │ │
│  │  (4 charts) │ │  Builder    │ │   Panel    │ │ + Sentiment  │ │
│  └──────┬──────┘ └──────┬─────┘ └──────┬─────┘ └──────┬───────┘ │
│         └───────────────┴──────────────┴──────────────┘         │
│                    REST API + WebSocket                           │
└───────────────────────────┬──────────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────────┐
│                    NestJS Backend                                  │
│                            │                                       │
│  ┌──────────────┐  ┌──────┴───────┐  ┌──────────────┐           │
│  │ Market Data   │  │  Strategy    │  │    News      │           │
│  │   Module      │  │  Engine      │  │   Module     │           │
│  │              │  │              │  │              │           │
│  │ Binance      │  │ Registry     │  │ Providers    │           │
│  │ Adapter      │  │ Plugin Arch  │  │ (RSS, API)   │           │
│  │ WebSocket    │  │ Composite    │  │              │           │
│  │ Gateway      │  │ Backtester   │  │ Sentiment    │           │
│  │ Historical   │  │ Evaluator    │  │ Client ──────┼───────────┼──→ Python
│  │ Service      │  │ Search       │  │              │           │    FastAPI
│  │     (Hoàng)  │  │   (Member B) │  │  (Member C)  │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                  │                    │
│  ┌──────┴─────────────────┴──────────────────┴───────────────┐  │
│  │         Event Bus + Job Queue + Leaderboard               │  │
│  │         Continuous Loop + Dashboard API                   │  │
│  │                      (Phương)                           │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────┴────────────────────────────────────┐  │
│  │              Prisma / PostgreSQL                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 Module Dependency Graph (Independent Workflow)

Each member owns a NestJS module + its corresponding Next.js pages end-to-end (fullstack). Modules depend on **shared interfaces only**, never on each other's implementations:

```
                    ┌─────────────┐
                    │   Next.js    │
                    │   Frontend   │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                  ▼
┌────────────┐  ┌───────────┐  ┌──────────┐
│ Market Data │  │ Strategy  │  │   News   │
│   Module    │  │  Engine   │  │  Module  │
│             │  │           │  │          │
│ (Hoàng)     │  │(Member B) │  │(Member C)│
└──────┬──────┘  └─────┬─────┘  └────┬─────┘
       │               │              │
       │  ┌────────────┴──────────┐   │
       │  │ Shared Types          │   │
       │  │ & Interfaces (Hoàng)  │◄──┘
       │  └───────────────────────┘
       │            │
       ▼            ▼
┌───────────────────────────────┐
│   Event Bus + Job Queue       │
│   + Leaderboard + Loop        │
│        (Phương)             │
└───────────────┬───────────────┘
                ▼
        ┌──────────────┐
        │  PostgreSQL  │
        └──────────────┘
```

### 2.4 Core Architectural Drivers

| Driver | How We Address It |
|---|---|
| **Modifiability** | Plugin Architecture for strategies, Adapter Pattern for data sources, NestJS modules enforce boundaries |
| **Scalability** | Job Queue + Worker pattern for backtesting. NestJS EventEmitter2 → swap to Redis + BullMQ later. |
| **Realtime** | Binance WS → NestJS WebSocket Gateway → Next.js client. Event-driven updates (no polling). |
| **Reliability** | Binance adapter auto-reconnect + retry. Backtest workers have retry logic. News module failure isolated. |
| **Performance** | Backtest worker pool. Prisma connection pooling. Next.js SSR for initial load, client-side for real-time. |
| **Maintainability** | NestJS module boundaries. Event bus decouples modules. Search algorithm independent of Backtesting implementation. |
| **Observability** | Loop status endpoint, worker health, strategy count tracking, leaderboard update events via WebSocket. |

---

## 3. Knowledge Base (KB) Ownership

The KB is the single source of truth. Each file has a clear owner responsible for creating and maintaining it.

### 3.1 KB File Ownership

| KB File | Owner | Responsibility |
|---|---|---|
| `kb/INDEX.md` | **Hoàng** | Maintain the sitemap, reading order, scope coverage |
| `kb/CONSTITUTION.md` | **Hoàng** | Define non-negotiable principles, coding standards, testing gates |
| `kb/ARCHITECTURE.md` | **Hoàng** | High-level system architecture, tech stack, data flow, deployment topology |
| `kb/MODULES.md` | **Hoàng** | Module boundaries, responsibilities, dependencies, cross-module communication |
| `kb/DESIGN.md` | **Phương** (with Hoàng review) | FE/UX design system — component library, color palette, typography, routing, page layout |
| `kb/GLOSSARY.md` | **Hoàng** (initial) → all members contribute | Domain terms, naming conventions (everyone adds terms for their module) |
| `kb/CONTRIBUTING.md` | **Hoàng** | Git workflow, commit conventions, PR process, code style, review checklist |
| `kb/ADR/` | **Hoàng** (core ADRs) + module owner (module-specific ADRs) | Architecture decisions. Core ADRs (monolith choice, plugin arch, event-driven) by Hoàng. Module-specific ADRs by the module owner. |
| `kb/contracts/` | **Each module owner** writes their own, **Hoàng reviews** | `market-data.contract.md` → Hoàng, `strategy.contract.md` → Member B, `news.contract.md` → Member C, `events.contract.md` → Phương |
| `kb/modules/` | **Each module owner** writes their own, **Hoàng reviews** | Per-module detailed architecture. `modules/market-data.md` → Hoàng, `modules/strategy-engine.md` → Member B, `modules/news-sentiment.md` → Member C, `modules/event-infrastructure.md` → Phương |
| `kb/flows/` | **Flow owner** (primary module owner), **Hoàng reviews** | E2E business use case flows. `flows/realtime-market-data.md` → Hoàng, `flows/strategy-backtest.md` → Member B, `flows/strategy-search-loop.md` → Phương, `flows/news-sentiment-pipeline.md` → Member C, `flows/composite-with-sentiment.md` → Member B, `flows/leaderboard-update.md` → Phương |
| `kb/patterns/` | **Hoàng** (initial) → any member can add | Design patterns used (Strategy, Adapter, Observer, Registry, etc.) |

### 3.2 KB Maintenance Rules

1. **Create in W1, update throughout**: All KB files are created in Week 1. Updated as architecture evolves.
2. **Owner creates, architect reviews**: Each owner drafts their KB files. Hoàng reviews all KB files for consistency.
3. **Contracts are the SSoT**: When module B needs data from module A, it reads module A's contract — never its source code.
4. **ADR for every decision**: Any non-trivial tech choice must have an ADR. Core ADRs by Week 1 Friday.
5. **GLOSSARY is shared**: Hoàng seeds it, but every member must add terms for their domain during development.
6. **Update on change**: If a module changes its interface, the owner must update their contract and notify the team.

---

## 4. Team Assignment & Module Ownership

### 4.1 Roles

| Member | Role | Fullstack Module | Coding Weight |
|---|---|---|---|
| **Hoàng (Leader)** | Architect / Fullstack | **Market Data** (NestJS module + Next.js pages) + **Shared Infrastructure** (types, DB, Prisma, WebSocket gateway) | Medium-High — data spine + infrastructure |
| **Member B** | Fullstack Engineer | **Strategy Engine** (NestJS domain logic + Next.js pages) | Full |
| **Member C** | Fullstack Engineer | **News & Sentiment** (NestJS module + Python service + Next.js pages) | Full |
| **Phương** | Fullstack Engineer | **Event Architecture + Backtest Infrastructure + Dashboard** (Event Bus, Job Queue, Leaderboard, Loop Controller, Dashboard API + Next.js pages) | Full |

### 4.2 Interview Architecture Focus

Every member must be able to explain **at least 2 architectural patterns** they personally designed and implemented. This is critical for the course interview — the grading targets architecture understanding, not just CRUD.

| Member | Primary Architecture Patterns | What They Explain in Interview |
|---|---|---|
| **Hoàng** | Adapter Pattern, Modular Monolith boundaries, System decomposition | "I designed the system as a modular monolith. Each NestJS module has clean boundaries. I implemented the Binance Adapter — if you want to add OKX, you create one class implementing `IMarketDataAdapter`. The adapter pattern means the frontend and strategy engine never know which data source is active. I also defined the shared type system that all modules depend on." |
| **Member B** | Plugin Architecture (Strategy Registry), Composite Pattern | "I built the Strategy Plugin System. Adding a new strategy requires only one file and one `register()` call — zero changes to the backtester, evaluator, or leaderboard. The Registry implements the Open-Closed Principle. I also designed the Composite Strategy pattern — you can combine any N strategies using different combiners (Majority Vote, Weighted Score), and the system treats a composite the same as a single strategy." |
| **Member C** | Adapter Pattern (News Providers), Process Isolation & Fault Tolerance | "I designed the News Adapter Pattern — adding a new news source is one class implementing `INewsProvider`. I also isolated the Sentiment service as a separate Python process. If it crashes, the main NestJS server stays up. The `SentimentStrategy` returns HOLD when the service is unavailable — graceful degradation. The frontend never talks to Python directly; communication goes through NestJS, enforcing process boundaries." |
| **Phương** | Event-Driven Architecture, Job Queue/Worker Pattern, Observer Pattern (Leaderboard) | "I designed the Event-Driven communication between modules. The Backtester publishes `BacktestCompleted`, and the Leaderboard subscribes — they're completely decoupled through the event bus. I built the Job Queue for parallel backtesting with retry logic and dead-letter handling. The Leaderboard is an Observer — it reacts to events, never calls the backtester directly. The Strategy Loop Controller orchestrates the search cycle through events, not direct method calls." |

### 4.3 Detailed Module Assignment

#### Hoàng — Market Data Module + Shared Infrastructure

**Architectural contribution**: Adapter Pattern for data sources. System decomposition. Monorepo shared infrastructure.

**Backend (NestJS)**:
| Component | Description |
|---|---|
| `shared/` module | TypeScript interfaces, constants, Prisma schema, DB migrations |
| `market-data/` module | BinanceAdapter (historical + WebSocket), MarketDataService, caching, auto-reconnect |
| `market-data.gateway.ts` | WebSocket Gateway that relays Binance data to frontend clients |
| Prisma schema + migrations | All database tables (candles, strategies, experiments, trades, news, leaderboard) |

**Frontend (Next.js)**:
| Component | Description |
|---|---|
| `app/page.tsx` | Main dashboard with 4-chart grid layout |
| `components/chart/CandlestickChart.tsx` | Candlestick chart with lightweight-charts |
| `components/chart/MultiTimeframeGrid.tsx` | 4-chart grid with per-chart timeframe selector |
| `components/chart/ChartOverlay.tsx` | MA, Bollinger, SR overlays, buy/sell signals |
| `hooks/useWebSocket.ts` | WebSocket connection hook |
| `hooks/useMarketData.ts` | Market data fetching + real-time updates hook |

**KB Ownership**: INDEX, CONSTITUTION, ARCHITECTURE, MODULES, CONTRIBUTING, core ADRs, contracts/market-data, patterns, **modules/market-data.md**, **flows/realtime-market-data.md**

---

#### Member B — Strategy Engine Module (Domain Logic)

**Architectural contribution**: Plugin Architecture (Strategy Registry). Composite Pattern. Open-Closed Principle.

Member B owns **the domain logic** of strategy analysis, composition, and search. They USE the event bus (publish events) and the job queue (submit backtest jobs), but don't own the infrastructure.

**Backend (NestJS)**:
| Component | Description |
|---|---|
| `strategy/registry/` | StrategyRegistry, IStrategy interface, `register()`, `analyze()` pipeline |
| `strategy/strategies/` | MAStrategy, RSIStrategy, BollingerBandsStrategy, SupportResistanceStrategy |
| `strategy/composite/` | CompositeStrategy, MajorityVoteCombiner, WeightedScoreCombiner |
| `strategy/backtest/` | Backtester (historical replay, trade simulation), BacktestResult — the **execution logic** |
| `strategy/evaluation/` | Evaluator (Return, WinRate, MDD, Sharpe, ProfitFactor) |
| `strategy/search/` | SearchEngine, IStrategyGenerator, RandomGenerator, DomainGuidedGenerator |
| `strategy/versioning/` | Strategy version tracking, experiment reproducibility |

**Frontend (Next.js)**:
| Component | Description |
|---|---|
| `app/strategy/page.tsx` | Strategy builder page — select strategies, configure params, compose |
| `components/strategy/StrategyCard.tsx` | Individual strategy display with parameters |
| `components/strategy/ParameterEditor.tsx` | Edit strategy parameters (MA periods, RSI thresholds) |
| `components/strategy/CompositeBuilder.tsx` | Drag/combine strategies into composites |
| `components/strategy/TradeTable.tsx` | Trade detail table with P&L |

**KB Ownership**: contracts/strategy, ADRs for Plugin Architecture (ADR-003 co-author), Strategy Versioning, **modules/strategy-engine.md**, **flows/strategy-backtest.md**, **flows/composite-with-sentiment.md**

---

#### Member C — News & Sentiment Module

**Architectural contribution**: Adapter Pattern for news providers. Process Isolation (Python service). Fault Tolerance & Graceful Degradation.

**Backend (NestJS)**:
| Component | Description |
|---|---|
| `news/providers/` | INewsProvider interface, RSS adapter, CryptoPanic adapter |
| `news/services/` | NewsService (collection, normalization, deduplication), SentimentClient |
| `news/strategies/` | SentimentStrategy (implements IStrategy, returns HOLD when service is down) |
| `news/cron/` | Scheduled news collection (NestJS @Cron) |

**Python Sentiment Service**:
| Component | Description |
|---|---|
| `sentiment/app.py` | FastAPI endpoint: POST /analyze |
| `sentiment/analyzer.py` | VADER or HuggingFace transformer |
| `sentiment/models.py` | Request/response schemas |

**Frontend (Next.js)**:
| Component | Description |
|---|---|
| `app/news/page.tsx` | News feed page with sentiment indicators |
| `components/news/NewsFeed.tsx` | News article list with sentiment badges |
| `components/news/SentimentChart.tsx` | Sentiment timeline visualization (POSITIVE/NEGATIVE/NEUTRAL over time) |
| `components/news/SentimentGauge.tsx` | Current aggregate sentiment gauge |

**KB Ownership**: contracts/news, ADRs for News Adapter Pattern, Sentiment Service Isolation, **modules/news-sentiment.md**, **flows/news-sentiment-pipeline.md**

---

#### Phương — Event Architecture + Backtest Infrastructure + Dashboard

**Architectural contribution**: Event-Driven Architecture (Event Bus). Job Queue/Worker Pattern. Observer Pattern (Leaderboard). Front-End Architecture.

Phương owns the **"nervous system"** of the application — the event bus, the job queue, the leaderboard (as an observer), and the strategy loop controller (as an orchestrator). These are not CRUD — they are core architectural infrastructure that every module depends on. Phương also owns the Dashboard frontend (the "display") that composes data from all modules.

**Backend (NestJS)**:
| Component | Description | Architecture Pattern |
|---|---|---|
| `events/` module | EventEmitter2 setup, all event type definitions, event flow documentation | **Event-Driven Architecture** |
| `queue/` module | Job queue (BullMQ or in-memory), worker pool, retry logic, dead-letter queue | **Job Queue/Worker Pattern** |
| `leaderboard/` module | LeaderboardService (subscribes to `BacktestCompleted`), Top-K ranking, scoring formula | **Observer Pattern** |
| `loop/` module | StrategyLoopController (generate → queue → evaluate → rank → repeat via events, not direct calls) | **Orchestrator Pattern** |
| `dashboard/` module | API composition layer — REST endpoints that aggregate data from all modules for dashboard views | **API Composition / BFF** |

**Frontend (Next.js)**:
| Component | Description |
|---|---|
| `app/layout.tsx` | App shell, navigation, WebSocket provider |
| `components/dashboard/DashboardGrid.tsx` | Main layout, chart grid orchestration |
| `components/dashboard/PairSelector.tsx` | Trading pair selector |
| `components/dashboard/TimeframeSelector.tsx` | Timeframe picker per chart |
| `components/dashboard/LoopStatusPanel.tsx` | Search loop status (# candidates, current, progress, start/stop/pause) |
| `components/dashboard/StatusIndicator.tsx` | WebSocket connection status, Binance connection |
| `components/leaderboard/LeaderboardTable.tsx` | Sortable ranking table (by Return, WinRate, MDD, Sharpe) |
| `components/leaderboard/StrategyDetail.tsx` | Strategy metrics + trade list drill-down |
| `app/leaderboard/page.tsx` | Leaderboard page |
| `components/common/` | WebSocketProvider, LoadingState, ErrorBoundary, shared UI components |
| Design system (DESIGN.md) | Color palette, typography, spacing, component library |

**KB Ownership**: contracts/events, DESIGN.md, ADRs for Event-Driven Architecture (ADR-005 co-author), Job Queue Pattern, Leaderboard as Observer, **modules/event-infrastructure.md**, **flows/strategy-search-loop.md**, **flows/leaderboard-update.md**

---

### 4.4 How Modules Communicate (Phương's Architecture)

This section explains the **event-driven communication** that Phương designs. Understanding this is essential for the interview.

```
┌─────────────┐    MarketDataUpdated    ┌──────────────┐
│  Market Data │ ──────────────────────→ │   Strategy   │
│   (Hoàng)    │                         │   Engine     │
└─────────────┘                         │  (Member B)  │
                                        └──────┬───────┘
                                               │
                            BacktestRequested  │  (submit job)
                                               ▼
                                        ┌──────────────┐
                                        │    Job Queue  │
                                        │  (Phương)   │
                                        └──────┬───────┘
                                               │
                            worker completes    │  BacktestCompleted
                                               ▼
┌─────────────┐    BacktestCompleted    ┌──────────────┐
│   News       │                        │  Leaderboard │
│  (Member C)  │                        │  (Phương)  │──→ LeaderboardUpdated
└─────────────┘                        └──────┬───────┘    (WebSocket push)
                                               │
                            loop checks stop   │
                            conditions         ▼
                                        ┌──────────────┐
                                        │  Loop Control │
                                        │  (Phương)   │──→ BacktestRequested
                                        └──────────────┘    (next candidate)
```

**Key point**: Module B (Strategy) and Module D (Infrastructure) never call each other's methods directly. They communicate through events and the job queue. This is the **Event-Driven Architecture** that Phương owns.

---

### 4.5 Independence Analysis

| Module | Backend | Frontend | Depends On | Can Run Alone? |
|---|---|---|---|---|
| **Shared** (Hoàng) | Types, Prisma | — | Nothing | ✅ (foundation) |
| **Market Data** (Hoàng) | NestJS module + WS Gateway | Chart pages, hooks | Shared types only | ✅ with mock data |
| **Strategy Engine** (Member B) | NestJS module (domain logic) | Strategy Builder page | Shared types + `IMarketDataService` interface + `IEventBus` interface + `IJobQueue` interface | ✅ with mock data and mock queue |
| **News & Sentiment** (Member C) | NestJS module + Python service | News + Sentiment pages | Shared types + `IEventBus` interface | ✅ fully independent |
| **Event Arch + Dashboard** (Phương) | Event Bus, Queue, Leaderboard, Loop, Dashboard API | Dashboard, Leaderboard, Layout, Common | Shared types + `IBacktester` interface (for queue worker) + `IStrategyGenerator` interface (for loop) | ✅ with mock backtester |

**Key independence points**:
- **Member B** never touches `news/`, `events/`, `queue/`, or `leaderboard/` code. They just `publish('BacktestRequested', payload)` and the queue picks it up.
- **Member C** never touches `strategy/`, `events/`, `queue/`, or `leaderboard/` code. `SentimentStrategy` implements `IStrategy` from shared types only.
- **Phương** never touches `strategy/strategies/` or `news/providers/` code. They consume interfaces (`IStrategy`, `IBacktester`) through shared types.
- **Hoàng** builds the data spine (market data + shared infra) that others plug into through interfaces.

---

## 5. Weekly Plan

### Week 1: Foundation — KB, Architecture, Setup, Skeletons

**Goal**: Shared understanding, project skeleton, contracts defined, each module has a running skeleton with correct boundaries.

| Day | Hoàng (Leader) | Member B (Strategy) | Member C (News) | Phương (Event + Dashboard) |
|---|---|---|---|---|
| **Mon** | Initialize KB (`/hoang-kb-init`). Set up monorepo: NestJS + Next.js + shared lib. Define all shared types and interfaces. | Read KB, study spec. Understand `IStrategy`, `IBacktester`, `IEvaluator`, `ISearchEngine` contracts. | Read KB, study spec. Understand `INewsProvider`, `ISentimentClient` contracts. | Read KB, study spec. Understand Event-Driven Architecture, Observer Pattern, Job Queue Pattern. Study NestJS EventEmitter2 docs. |
| **Tue** | Write ARCHITECTURE.md, MODULES.md, CONSTITUTION.md, CONTRIBUTING.md. Set up Prisma schema + DB. Initialize NestJS module structure. | Scaffold Strategy Engine NestJS module. Create `strategy.registry.ts`, empty `IStrategy` implementations. Prove `register(MAStrategy)` works. | Scaffold News NestJS module. Create `INewsProvider` interface, empty `NewsService`. Scaffold Python FastAPI service with `/analyze` stub. | Scaffold Next.js App Router. Create layout, navigation, WebSocket provider. Set up chart grid with empty panels. Scaffold `events/` NestJS module with EventEmitter2 config. |
| **Wed** | Write ADR-001 (Modular Monolith), ADR-002 (Plugin Architecture), ADR-003 (Event-Driven), ADR-004 (Adapter Pattern). Define shared event type interfaces. | Implement `MAStrategy` (first real strategy). Prove Registry + analyze() pipeline end-to-end with mock data. | Implement first `INewsProvider` (RSS adapter). Prove collection → normalization → storage pipeline with mock data. | Implement `CandlestickChart` component with lightweight-charts and mock candle data. Implement EventEmitter2 wrapper. Define all event types (`MarketDataUpdated`, `BacktestRequested`, `BacktestCompleted`, `LeaderboardUpdated`). Write `events.contract.md`. |
| **Thu** | Implement `BinanceAdapter` (historical API first). `MarketDataService` with caching. Prisma migrations. Write `market-data.contract.md`. | Implement `RSIStrategy`, `BollingerBandsStrategy`, `SupportResistanceStrategy`. Write `strategy.contract.md`. | Implement Python sentiment service (VADER). Wire `SentimentClient` in NestJS. Prove: RSS news → analyze → score. Write `news.contract.md`. | Implement `MultiTimeframeGrid` — 4 charts, independent timeframes. Real-time chart updates with mock WebSocket. **Scaffold Job Queue**: in-memory queue with worker stub, `IJobQueue` interface. Write DESIGN.md. |
| **Fri** | **Architecture Review Day**: All members merge skeletons. Validate contracts. Verify module boundaries. Each member presents their filled `kb/modules/{name}.md` and `kb/flows/{name}.md` files. Integration test: market data → event bus → chart renders. Write ADR-005 (Job Queue for Backtesting). Update KB. | Demo 4 strategies producing signals. Verify `register(newStrategy)` requires zero changes elsewhere. Present `modules/strategy-engine.md` + `flows/strategy-backtest.md`. | Demo news collection + sentiment analysis pipeline. Verify `SentimentStrategy` can plug into `StrategyRegistry`. Present `modules/news-sentiment.md` + `flows/news-sentiment-pipeline.md`. | Demo: event bus relaying events between mock publishers/subscribers. 4-chart dashboard with mock real-time data. Present DESIGN.md + `modules/event-infrastructure.md` + `flows/leaderboard-update.md`. |

**W1 Deliverables**:
- ✅ KB fully populated (all files with assigned owners, including `modules/` and `flows/` directories)
- ✅ Monorepo: `apps/backend` (NestJS) + `apps/frontend` (Next.js) + `libs/shared`
- ✅ Shared types & interfaces package published
- ✅ Prisma schema + migrations deployed
- ✅ REST + WebSocket API contracts documented
- ✅ Each NestJS module has running skeleton with correct boundaries
- ✅ 4 strategies producing signals via Registry
- ✅ News pipeline collecting + analyzing
- ✅ Event bus relaying events between modules
- ✅ Chart dashboard rendering with mock data
- ✅ 5 ADRs written

---

### Week 2: Core Implementation

**Goal**: Each module implements core logic. Real Binance data flows. Strategies can be backtested. News can be collected. Job queue processes backtests. Leaderboard reacts to events.

| Day | Hoàng (Leader) | Member B (Strategy) | Member C (News) | Phương (Event + Dashboard) |
|---|---|---|---|---|
| **Mon–Tue** | Implement **Binance WebSocket** (realtime). **WebSocket Gateway** (backend → frontend relay). Auto-reconnect + error handling. | Implement **Backtester**: replay historical candles → simulate trades → produce `BacktestResult`. Implement **Evaluator**: compute metrics (Return, WinRate, MDD, Sharpe, Trades). | Implement **CryptoPanic adapter** (second news source). Implement **news cron job** (scheduled collection). Wire end-to-end: cron → collect → normalize → store → analyze → store sentiment. | Implement **Job Queue**: BullMQ or in-memory queue with worker pool. Worker receives `BacktestRequested` → calls `IBacktester.execute()` → publishes `BacktestCompleted`. Retry logic (3 attempts, exponential backoff) + dead-letter queue. Implement **real-time candle updates** on frontend. |
| **Wed–Thu** | Integration: verify market data flows from Binance → Backend → WebSocket → Frontend chart renders live candles. Write ADR-006 (Auto-Reconnect). | Implement **CompositeStrategy**: combine N strategies. **MajorityVoteCombiner** + **WeightedScoreCombiner**. Implement **Search Engine**: `RandomGenerator`, `DomainGuidedGenerator`. | Implement **SentimentStrategy** as a plugin: `register(SentimentStrategy)`. Verify `MA + RSI + Sentiment` composite works. Polish error handling (news service down = strategy returns HOLD). | Implement **Leaderboard**: subscribe to `BacktestCompleted` → compute ranking → store → publish `LeaderboardUpdated`. Top-K ranking, configurable scoring formula. Implement **Strategy Builder UI**: select strategies, configure parameters, compose composites. |
| **Fri** | **Integration Review**: Binance data live. WebSocket relay working. Event bus delivering events across modules. Update KB. | Demo complete backtest pipeline: strategy → submit job to queue → backtester runs → evaluator computes metrics. Demo composite strategy. | Demo end-to-end: news → sentiment → SentimentStrategy in composite. | Demo: backtest job submitted → queue processes → `BacktestCompleted` event → leaderboard auto-updates. Leaderboard UI rendering. |

**W2 Deliverables**:
- ✅ Real-time Binance data flowing to frontend
- ✅ 4 strategies + SentimentStrategy producing signals
- ✅ Backtester producing trade results on historical data
- ✅ Evaluator computing all required metrics
- ✅ Composite strategy working (Majority Vote + Weighted)
- ✅ Job Queue processing backtest jobs with retry + dead-letter
- ✅ Leaderboard subscribing to BacktestCompleted events
- ✅ News pipeline: 2 providers + scheduled collection + sentiment
- ✅ Strategy Builder UI functional

---

### Week 3: Integration & Advanced Features

**Goal**: Strategy loop, full event flow, visualization, end-to-end integration.

| Day | Hoàng (Leader) | Member B (Strategy) | Member C (News) | Phương (Event + Dashboard) |
|---|---|---|---|---|
| **Mon–Tue** | Integration: wire Market Data → Strategy Engine. Verify backtest runs with real historical data. | Implement **Strategy Versioning**: strategies have version numbers. Experiments linked to strategy versions. Reproducibility. Domain-guided search: group strategies (Trend, Momentum, Volatility, Structure, Sentiment), enforce diverse composites. | Integration: test `SentimentStrategy` in real composites with live market data. Add **news deduplication**. Add **sentiment aggregation** (average sentiment per time window). Polish Python service error handling. | Implement **Strategy Loop Controller**: generate candidate → submit `BacktestRequested` → queue processes → `BacktestCompleted` → evaluate → rank → check stop conditions → repeat. All through events, not direct calls. Implement **Leaderboard UI**: sortable table (by Return, WinRate, MDD, Sharpe). Click strategy → see detail. |
| **Wed–Thu** | Integration: verify full event flow: MarketDataUpdated → Strategy → BacktestRequested → [queue] → BacktestCompleted → LeaderboardUpdated → WebSocket → Frontend. Implement **loop status API**. Integration test: full flow from data → strategy → backtest → leaderboard → UI. | Polish strategy implementations. Ensure all strategies produce consistent signal format. Verify domain-guided search generates diverse composites. | Integration: verify news module failure doesn't crash charts or strategy engine. Test `SentimentStrategy` with `HOLD` fallback when news service is down. Polish news display. | Implement **Loop Status Panel**: candidates tested, current candidate, progress bar, start/stop/pause buttons. Implement **Trade Visualization**: buy/sell markers on chart, entry/exit annotation. Implement **Trade Detail Table**: entry/exit prices, P&L per trade. Click trade → highlight on chart. Dashboard API composition layer. |
| **Fri** | **End-to-End Demo Day**: Full flow — user selects pair, selects strategies, starts search, leaderboard updates in real-time. Fix integration bugs. Update KB. Write ADR-007 (Strategy Versioning), ADR-008 (Event-Driven Communication). | Demo search loop running. Strategy versioning working. Verify extensibility: add dummy strategy → `register()` only. | Demo `SentimentStrategy` in search loop. News UI showing sentiment timeline. Verify fault tolerance: kill Python service → SentimentStrategy returns HOLD. | Demo: full event flow visible in logs. Leaderboard auto-updating. Loop status panel with real-time progress. Trade visualization on charts. |

**W3 Deliverables**:
- ✅ Composite strategy combining any N strategies
- ✅ Strategy Search Engine (Random + Domain-Guided)
- ✅ Continuous Strategy Loop with start/stop/pause
- ✅ Full event-driven flow working end-to-end
- ✅ Leaderboard (Top-K, sortable, observer of events)
- ✅ Strategy versioning with reproducibility
- ✅ Job queue with retry + dead-letter handling
- ✅ Trade visualization on charts
- ✅ Loop status panel
- ✅ 8 ADRs total

---

### Week 4: Polish, Revise & Final Report

**Goal**: Stability, documentation, architecture report, demo preparation.

| Day | Hoàng (Leader) | Member B (Strategy) | Member C (News) | Phương (Event + Dashboard) |
|---|---|---|---|---|
| **Mon** | Run `/hoang-sdd-analyze` on all artifacts. Run `/hoang-sdd-converge` on all features. Fix architecture inconsistencies. Review all module contracts for drift. | Fix bugs from integration testing. Add edge case handling: strategy timeout, invalid params, empty signal. | Fix bugs. Add reliability: News service failure doesn't crash the system. Multiple news providers fallback. Polish sentiment pipeline. | Fix bugs. Add queue error handling: dead-letter inspection, worker health monitoring. Polish event flow reliability: missed events, out-of-order events. Polish UI: loading states, error boundaries, responsive layout. |
| **Tue** | **Extensibility verification**: Add `MACDStrategy` — must require only 1 new file + 1 `register()` call. Swap `RandomSearch` → `DomainGuidedSearch` — zero changes to backtester/evaluator/leaderboard. Add `OKXAdapter` — 1 new class, frontend unchanged. Verify all 8 architecture questions from spec Section 40. | Verify `MACDStrategy` extensibility test. Clean up strategy engine code. Ensure all contracts match implementations. | Verify new `INewsProvider` extensibility test. Ensure `SentimentStrategy` returns HOLD gracefully when service is down. | Verify Job Queue extensibility: swap in-memory → BullMQ with config change only. Verify event bus extensibility: add new event type without modifying existing subscribers. Verify Leaderboard extensibility: change scoring formula without touching backtester. |
| **Wed** | Write **Architecture Document**: System Context, Module decomposition, Component responsibilities, Data Flow, Realtime Flow, Strategy Flow, Search/Backtest Flow, Event Flow. Integrate all ADRs. | Contribute: Strategy Engine section, Strategy Plugin section, Search Flow diagrams. | Contribute: News/Sentiment section, Adapter Pattern section, Process Isolation section. | Contribute: Event-Driven Architecture section, Job Queue Flow diagram, Leaderboard Observer Pattern, Front-End Architecture, WebSocket flow, UI component diagram. Write **README** with install/run/demo instructions. |
| **Thu** | Final review of all deliverables. Consolidate Architecture Document. Ensure GLOSSARY is complete (all domain terms). Final KB review. | Code cleanup. Ensure all strategies are well-documented. Verify leaderboard scoring formula is explained. | Code cleanup. Ensure news pipeline is well-documented. Verify sentiment fallback is explained. | Code cleanup. Ensure event flow is well-documented. Verify job queue retry logic is explained. Ensure design system is complete. |
| **Fri** | Demo rehearsal. Final sign-off on Architecture Document. | Demo — Strategy Engine walkthrough (Plugin Architecture + Composite Pattern). | Demo — News & Sentiment walkthrough (Adapter Pattern + Fault Tolerance). | Demo — Event Architecture walkthrough (Event Bus + Job Queue + Leaderboard Observer + Dashboard). |

**W4 Deliverables**:
- ✅ All bugs fixed, system stable
- ✅ Architecture Document complete
- ✅ All 10+ ADRs written
- ✅ GLOSSARY complete with all domain terms
- ✅ All contracts match implementations
- ✅ Extensibility scenarios verified:
  1. Add `MACDStrategy` → 1 file + 1 `register()` call ✅
  2. Swap `RandomSearch` → `GeneticSearch` → zero changes to Backtester/Evaluator ✅
  3. Add `OKXAdapter` → 1 adapter class, frontend unchanged ✅
  4. `NewsService` down → charts still work ✅
  5. `SentimentModel` changes → `SentimentStrategy` unchanged ✅
  6. Backtest scale 100 → 100k → add workers to queue ✅
  7. Swap in-memory queue → BullMQ → config change only ✅
  8. Add new event type → existing subscribers unaffected ✅
- ✅ README with install/run/demo instructions
- ✅ Demo scenario rehearsed (spec Section 46)

---

## 6. Source Code Structure

```
crypto-strategy-lab/
├── apps/
│   ├── backend/                          # NestJS application
│   │   ├── src/
│   │   │   ├── app.module.ts             # Root module, imports all feature modules
│   │   │   ├── main.ts                   # Bootstrap
│   │   │   │
│   │   │   ├── shared/                   # Hoàng — shared infrastructure
│   │   │   │   ├── types/                # ICandle, ITrade, ISignal, ISignalType...
│   │   │   │   ├── interfaces/           # IStrategy, IBacktester, IEvaluator, IJobQueue, IEventBus...
│   │   │   │   ├── constants/            # Shared constants
│   │   │   │   └── shared.module.ts
│   │   │   │
│   │   │   ├── market-data/             # Hoàng — Market Data module
│   │   │   │   ├── adapters/
│   │   │   │   │   ├── binance.adapter.ts
│   │   │   │   │   └── market-data.adapter.interface.ts
│   │   │   │   ├── services/
│   │   │   │   │   └── market-data.service.ts
│   │   │   │   ├── websocket/
│   │   │   │   │   └── market-data.gateway.ts
│   │   │   │   └── market-data.module.ts
│   │   │   │
│   │   │   ├── strategy/                # Member B — Strategy Engine (domain logic)
│   │   │   │   ├── registry/
│   │   │   │   │   └── strategy.registry.ts
│   │   │   │   ├── strategies/
│   │   │   │   │   ├── ma.strategy.ts
│   │   │   │   │   ├── rsi.strategy.ts
│   │   │   │   │   ├── bollinger.strategy.ts
│   │   │   │   │   ├── support-resistance.strategy.ts
│   │   │   │   │   └── sentiment.strategy.ts  # Registered by News module
│   │   │   │   ├── composite/
│   │   │   │   │   ├── composite.strategy.ts
│   │   │   │   │   ├── majority-vote.combiner.ts
│   │   │   │   │   └── weighted-score.combiner.ts
│   │   │   │   ├── backtest/
│   │   │   │   │   ├── backtester.ts
│   │   │   │   │   └── backtest-result.ts
│   │   │   │   ├── evaluation/
│   │   │   │   │   ├── evaluator.ts
│   │   │   │   │   └── metrics.ts
│   │   │   │   ├── search/
│   │   │   │   │   ├── search-engine.ts
│   │   │   │   │   ├── random.generator.ts
│   │   │   │   │   └── domain-guided.generator.ts
│   │   │   │   ├── versioning/
│   │   │   │   │   └── strategy-version.ts
│   │   │   │   └── strategy.module.ts
│   │   │   │
│   │   │   ├── news/                    # Member C — News & Sentiment module
│   │   │   │   ├── providers/
│   │   │   │   │   ├── rss.provider.ts
│   │   │   │   │   ├── crypto-panic.provider.ts
│   │   │   │   │   └── news.provider.interface.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── news.service.ts
│   │   │   │   │   └── sentiment.client.ts
│   │   │   │   ├── strategies/
│   │   │   │   │   └── sentiment.strategy.ts
│   │   │   │   ├── cron/
│   │   │   │   │   └── news-collector.cron.ts
│   │   │   │   └── news.module.ts
│   │   │   │
│   │   │   ├── events/                  # Phương — Event Architecture
│   │   │   │   ├── event-bus.ts         # EventEmitter2 wrapper + typed events
│   │   │   │   ├── event-types.ts       # All event type definitions
│   │   │   │   └── events.module.ts
│   │   │   │
│   │   │   ├── queue/                   # Phương — Job Queue Infrastructure
│   │   │   │   ├── backtest.queue.ts    # Queue + worker pool
│   │   │   │   ├── dead-letter.ts       # Failed job handling
│   │   │   │   └── queue.module.ts
│   │   │   │
│   │   │   ├── leaderboard/             # Phương — Leaderboard (Observer)
│   │   │   │   ├── leaderboard.service.ts
│   │   │   │   ├── leaderboard-entry.ts
│   │   │   │   └── leaderboard.module.ts
│   │   │   │
│   │   │   ├── loop/                    # Phương — Strategy Loop Controller
│   │   │   │   ├── strategy-loop.ts
│   │   │   │   ├── loop-status.ts
│   │   │   │   └── loop.module.ts
│   │   │   │
│   │   │   ├── dashboard/              # Phương — Dashboard API Composition
│   │   │   │   ├── controllers/
│   │   │   │   │   └── dashboard.controller.ts
│   │   │   │   └── dashboard.module.ts
│   │   │   │
│   │   │   ├── database/               # Shared — Prisma + repositories
│   │   │   │   ├── prisma/
│   │   │   │   │   └── schema.prisma
│   │   │   │   └── repositories/
│   │   │   │       ├── candle.repository.ts
│   │   │   │       ├── strategy.repository.ts
│   │   │   │       ├── experiment.repository.ts
│   │   │   │       ├── trade.repository.ts
│   │   │   │       ├── news.repository.ts
│   │   │   │       └── leaderboard.repository.ts
│   │   │   │
│   │   │   └── websocket/              # Phương — WebSocket push to frontend
│   │   │       ├── push.gateway.ts     # Push events (LeaderboardUpdated, BacktestProgress) to frontend
│   │   │       └── websocket.module.ts
│   │   │
│   │   └── test/
│   │
│   ├── frontend/                        # Next.js application
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx           # App shell, navigation (Phương)
│   │   │   │   ├── page.tsx             # Dashboard (4-chart grid) (Hoàng)
│   │   │   │   ├── strategy/
│   │   │   │   │   └── page.tsx         # Strategy builder (Member B)
│   │   │   │   ├── leaderboard/
│   │   │   │   │   └── page.tsx         # Leaderboard (Phương)
│   │   │   │   └── news/
│   │   │   │       └── page.tsx         # News feed (Member C)
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── chart/              # Hoàng — Chart components
│   │   │   │   │   ├── CandlestickChart.tsx
│   │   │   │   │   ├── MultiTimeframeGrid.tsx
│   │   │   │   │   ├── ChartOverlay.tsx
│   │   │   │   │   └── TradeMarkers.tsx
│   │   │   │   ├── strategy/           # Member B — Strategy UI
│   │   │   │   │   ├── StrategyCard.tsx
│   │   │   │   │   ├── ParameterEditor.tsx
│   │   │   │   │   ├── CompositeBuilder.tsx
│   │   │   │   │   └── TradeTable.tsx
│   │   │   │   ├── leaderboard/        # Phương — Leaderboard UI
│   │   │   │   │   ├── LeaderboardTable.tsx
│   │   │   │   │   └── StrategyDetail.tsx
│   │   │   │   ├── news/               # Member C — News UI
│   │   │   │   │   ├── NewsFeed.tsx
│   │   │   │   │   ├── SentimentChart.tsx
│   │   │   │   │   └── SentimentGauge.tsx
│   │   │   │   ├── dashboard/          # Phương — Dashboard components
│   │   │   │   │   ├── DashboardGrid.tsx
│   │   │   │   │   ├── PairSelector.tsx
│   │   │   │   │   ├── TimeframeSelector.tsx
│   │   │   │   │   ├── LoopStatusPanel.tsx
│   │   │   │   │   └── StatusIndicator.tsx
│   │   │   │   └── common/             # Phương — Shared UI
│   │   │   │       ├── WebSocketProvider.tsx
│   │   │   │       ├── LoadingState.tsx
│   │   │   │       └── ErrorBoundary.tsx
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── useWebSocket.ts     # Hoàng
│   │   │   │   ├── useMarketData.ts    # Hoàng
│   │   │   │   ├── useLeaderboard.ts   # Phương
│   │   │   │   └── useNews.ts          # Member C
│   │   │   │
│   │   │   └── services/
│   │   │       ├── api.ts              # REST API client (Phương)
│   │   │       └── websocket.ts        # WebSocket client (Phương)
│   │   │
│   │   └── test/
│   │
│   └── sentiment/                       # Member C — Python Sentiment Service
│       ├── app.py                       # FastAPI entry point
│       ├── analyzer.py                  # Sentiment analysis logic
│       ├── models.py                    # Request/response schemas
│       └── requirements.txt
│
├── libs/
│   └── shared/                          # Shared TypeScript types & interfaces
│       ├── src/
│       │   ├── types/                   # ICandle, ITrade, ISignal, IBacktestResult...
│       │   ├── interfaces/              # IStrategy, IBacktester, IMarketDataAdapter, IJobQueue, IEventBus...
│       │   └── events/                  # Event type definitions
│       └── package.json
│
├── kb/                                  # Knowledge Base (from hoang-sdd-kit)
│   ├── INDEX.md                         # Hoàng
│   ├── CONSTITUTION.md                  # Hoàng
│   ├── ARCHITECTURE.md                  # Hoàng
│   ├── DESIGN.md                        # Phương
│   ├── MODULES.md                       # Hoàng
│   ├── GLOSSARY.md                      # Hoàng (seed) → all contribute
│   ├── CONTRIBUTING.md                  # Hoàng
│   ├── ADR/                             # Hoàng (core) + module owners
│   ├── contracts/                       # Module owners (Hoàng reviews)
│   ├── modules/                         # Per-module architecture (module owners)
│   │   ├── README.md                    # Hoàng (index)
│   │   ├── market-data.md              # Hoàng
│   │   ├── strategy-engine.md          # Member B
│   │   ├── news-sentiment.md            # Member C
│   │   └── event-infrastructure.md      # Phương
│   ├── flows/                           # E2E business use case flows (flow owners)
│   │   ├── README.md                    # Hoàng (index)
│   │   ├── realtime-market-data.md     # Hoàng
│   │   ├── strategy-backtest.md         # Member B
│   │   ├── strategy-search-loop.md     # Phương
│   │   ├── news-sentiment-pipeline.md  # Member C
│   │   ├── composite-with-sentiment.md  # Member B
│   │   └── leaderboard-update.md        # Phương
│   └── patterns/                        # Hoàng (seed) → all contribute
│
├── sdd_artifacts/                       # Per-feature SDD artifacts
├── agent_learn/                         # Agent learning (read-only)
├── .agents/                             # hoang-sdd-kit skills
│   ├── skills/
│   └── DEV_GUIDE.md
│
├── docker-compose.yml                   # PostgreSQL + Redis (for BullMQ if used)
├── package.json                         # Monorepo root
├── turbo.json                           # Turborepo config (or nx.json)
└── README.md
```

---

## 7. Architecture Decision Records

| ADR | Title | Owner | Week |
|-----|-------|-------|------|
| 0001 | Record Architecture Decisions | Hoàng | W1 |
| 0002 | Modular Monolith over Microservices | Hoàng | W1 |
| 0003 | Plugin Architecture for Strategies | Hoàng + Member B | W1 |
| 0004 | Adapter Pattern for Data Sources | Hoàng | W1 |
| 0005 | Event-Driven Communication Between Modules | Hoàng + Phương | W1 |
| 0006 | Job Queue + Worker for Backtesting | Phương | W2 |
| 0007 | Auto-Reconnect for External APIs | Hoàng | W2 |
| 0008 | Strategy Versioning for Reproducibility | Member B | W3 |
| 0009 | Sentiment Service as Separate Process | Member C | W2 |
| 0010 | News Provider Adapter Pattern | Member C | W2 |
| 0011 | Leaderboard as Observer of Events | Phương | W3 |
| 0012 | In-Memory Queue with BullMQ Migration Path | Phương | W3 |

---

## 8. Key Extensibility Scenarios (Must Verify in W4)

| # | Scenario | Expected Change | Modules Affected |
|---|---|---|---|
| 1 | Add `MACDStrategy` | 1 new file + 1 `register()` call | None |
| 2 | Swap Random → Genetic Search | 1 new generator class implementing `IStrategyGenerator` | None (Backtester, Evaluator, Leaderboard unchanged) |
| 3 | Add OKX data source | 1 new adapter implementing `IMarketDataAdapter` | None (Frontend unchanged) |
| 4 | 100k backtests needed | Add worker processes to queue | None (architecture supports it) |
| 5 | News Service down | Charts still work. `SentimentStrategy` returns HOLD. | Frontend, Market Data, Strategy Engine unaffected |
| 6 | Sentiment model replaced | Only `sentiment/app.py` changes. `SentimentStrategy` unchanged | Strategy Engine unaffected |
| 7 | Binance WebSocket disconnect | Auto-reconnect + visual indicator | Frontend sees staggered updates, not crash |
| 8 | Reproduce experiment #122 | Strategy version + params saved in DB. Re-run yields same result | Experiment → Strategy join ensures reproducibility |
| 9 | Swap in-memory queue → BullMQ | Config change only (implement same `IJobQueue` interface) | Strategy Engine unaffected |
| 10 | Add new event type | Define event class + add subscriber. Existing subscribers unaffected | Existing event flow unchanged |

---

## 9. Risk Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Binance API rate limits | Real-time data gaps | Caching, batch requests, respect limits |
| Team member falls behind | Module integration delay | Shared interfaces allow parallel work. Hoàng can implement critical-path code. |
| NestJS/Next.js learning curve | Slower start | Week 1 skeletons establish patterns. Team follows established module structure. |
| Strategy calculation performance | Slow backtesting | Job queue + workers. Start in-memory, swap to Redis later. |
| WebSocket disconnect | Stale frontend data | Auto-reconnect + connection status indicator |
| Scope creep | Miss deadline | MVP-first: 4 strategies + random search + basic leaderboard. Advanced features are stretch. |
| Integration bugs at E2E | Demo fails | W3 integration days. `main` branch always deployable. |
| Phương overwhelmed (event bus + queue + dashboard) | Critical infrastructure delayed | Event bus and queue are small but critical. Dashboard can be simplified if needed. Hoàng can take queue as fallback. |

---

## 10. Deliverables Checklist

Per the spec (Section 45):

- [ ] **Source Code**: Monorepo with NestJS backend + Next.js frontend + Python sentiment service
- [ ] **README**: Install, Run, Architecture overview, Demo instructions
- [ ] **Architecture Document**: System Context, Module decomposition, Component responsibilities, Data Flow, Realtime Flow, Strategy Flow, Search/Backtest Flow, Event Flow
- [ ] **Architectural Decisions**: Minimum 12 ADRs (see Section 7)
- [ ] **Demo**: Live demo covering Section 46 walkthrough
  - [ ] 4-chart realtime display (BTCUSDT, multiple timeframes)
  - [ ] Strategy selection (MA, RSI, Bollinger, SR)
  - [ ] Strategy combination & composition
  - [ ] Backtest execution (via job queue)
  - [ ] Leaderboard with Top-K ranking (observer of events)
  - [ ] Trade visualization on chart
  - [ ] Trade detail table
  - [ ] News collection & sentiment display
  - [ ] Sentiment strategy in composite search
  - [ ] Continuous search loop with progress tracking
  - [ ] Event flow: BacktestRequested → [Queue] → BacktestCompleted → LeaderboardUpdated → WebSocket push