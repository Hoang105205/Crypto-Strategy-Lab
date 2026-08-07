# Module: News & Sentiment

> **Owner**: Thuận  
> **Status**: Active  
> **Last Updated**: 2026-08-06

## 1. Overview
- **Responsibility**: Collect crypto news articles from external data providers, normalize into a standardized news schema (`NewsArticle`), analyze sentiment via an isolated Python FastAPI ML service, and expose sentiment analysis both as a dashboard feed and as a pluggable trading strategy (`NewsSentimentStrategy`).
- **Layer**: Backend (NestJS + Python FastAPI)
- **Depends on**: Shared types + `IEventBus`
- **Depended by**: Strategy Engine (via `NewsSentimentStrategy` registration in `StrategyRegistry`), Frontend (via REST API for News Feed & Sentiment Gauge)
- **Contracts**: `kb/contracts/news.yaml`
- **Source files**: `apps/backend/src/news/`, `apps/sentiment/`
- **Related ADRs**: `kb/ADR/0009-sentiment-service-as-separate-process.md`, `kb/ADR/0010-news-provider-adapter-pattern.md`

---

## 2. Component Architecture

### Components

| Component | Responsibility | Pattern | File(s) |
|---|---|---|---|
| `INewsProvider` | Abstraction interface returning unified format (`RawArticle`) from any source | Adapter Interface | `apps/backend/src/news/providers/news.provider.interface.ts` |
| `RSSProvider` | Fetches and parses crypto news from public RSS feeds | Adapter | `apps/backend/src/news/providers/rss.provider.ts` |
| `CryptoPanicProvider` | Fetches crypto news & market sentiment from CryptoPanic API | Adapter | `apps/backend/src/news/providers/crypto-panic.provider.ts` |
| `WebCrawlerProvider` | Custom web crawler for specific news portals | Adapter | `apps/backend/src/news/providers/crawler.provider.ts` |
| `NewsCollectorCron` | Scheduled cron job to collect, normalize, deduplicate, and store news | Scheduler / Cron | `apps/backend/src/news/cron/news-collector.cron.ts` |
| `NewsService` | High-level orchestrator for news ingestion, normalization, and sentiment enrichment | Service | `apps/backend/src/news/services/news.service.ts` |
| `SentimentClient` | NestJS HTTP client connecting to isolated Python FastAPI service | Client / HTTP | `apps/backend/src/news/services/sentiment.client.ts` |
| `FastAPI Sentiment App` | Python process running VADER sentiment analysis model | Process Isolation | `apps/sentiment/app.py`, `analyzer.py`, `models.py` |
| `NewsSentimentStrategy` | Pluggable trading strategy implementing `IStrategy`; generates BUY/SELL/HOLD | Strategy + Graceful Degradation | `apps/backend/src/news/strategies/sentiment.strategy.ts` |

### Component Diagram

```text
         News Provider Abstraction (INewsProvider)
                        ↑
     ┌──────────────────┼──────────────────┐
     │                  │                  │
RSS Provider      News API Provider   Web Crawler
     │                  │                  │
     └──────────────────┼──────────────────┘
                        │ (Unified RawArticle)
                        ▼
             ┌─────────────────────┐
             │    NewsCollector    │
             └──────────┬──────────┘
                        │ (Normalize: id, title, content, source, publishedAt, crawledAt, relatedCoins, url)
                        ▼
             ┌─────────────────────┐      HTTP REST      ┌──────────────────────────┐
             │   SentimentClient   │ ──────────────────> │ Python FastAPI Service   │
             └──────────┬──────────┘                     │ (VADER ML Classification)│
                        │                                └──────────────────────────┘
                        ▼
       ┌─────────────────────────────────┐
       │ PostgreSQL DB (News & Sentiment)│
       └────────────────┬────────────────┘
                        │
                        ▼
       ┌─────────────────────────────────┐
       │     NewsSentimentStrategy       │  ───> Registered into StrategyRegistry
       │ (Avg Sentiment > 0.X → BUY)     │       Combined with MA, RSI, BB, SR into
       │ (Avg Sentiment < -0.X → SELL)   │       Composite Strategies
       └─────────────────────────────────┘
```

---

## 3. Design Patterns & Architectural Decoupling

### 1. Decoupled Provider Adapter Pattern (`INewsProvider`)
- **Where**: `apps/backend/src/news/providers/`
- **Why**: Prevents hardcoding the trading system to a single web crawler or news site (`Trading System ❌ Website A Crawler`).
- **How**: `INewsProvider` defines a standardized method `fetchLatest(limit?, coin?): Promise<RawArticle[]>`. Whether news comes from RSS, CryptoPanic API, or a Web Crawler, every provider converts raw payloads into the unified `RawArticle` format.
- **Extensibility**: Adding a new news portal requires creating 1 new adapter class implementing `INewsProvider`. Downstream modules (`NewsService`, `NewsSentimentStrategy`, UI) require ZERO changes.

### 2. Standardized News Data Schema
- **Where**: `NewsArticle` entity in PostgreSQL & Prisma schema.
- **Fields**: `id`, `title`, `content`, `source`, `publishedAt`, `crawledAt`, `relatedCoins` (e.g. `['BTC']`), `url` (unique hash deduplication), `sentimentScore`, `sentimentLabel`.
- **How**: Ensures consistent querying by asset pair (`relatedCoins: 'BTC'`) and timeframe.

