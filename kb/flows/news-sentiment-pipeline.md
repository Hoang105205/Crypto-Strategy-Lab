# Business Flow: News & Sentiment Pipeline

> **Owner**: Thuận  
> **Status**: Active  
> **Last Updated**: 2026-08-06

## 1. Overview
- **Description**: Crypto news articles are collected periodically via provider adapters (RSS, News API, Web Crawlers), normalized into a standard schema (`id, title, content, source, publishedAt, crawledAt, relatedCoins, url`), scored for sentiment by an isolated Python FastAPI ML service, stored in PostgreSQL, and fed into both the Next.js Frontend and `NewsSentimentStrategy` for composite strategy creation (`MA + RSI + News Sentiment`).
- **Primary Actor**: Cron Scheduler / REST User Request
- **Business Value**: Enriches market data with real-time news sentiment and provides a non-technical analysis signal source for composite trading strategies.
- **Modules Involved**: News & Sentiment Module (NestJS + Python FastAPI), Strategy Engine (Consumer of `NewsSentimentStrategy`), Frontend (Consumer of News Feed REST API).

---

## 2. Preconditions
- Python FastAPI Sentiment Service is running on `http://localhost:8000` (or NestJS is prepared for graceful degradation).
- Database schema applied for `NewsArticle` (with `crawledAt`, `relatedCoins`) and `SentimentScore` tables.
- Active network connection available for news providers (RSS, News API, Web Crawlers).

---

## 3. Flow Steps

1. **Trigger**: `NewsCollectorCron` triggers on schedule (or user hits `GET /api/news`).
2. **Decoupled Fetch**: `NewsService` calls `INewsProvider.fetchLatest()` across registered provider adapters (`RSSProvider`, `NewsAPIProvider`, `WebCrawlerProvider`).
3. **Normalize & Deduplicate**: Each provider converts raw payloads into standard `RawArticle` format containing `relatedCoins`. `NewsService` deduplicates articles by URL hash and assigns `crawledAt` timestamp.
4. **Persist Raw Articles**: `NewsService` stores unique articles into PostgreSQL database.
5. **Sentiment Scoring Request**: `NewsService` forwards article text (title + content summary) to `SentimentClient`.
6. **ML Inference**: `SentimentClient` issues HTTP POST `/analyze` request to Python FastAPI ML service.
7. **Score & Classification**: Python VADER model classifies sentiment (`POSITIVE`, `NEGATIVE`, `NEUTRAL`) and calculates compound score (e.g. `0.82`).
8. **Persist Sentiment**: `NewsService` saves the resulting `SentimentScore` linked to `NewsArticle` in PostgreSQL.
9. **Display & Strategy Plugin**:
   - **Frontend UI**: Next.js fetches paginated news `GET /api/news?limit=10&offset=0&coin=BTC` (or multi-coin `GET /api/news?coins=BTC,ETH`) and `/api/sentiment/aggregate?coin=BTC` to render News Feed & Sentiment Gauge with pagination metadata (`total`, `offset`, `limit`, `hasMore`).
   - **Strategy Engine**: `NewsSentimentStrategy` queries aggregate sentiment score for specific coins (Score > +0.5 → `BUY`, Score < -0.5 → `SELL`). Search engine can combine it into composite strategies (`MA + RSI + News Sentiment`).

---

## 4. Postconditions
- Articles are deduplicated, normalized, and saved with sentiment classification (`POSITIVE`/`NEGATIVE`/`NEUTRAL`) and score.
- Latest market aggregate sentiment score is updated per coin and timeframe.
- `NewsSentimentStrategy` is registered in `StrategyRegistry` and ready for backtesting in composite strategies.

---

## 5. Alternative Paths

### Manual Refresh via UI
- User clicks "Refresh News" on Next.js Frontend (`app/news/page.tsx`).
- Request calls NestJS `GET /api/news?forceRefresh=true`.
- `NewsService` executes full pipeline immediately instead of waiting for cron scheduler.

### Offset Pagination & Multi-Coin Load More (Frontend)
- User opens Next.js News Feed (`app/news/page.tsx`).
- Initial load requests `GET /api/news?limit=20&offset=0&coin=ALL` (or multi-coin `GET /api/news?limit=20&offset=0&coins=BTC,ETH`).
- Response returns `{ data: articles, pagination: { total, limit, offset, hasMore } }`.
- When user clicks "📰 More stories", Frontend increments offset (`offset = 20`) and calls `GET /api/news?limit=10&offset=20&coin=BTC`.
- Backend NestJS executes `findMany({ skip: offset, take: limit })` with `hasSome: coins` or `has: coin` and returns subsequent page without duplicating articles.

---

## 6. Error & Exception Flows

### Exception Scenario: Python Sentiment Service Down / Unreachable
1. `SentimentClient` attempts HTTP POST `/analyze` to `http://localhost:8000`.
2. Connection fails or times out (500ms timeout).
3. `SentimentClient` logs warning and returns fallback object: `{ score: 0.0, label: "NEUTRAL" }`.
4. `NewsService` stores news article with fallback neutral score.
5. `NewsSentimentStrategy` detects neutral fallback and returns `HOLD` signal.
6. **Result**: NestJS server, candlestick charts, and trading search loop continue running seamlessly without crashing.

### Exception Scenario: News Provider API / RSS Down
1. `RSSProvider` or `WebCrawlerProvider` fails to fetch external feed.
2. Adapter catches exception, logs error, and returns empty array `[]`.
3. `NewsService` continues processing articles from other operational providers.

---

## 7. Business Rules
- **BR-1**: Frontend NEVER communicates with Python FastAPI directly — all requests go through NestJS API layer.
- **BR-2**: Providers must return normalized `RawArticle` format matching Section 27 fields (`crawledAt`, `relatedCoins`).
- **BR-3**: `NewsSentimentStrategy` must trigger `BUY` when average sentiment > +0.X, `SELL` when < -0.X, and `HOLD` otherwise. (X will be calibrated later)
- **BR-4**: Duplicate news articles (matching URL or identical title hash) must not be stored or re-analyzed within a 24-hour window.
- **BR-5**: When sentiment service is unreachable, system MUST degrade gracefully and issue `HOLD` signals.

---

## 8. Related
- **Contracts**: `kb/contracts/news.yaml`
- **ADRs**: ADR-0009, ADR-0010
- **Module Architecture**: `kb/modules/news-sentiment.md`
