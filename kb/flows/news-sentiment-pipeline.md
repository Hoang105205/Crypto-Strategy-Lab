# Business Flow: News & Sentiment Pipeline

> **Owner**: Thuận  
> **Status**: Active  
> **Last Updated**: 2026-08-25

## 1. Overview
- **Description**: Crypto news articles are collected periodically via provider adapters (RSS multi-feeds and LLM-assisted adaptive web crawlers), normalized into a standard schema (`id, title, content, source, publishedAt, crawledAt, relatedCoins, url`), scored for sentiment by an isolated Python FastAPI ML service, stored in PostgreSQL, and fed into both the Next.js Frontend (with 24h sentiment breakdown ratios and an on-demand crawl button with a 2-minute cooldown anti-spam timer) and `NewsSentimentStrategy` for composite strategy creation (`MA + RSI + News Sentiment`).
- **Primary Actor**: Cron Scheduler (5m) / On-Demand User Request (`POST /api/news/crawl`)
- **Business Value**: Enriches market data with real-time news sentiment and provides a non-technical analysis signal source for composite trading strategies.
- **Modules Involved**: News & Sentiment Module (NestJS + Python FastAPI), Strategy Engine (Consumer of `NewsSentimentStrategy`), Frontend (Consumer of News Feed REST API).

---

## 2. Preconditions
- Python FastAPI Sentiment Service is running on `http://localhost:8000` (or NestJS is prepared for graceful degradation).
- Database schema applied for `NewsArticle`, `SentimentScore`, and `CrawlerRule` tables in PostgreSQL.
- Active network connection available for news providers (RSS feeds and Web Crawler targets).

---

## 3. Flow Steps

1. **Trigger**: `NewsCollectorCron` triggers on schedule (every 5 minutes) or user hits `POST /api/news/crawl` on demand.
2. **Rate-Limit & Concurrency Check (For On-Demand)**:
   - If manual crawl was triggered < 120 seconds ago, return HTTP `429 Too Many Requests` with remaining `retryAfterSeconds`.
   - If another crawl execution is in-flight, return HTTP `409 Conflict`.
3. **Decoupled Multi-Provider Ingestion**:
   - `NewsService` queries active `TradingPair` symbols from PostgreSQL.
   - For `RSSProvider`: Fetches and parses live XML feeds from CoinDesk, CoinTelegraph, Decrypt.
   - For `WebCrawlerProvider`: Reads cached `CrawlerRule` from PostgreSQL. If rules exist, parses HTML via `cheerio` (<50ms); if missing or failing, triggers LLM selector discovery (ADR-0014), saves rule to DB, and extracts articles.
4. **Normalize, Tag & Deduplicate**: Each provider converts raw items to `RawArticle` format and extracts matching coins from the active `TradingPair` list. Articles mentioning non-trading coins or macro economics are tagged with `relatedCoins: ['GENERAL']`. `NewsService` deduplicates articles by URL hash and assigns `crawledAt` timestamp.
5. **Persist Raw Articles**: `NewsService` stores unique articles into PostgreSQL database.
6. **Sentiment Scoring Request**: `NewsService` forwards article text (title + content summary) to `SentimentClient`.
7. **ML Inference**: `SentimentClient` issues HTTP POST `/analyze` request to Python FastAPI ML service (500ms timeout).
8. **Score & Classification**: Python VADER model classifies sentiment (`POSITIVE`, `NEGATIVE`, `NEUTRAL`) and calculates compound score (`-1.0` to `+1.0`).
9. **Persist Sentiment**: `NewsService` saves the resulting `SentimentScore` linked to `NewsArticle` in PostgreSQL.
10. **Display & Strategy Plugin**:
    - **Frontend UI**: Next.js fetches dynamic coin list from `GET /api/market-data/pairs` and queries paginated news `GET /api/news?limit=10&offset=0&coin=BTC` and aggregate score with breakdown ratios `GET /api/sentiment/aggregate?coin=BTC` (`positiveRatio`, `neutralRatio`, `negativeRatio`). Renders the 3-color breakdown bar and enables the "Cào tin ngay" button with 2-minute countdown timer (OP.GG style).
    - **Strategy Engine**: `NewsSentimentStrategy` queries aggregate sentiment score for specific target coins (100% weight). Search engine can combine it into composite strategies (`MA + RSI + News Sentiment`).

---

