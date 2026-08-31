# Module: News & Sentiment

> **Owner**: Thuận  
> **Status**: Active  
> **Last Updated**: 2026-08-25

## 1. Overview
- **Responsibility**: Collect crypto news articles from external data providers (RSS multi-feeds and LLM-assisted adaptive web crawlers), normalize into a standardized news schema (`NewsArticle`), analyze sentiment via an isolated Python FastAPI ML service, and expose sentiment analysis both as a dashboard feed (with 24h sentiment breakdown ratios and on-demand crawl trigger with 2-minute cooldown anti-spam) and as a pluggable trading strategy (`NewsSentimentStrategy`).
- **Layer**: Backend (NestJS + Python FastAPI) + Frontend (Next.js `NewsFeed` component)
- **Depends on**: Shared types + `IEventBus`
- **Depended by**: Strategy Engine (via `NewsSentimentStrategy` registration in `StrategyRegistry`), Frontend (via REST API for News Feed, Sentiment Breakdown & On-demand Crawler Trigger)
- **Contracts**: `kb/contracts/news.yaml`
- **Source files**: `apps/backend/src/news/`, `apps/sentiment/`, `apps/frontend/src/components/news/`
- **Related ADRs**: `kb/ADR/0009-sentiment-service-as-separate-process.md`, `kb/ADR/0010-news-provider-adapter-pattern.md`, `kb/ADR/0014-llm-assisted-crawler-selector-caching.md`

---

## 2. Component Architecture

### Components

| Component | Responsibility | Pattern | File(s) |
|---|---|---|---|
| `INewsProvider` | Abstraction interface returning unified format (`RawArticle`) from any source | Adapter Interface | `apps/backend/src/news/providers/news.provider.interface.ts` |
| `RSSProvider` | Fetches and parses crypto news from public RSS feeds (CoinDesk, CoinTelegraph, Decrypt) | Adapter | `apps/backend/src/news/providers/rss.provider.ts` |
| `WebCrawlerProvider` | High-performance adaptive crawler using cached DB selectors and fast HTML parsing | Adapter + Cache | `apps/backend/src/news/providers/crawler.provider.ts` |
| `CrawlerDiscoveryService` | Orchestrates CSS selector discovery and self-healing across registered domains | Discovery & Self-Healing | `apps/backend/src/news/services/crawler-discovery.service.ts` |
| `GeminiDiscoveryClient` | Communicates with Google Gemini API (Gemini 2.5 Flash) for structured JSON selector discovery with Cheerio heuristic fallback | AI Client / Fallback | `apps/backend/src/news/services/gemini-discovery.client.ts` |
| `CrawlerRule` | Persistent database entity storing LLM-discovered CSS selectors per domain | SSoT Entity / Schema | `prisma/schema.prisma` |
| `NewsCollectorCron` | Scheduled cron job to collect, normalize, deduplicate, and store news every 5 minutes (`*/5 * * * *`) | Scheduler / Cron | `apps/backend/src/news/cron/news-collector.cron.ts` |
| `NewsController` | Exposes REST APIs: `GET /api/news`, `GET /api/sentiment/aggregate` (with breakdown ratios), `POST /api/news/crawl` (with 120s cooldown & mutex lock) | Controller | `apps/backend/src/news/news.controller.ts` |
| `NewsService` | High-level orchestrator for news ingestion, normalization, and sentiment enrichment | Service | `apps/backend/src/news/services/news.service.ts` |
| `SentimentClient` | NestJS HTTP client connecting to isolated Python FastAPI service | Client / HTTP | `apps/backend/src/news/services/sentiment.client.ts` |
| `FastAPI Sentiment App` | Python process running VADER sentiment analysis model | Process Isolation | `apps/sentiment/app.py`, `analyzer.py`, `models.py` |
| `NewsSentimentStrategy` | Pluggable trading strategy implementing `IStrategy`; generates BUY/SELL/HOLD | Strategy + Graceful Degradation | `apps/backend/src/news/strategies/sentiment.strategy.ts` |
| `NewsFeed` | Frontend component rendering news cards, 24h sentiment breakdown % bar, coin filter tabs, and on-demand "Cào tin ngay" button with 2-minute countdown timer | Frontend UI | `apps/frontend/src/components/news/NewsFeed.tsx` |