### 3. Process Isolation for Sentiment Analysis
- **Where**: Python FastAPI ML Service (`apps/sentiment/`)
- **Why**: Machine Learning models (VADER / transformers) require Python ML ecosystem and CPU-bound computation. Keeping Python in a separate process isolates ML crashes and resource spikes from NestJS and candlestick chart gateways.
- **Classification**: Assigns labels (`POSITIVE`, `NEGATIVE`, `NEUTRAL`) and score (e.g. `score: 0.82`).

### 4. Sentiment as a Strategy Plugin (`NewsSentimentStrategy`)
- **Where**: `apps/backend/src/news/strategies/sentiment.strategy.ts`
- **Why**: Moves sentiment beyond just a UI dashboard feature into an active trading signal generator.
- **Integration**: Implements `IStrategy` interface and registers into `StrategyRegistry.register(NewsSentimentStrategy)`.
- **Signal Logic**: 
  - Average sentiment score in timeframe > +0.X → `BUY`
  - Average sentiment score in timeframe < -0.X → `SELL`
  - Otherwise → `HOLD`
- **Composite Strategy Combinations**: Enables search engines and strategy builders to create composites like:
  - `MA + RSI + News Sentiment`
  - `Support Resistance + News Sentiment`
  - `Bollinger Bands + News Sentiment`

---

## 4. Internal Data Flow

1. `NewsCollectorCron` triggers according to configured schedule.
2. `NewsService` queries all active `INewsProvider` implementations (RSS, News API, Web Crawler).
3. Providers fetch raw payloads and convert them to standard `RawArticle` format containing `relatedCoins`.
4. `NewsService` deduplicates articles by URL/hash, assigns `crawledAt` timestamp, and saves to PostgreSQL.
5. `NewsService` sends article content to `SentimentClient`.
6. `SentimentClient` issues REST POST request to Python FastAPI `/analyze`.
7. Python VADER model classifies article (`POSITIVE`, `NEGATIVE`, `NEUTRAL`) and calculates `score` (e.g. `0.82`).
8. `NewsService` updates article with sentiment classification.
9. `NewsSentimentStrategy` reads aggregate sentiment score for specific `relatedCoins` and timeframe, outputting `BUY`, `SELL`, or `HOLD` signals to `StrategyRegistry`.

---

## 5. Sequence Diagrams

### News Ingestion, Sentiment Classification & Strategy Integration

```text
Cron/User        INewsProvider        NewsService        SentimentClient       FastAPI Python       StrategyRegistry
    │                 │                    │                    │                    │                      │
    │──1. trigger────>│                    │                    │                    │                      │
    │                 │──2. fetchLatest()─>│                    │                    │                      │
    │                 │<──3. RawArticle[]──│                    │                    │                      │
    │                 │                    │──4. dedupe & save  │                    │                      │
    │                 │                    │──5. analyzeText()─>│                    │                      │
    │                 │                    │                    │──6. POST /analyze─>│                      │
    │                 │                    │                    │<──7. {score,label}─│                      │
    │                 │                    │<──8. Sentiment─────│                    │                      │
    │                 │                    │                                         │                      │
    │                 │                    │──9. Register NewsSentimentStrategy ───────────────────────────>│
    │                 │                    │     (Enables MA + RSI + News Sentiment Composite strategies)   │
```

---

## 6. Data Model

| Entity | Fields | Relationships |
|---|---|---|
| `NewsArticle` | `id`, `source`, `title`, `content`, `url` (unique), `publishedAt`, `crawledAt`, `relatedCoins` (String[]), `sentimentScore`, `sentimentLabel`, `createdAt` | 1-to-1 with `SentimentScore` |
| `SentimentScore` | `id`, `articleId` (FK), `score` (-1.0 to 1.0), `label` (POSITIVE, NEGATIVE, NEUTRAL), `model` ('VADER'), `scoredAt` | Belongs to `NewsArticle` |

---

## 7. API Surface
See `kb/contracts/news.yaml`.

- **`GET /api/news?limit=10&coin=BTC`**: Returns latest news articles filtered by coin with sentiment score and label.
- **`GET /api/sentiment/aggregate?timeframe=1h&coin=BTC`**: Returns aggregate sentiment score for specific coin.
- **`POST /analyze`** *(Internal Python FastAPI)*: Receives article text and returns ML sentiment score & label.

---

## 8. Quality Attributes
- **Extensibility**: Adding new news providers requires 1 adapter class implementing `INewsProvider`. Adding new ML models requires updating `sentiment/analyzer.py` only.
- **Reliability & Graceful Degradation**: If Python service is down, `SentimentClient` returns neutral score (`0`), and `NewsSentimentStrategy` outputs `HOLD`, keeping main charts and trading loop safe.

---

## 9. Testing Strategy
- **Unit tests**: Test provider normalization to `RawArticle`; test `NewsSentimentStrategy` signal thresholds (>0.X BUY, <-0.X SELL).
- **Integration tests**: Test composite strategies combining `MA + RSI + NewsSentimentStrategy`.

---

## 10. Open Questions / TODOs
- [x] Complete module structure & component definitions.
- [ ] Implement CryptoPanic provider adapter in Week 2.
- [ ] Add Redis caching for aggregate sentiment gauge if database query load increases.