## 4. Postconditions
- Articles are deduplicated, normalized, tagged with accurate coins (or `GENERAL`), and saved with sentiment classification (`POSITIVE`/`NEGATIVE`/`NEUTRAL`) and score.
- Latest market aggregate sentiment score and distribution ratios are updated per coin and timeframe.
- `CrawlerRule` table stores optimized CSS selectors for fast subsequent crawling.
- `NewsSentimentStrategy` is registered in `StrategyRegistry` and ready for backtesting in composite strategies.

---

## 5. Alternative Paths

### Manual On-Demand Crawl via UI (with 2-Minute Cooldown)
- User clicks `[ ⚡ Cào tin mới ]` on Next.js Frontend (`NewsFeed.tsx`).
- Frontend disables button, saves `lastCrawlTime` to `localStorage`, and starts a 120-second countdown timer.
- Request calls NestJS `POST /api/news/crawl`.
- `NewsService` executes full ingestion pipeline immediately, persists new articles, and returns `{ success: true, count: number }`.
- Frontend automatically re-fetches news articles and aggregate mood without full page reload.

### Offset Pagination & Multi-Coin Load More (Frontend)
- User opens Next.js News Feed (`app/news/page.tsx`).
- Initial load requests `GET /api/news?limit=10&offset=0&coin=ALL`.
- When user clicks "Load More", Frontend requests `GET /api/news?limit=10&offset=10&coin=ALL`.
- Backend executes `findMany({ skip: offset, take: limit })` with coin filters.

---

## 6. Error & Exception Flows

### Exception Scenario 1: Python Sentiment Service Down / Unreachable
1. `SentimentClient` attempts HTTP POST `/analyze` to `http://localhost:8000`.
2. Connection fails or times out (500ms timeout).
3. `SentimentClient` logs warning and returns fallback object: `{ score: 0.0, label: "NEUTRAL" }`.
4. `NewsService` stores news article with fallback neutral score.
5. `NewsSentimentStrategy` detects neutral fallback and returns `HOLD` signal.
6. **Result**: NestJS server, candlestick charts, and trading search loop continue running seamlessly without crashing (Graceful Degradation per ADR-0009).

### Exception Scenario 2: Manual Crawl Cooldown Active (Spam Prevention)
1. User or bot sends `POST /api/news/crawl` within 120 seconds of the previous run.
2. Backend detects `elapsed < 120000ms`, logs notice, and returns `429 Too Many Requests` with `{ error: "Rate limit exceeded", retryAfterSeconds }`.
3. Frontend shows remaining countdown timer and toast warning.

### Exception Scenario 3: Website Redesign / Stale Crawler Selectors (Self-Healing)
1. `WebCrawlerProvider` executes fast HTML extraction with cached `CrawlerRule` from DB.
2. Target website changed CSS classes, resulting in 0 articles extracted.
3. `WebCrawlerProvider` detects extraction failure and triggers **LLM Re-discovery Cycle** (ADR-0014).
4. LLM analyzes updated HTML sample, returns new CSS selectors, and updates `CrawlerRule` in PostgreSQL.
5. Extraction retries with new selectors and succeeds.

### Exception Scenario 4: News Provider API / RSS Down
1. `RSSProvider` or `WebCrawlerProvider` fails to fetch external feed.
2. Adapter catches exception, logs error, and returns empty array `[]` (Fault Isolation per ADR-0010 without returning mock data).
3. `NewsService` continues processing articles from other operational providers.

---

## 7. Business Rules
- **BR-1**: Frontend NEVER communicates with Python FastAPI directly — all requests go through NestJS API layer.
- **BR-2**: Providers must return normalized `RawArticle` format matching Section 27 fields (`crawledAt`, `relatedCoins`).
- **BR-3**: `NewsSentimentStrategy` must trigger `BUY` when average sentiment > +0.X, `SELL` when < -0.X, and `HOLD` otherwise.
- **BR-4**: Duplicate news articles (matching URL or identical title hash) must not be stored or re-analyzed within a 24-hour window.
- **BR-5**: When sentiment service is unreachable, system MUST degrade gracefully and issue `HOLD` signals.
- **BR-6**: Articles not matching any active `TradingPair` in PostgreSQL MUST be tagged with `['GENERAL']` (preventing artificial contamination of BTC).
- **BR-7**: `WebCrawlerProvider` MUST use cached `CrawlerRule` for regular ingestion to prevent unnecessary LLM token costs, invoking LLM only on discovery or self-healing triggers (ADR-0014).

---

## 8. Related
- **Contracts**: `kb/contracts/news.yaml`
- **ADRs**: ADR-0009, ADR-0010, ADR-0014
- **Module Architecture**: `kb/modules/news-sentiment.md`