### Component Diagram

```text
               ┌────────────────────────────────────────────────────────┐
               │           1. DISCOVERY & SELF-HEALING (On Demand)      │
               │  Fetch HTML Sample ──> LLM Discovers CSS Selectors     │
               └──────────────────────────┬─────────────────────────────┘
                                          │ Save/Update Selectors
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │         2. POSTGRESQL `CrawlerRule` DB CACHE           │
               │ { domain, container, title, content, link, date, ... } │
               └──────────────────────────┬─────────────────────────────┘
                                          │
                         News Provider Abstraction (INewsProvider)
                                        ↑
                     ┌──────────────────┼──────────────────┐
                     │                                     │
                RSS Provider                      Web Crawler Provider
          (CoinDesk, Cointelegraph)             (Fast Cheerio + DB Rules)
                     │                                     │
                     └──────────────────┬──────────────────┘
                                        │ (Unified RawArticle[])
                                        ▼
                             ┌─────────────────────┐
                             │    NewsCollector    │
                             └──────────┬──────────┘
                                        │ (Normalize & Dynamic TradingPair coin tagging)
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
- **How**: `INewsProvider` defines a standardized method `fetchLatest(limit?, coin?, activeCoins?): Promise<RawArticle[]>`. Every provider converts raw payloads into the unified `RawArticle` format.
- **Dynamic Coin Extraction**: Providers scan text against active `TradingPair` symbols from PostgreSQL. If no active trading pair coin matches the article, the provider assigns `relatedCoins: ['GENERAL']`.
- **Fault Isolation**: If feeds fail, providers return an empty array `[]` cleanly without returning stale mock articles (ADR-0010).

### 2. Standardized News Data Schema
- **Where**: `NewsArticle` entity in PostgreSQL & Prisma schema.
- **Fields**: `id`, `title`, `content`, `source`, `publishedAt`, `crawledAt`, `relatedCoins` (e.g. `['BTC']`, `['ETH']`, `['GENERAL']`), `url` (unique hash deduplication), `sentimentScore`, `sentimentLabel`.
- **How**: Ensures consistent querying by asset pair (`relatedCoins: 'BTC'`), general market news (`relatedCoins: 'GENERAL'`), and timeframe.

### 3. Process Isolation for Sentiment Analysis
- **Where**: Python FastAPI ML Service (`apps/sentiment/`)
- **Why**: Machine Learning models require Python ML ecosystem. Keeping Python in a separate process isolates ML crashes and resource spikes from NestJS and candlestick chart gateways (ADR-0009).
- **Classification**: Assigns labels (`POSITIVE`, `NEGATIVE`, `NEUTRAL`) and score (`-1.0` to `+1.0`).

### 4. Sentiment as a Strategy Plugin (`NewsSentimentStrategy`)
- **Where**: `apps/backend/src/news/strategies/sentiment.strategy.ts`
- **Why**: Moves sentiment beyond just a UI dashboard feature into an active trading signal generator.
- **Integration**: Implements `IStrategy` interface and registers into `StrategyRegistry.register(NewsSentimentStrategy)` (ADR-0003).

### 5. LLM-Assisted Adaptive Web Crawler with Database Selector Caching & Self-Healing (ADR-0014)
- **Where**: `apps/backend/src/news/providers/crawler.provider.ts`, `apps/backend/src/news/services/crawler-discovery.service.ts`, `apps/backend/src/news/services/gemini-discovery.client.ts` & `CrawlerRule` table.
- **Why**: Solving the brittle selector problem of traditional web crawlers without incurring continuous LLM token costs or high scraping latency.
- **How**:
  1. *Discovery Tier (Gemini LLM)*: When crawling a new domain or encountering an unknown layout, an HTML sample is sent to `GeminiDiscoveryClient` (Google Gemini 2.5 Flash API) to analyze the DOM structure and extract semantic CSS selectors (`container`, `title`, `content`, `link`, `date`) in structured JSON format.
  2. *Graceful Heuristic Fallback*: If `GEMINI_API_KEY` is not provided, or if the Gemini API request times out (>10s) / fails (429/5xx), `CrawlerDiscoveryService` gracefully degrades to semantic Cheerio DOM heuristics without interrupting the ingestion pipeline.
  3. *Cache Tier*: Discovered selectors are persisted in PostgreSQL (`CrawlerRule`).
  4. *Execution Tier*: Daily/periodic cron runs query the cached `CrawlerRule` from the database and perform ultra-fast, zero-token HTML parsing using `cheerio` (<50ms).
  5. *Self-Healing Tier*: If cached selectors extract 0 articles (indicating a website layout redesign), an automatic LLM re-discovery event is triggered to heal the DB rule.

---

## 4. Internal Data Flow

1. **Scheduled Ingestion**: `NewsCollectorCron` triggers automatically every 5 minutes (`*/5 * * * *`).
2. **On-Demand Ingestion**: User or operator hits `POST /api/news/crawl`. Backend verifies the 120s cooldown timer and mutex lock. If cooldown is violated, it returns `429 Too Many Requests` with `retryAfterSeconds`; if another crawl is running, it returns `409 Conflict`.
3. `NewsService` queries all active `INewsProvider` implementations (`RSSProvider`, `WebCrawlerProvider`).
4. For web crawler sources, `WebCrawlerProvider` retrieves active `CrawlerRule` records from PostgreSQL.
5. If a rule exists and extracts articles, it parses raw HTML via `cheerio`; if not, `CrawlerDiscoveryService` triggers `GeminiDiscoveryClient` (with Cheerio heuristic fallback), saves the discovered rule to DB, and extracts articles.
6. Providers return standardized `RawArticle[]` with dynamically tagged `relatedCoins` (or `GENERAL`).
7. `NewsService` deduplicates articles by URL/hash, assigns `crawledAt` timestamp, and saves unique records to PostgreSQL.
8. `NewsService` sends article text to `SentimentClient` for Python VADER ML analysis.
9. `NewsService` stores the resulting `SentimentScore`.
10. `NewsSentimentStrategy` computes aggregate sentiment for active pairs and emits `BUY`, `SELL`, or `HOLD` signals.

---

## 5. Sequence Diagrams

### 1. Adaptive Web Crawler & Sentiment Pipeline (Scheduled + On-Demand)

```text
User / Cron      NewsController       NewsService         WebCrawlerProvider       FastAPI (VADER)      PostgreSQL DB
    │                   │                  │                      │                       │                   │
    │──1. POST /crawl──>│                  │                      │                       │                   │
    │  (or 5m Cron)     │──2. checkLock()──│                      │                       │                   │
    │                   │   & cooldown(120s)                      │                       │                   │
    │                   │──3. collect()───>│                      │                       │                   │
    │                   │                  │──4. fetchLatest()───>│                       │                   │
    │                   │                  │<──5. RawArticle[]────│                       │                   │
    │                   │                  │──6. POST /analyze (batch text)──────────────>│                   │
    │                   │                  │<──7. return {score, label}───────────────────│                   │
    │                   │                  │──8. persist articles + sentiment scores─────────────────────────>│
    │                   │<──9. saved count─│                                                                  │
    │<──10. 200 OK──────│                  │                                                                  │
    │   {success, count}│                  │                                                                  │
```

### 2. LLM Selector Discovery & Self-Healing Flow (Gemini + Cheerio Fallback)

```text
WebCrawlerProvider     CrawlerDiscoveryService     GeminiDiscoveryClient      Google Gemini API       PostgreSQL DB
        │                         │                          │                        │                     │
        │──1. crawlDomain(rule)──>│                          │                        │                     │
        │   (extracts 0 items)    │                          │                        │                     │
        │──2. repairSelectors()──>│                          │                        │                     │
        │                         │──3. discoverSelectors()─>│                        │                     │
        │                         │                          │──4. POST /v1beta/...──>│                     │
        │                         │                          │     (DOM snippet)      │                     │
        │                         │                          │<──5. JSON Selectors────│                     │
        │                         │                          │   (or fallback error)                        │
        │                         │<──6. DiscoveredRule──────│                                              │
        │                         │   (Gemini or Cheerio)    │                                              │
        │                         │──7. upsert CrawlerRule in DB───────────────────────────────────────────>│
        │<──8. return healed rule─│                                                                         │
        │──9. re-parse with rule─>│                                                                         │
```

---

## 6. Data Model

| Entity | Fields | Relationships |
|---|---|---|
| `NewsArticle` | `id`, `source`, `title`, `content`, `url` (unique), `publishedAt`, `crawledAt`, `relatedCoins` (String[]), `sentimentScore`, `sentimentLabel`, `createdAt` | 1-to-1 with `SentimentScore` |
| `SentimentScore` | `id`, `articleId` (FK), `score` (-1.0 to 1.0), `label` (POSITIVE, NEGATIVE, NEUTRAL), `model` ('VADER'), `scoredAt` | Belongs to `NewsArticle` |
| `CrawlerRule` | `id`, `domain`, `targetUrl`, `containerSelector`, `titleSelector`, `contentSelector`, `linkSelector`, `dateSelector`, `isActive`, `lastDiscoveredAt`, `createdAt`, `updatedAt` | SSoT Configuration for Adaptive Web Crawler |

---

## 7. API Surface
See `kb/contracts/news.yaml`.

- **`GET /api/news?limit=10&offset=0&coin=BTC&coins=BTC,ETH`**: Returns paginated news articles with sentiment scores.
- **`GET /api/sentiment/aggregate?timeframe=1h&coin=BTC`**: Returns aggregate sentiment score and distribution ratios (`positiveRatio`, `neutralRatio`, `negativeRatio`, `positiveCount`, `neutralCount`, `negativeCount`).
- **`POST /api/news/crawl`**: On-demand manual trigger for news collection with 120s rate-limiting cooldown and mutex lock protection (returns 200, 429, or 409).
- **`POST /analyze`** *(Internal Python FastAPI)*: Receives article text and returns ML sentiment score & label.

---

## 8. Quality Attributes
- **Extensibility**: Adding new news providers requires 1 adapter class implementing `INewsProvider`. Adding new web portals requires 0 code changes (auto-discovered via LLM and cached in DB).
- **Cost & Performance Efficiency**: 99%+ reduction in LLM costs via Database Selector Caching; regular parsing runs in <50ms with Cheerio without calling LLM.
- **AI Resilience & Graceful Fallback**: `GeminiDiscoveryClient` uses Google Gemini API (Gemini 2.5 Flash) with strict 10s timeout. If API key is missing or service is unavailable, it gracefully degrades to Cheerio DOM heuristics.
- **Rate-Limiting & Anti-Spam (120s Cooldown)**: `POST /api/news/crawl` enforces a 2-minute cooldown on both backend (in-memory timestamp check + HTTP 429) and frontend UI (OP.GG-style countdown timer with `localStorage` persistence).
- **Concurrency Safety (Mutex Lock)**: An in-memory mutex flag ensures only one crawling job executes at any given time, rejecting duplicate concurrent triggers with HTTP `409 Conflict`.
- **Reliability & Graceful Degradation**: If Python service is down, `SentimentClient` returns neutral score (`0`), and `NewsSentimentStrategy` outputs `HOLD`, keeping main charts and trading loop safe.

---

## 9. Testing Strategy
- **Unit tests**: Test provider normalization to `RawArticle`; test `GeminiDiscoveryClient` structured parsing & Cheerio fallback; test `NewsSentimentStrategy` signal thresholds (>0.X BUY, <-0.X SELL).
- **Integration tests**: Test composite strategies combining `MA + RSI + NewsSentimentStrategy`.

---

## 10. Open Questions / TODOs
- [x] Complete module structure & component definitions.
- [x] Specify Adaptive Crawler Architecture with Selector Caching (ADR-0014).
- [x] Implement `CrawlerRule` Prisma migration in backend.
- [ ] Connect Gemini LLM endpoint for selector discovery (Planned in SDD feature `gemini-crawler-selector-discovery`).
