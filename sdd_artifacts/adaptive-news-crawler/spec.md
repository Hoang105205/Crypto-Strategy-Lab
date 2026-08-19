# Feature Specification: LLM-Assisted Adaptive Web Crawler with Selector Caching & Self-Healing

**Feature**: `adaptive-news-crawler`  
**Created**: 2026-08-18  
**Status**: Draft  
**Owner**: Thuận (News & Sentiment Module)  
**Input**: User description: "Xây dựng bộ cào tin tức thích ứng LLM-Assisted Adaptive Web Crawler với Selector Caching và Self-Healing theo ADR-0014. Entity CrawlerRule trong Prisma PostgreSQL, LLM Discovery CSS Selectors, Fast Cheerio Parsing (<50ms, 0 token LLM), Data Normalization & Dynamic Coin Tagging, Self-Healing khi web đổi giao diện."

---

## 1. User Scenarios & Testing

### User Story 1 — Fast Cheerio HTML Parsing with Cached Selectors (Priority: P1)

As the automated News Ingestion Pipeline, I want `WebCrawlerProvider` to read pre-discovered CSS selectors (`CrawlerRule`) from PostgreSQL and parse live target web portals (e.g. `decrypt.co/news`) using `cheerio` in sub-second time (<50ms), so that news collection runs continuously every 15 minutes at zero LLM token cost.

**Why this priority**: Core execution tier (Tier 2 in ADR-0014). Ensures 99.9% of crawling runs are ultra-fast, predictable, and free of recurring LLM API costs.  
**Independent Test**: Mock/load target HTML, execute `WebCrawlerProvider.fetchLatest()`, verify articles are parsed using cached `CrawlerRule` via Cheerio in <50ms without invoking LLM.

**Acceptance Scenarios**:
1. **Given** an active `CrawlerRule` for domain `decrypt.co` in PostgreSQL, **When** `WebCrawlerProvider.fetchLatest()` is called, **Then** it fetches HTML and extracts articles matching the title, content, date, and link selectors via Cheerio without calling LLM.
2. **Given** 10 HTML article cards in the fetched page, **When** parsed with valid `CrawlerRule`, **Then** exactly 10 raw items are returned with non-empty titles and valid URLs.

---

### User Story 2 — LLM-Assisted CSS Selector Discovery (Priority: P1)

As a Developer or System Administrator, I want to onboard a new crypto news website (or auto-discover an unconfigured domain) by passing an HTML sample to an LLM, so that the system automatically extracts and validates CSS selectors (`containerSelector`, `titleSelector`, `contentSelector`, `linkSelector`, `dateSelector`) and persists them as a `CrawlerRule` in PostgreSQL.

**Why this priority**: Solves the brittle selector problem of traditional web crawlers. Enables zero-code domain onboarding per requirement §28 and ADR-0014.  
**Independent Test**: Provide an HTML snippet of a news portal, invoke `discoverSelectors(htmlSample, domain)`, verify returned JSON matches `CrawlerRule` schema and is successfully stored in PostgreSQL.

**Acceptance Scenarios**:
1. **Given** an unconfigured crypto news portal URL (e.g. `https://decrypt.co/news`), **When** selector discovery is triggered, **Then** LLM analyzes the DOM structure and returns valid CSS selectors.
2. **Given** the discovered selectors JSON, **When** saved, **Then** a new `CrawlerRule` record is created in PostgreSQL with `isActive: true` and `lastDiscoveredAt: now()`.

---

### User Story 3 — Data Normalization & Dynamic Coin Extraction (Priority: P1)

As a Trading Strategy Engine and Frontend UI, I want all articles extracted by `WebCrawlerProvider` to be converted into canonical `RawArticle` / `NewsArticle` formats with dynamic `relatedCoins` tags matching active `TradingPair` DB records (or falling back to `['GENERAL']`), so that crawler news integrates seamlessly with RSS news.

**Why this priority**: Enforces Single Source of Truth (SSoT) contract in `kb/contracts/news.yaml` and avoids data contamination.  
**Independent Test**: Pass extracted HTML items through normalization, verify `source`, `crawledAt`, `publishedAt`, and `relatedCoins` are populated accurately.

**Acceptance Scenarios**:
1. **Given** an extracted web article mentioning "Ethereum L2", **When** normalized against active trading pairs `['BTC', 'ETH', 'SOL']`, **Then** `relatedCoins` contains `['ETH']`.
2. **Given** an extracted macro economic article mentioning "Federal Reserve inflation rate", **When** normalized, **Then** `relatedCoins` defaults to `['GENERAL']`.

---

### User Story 4 — Self-Healing Selector Recovery (Priority: P2)

As a Resilient News Crawler, I want the system to detect when a target website redesigns its HTML layout (causing cached selectors to extract 0 items), and automatically trigger an LLM re-discovery cycle to update the `CrawlerRule` in PostgreSQL, so that the crawling pipeline heals automatically without developer intervention.

**Why this priority**: Critical reliability attribute (Tier 3 in ADR-0014). Prevents silent crawler degradation.  
**Independent Test**: Simulate HTML with modified class names against an old `CrawlerRule`, verify 0 items triggers self-healing re-discovery, updates `CrawlerRule`, and successfully extracts articles.

**Acceptance Scenarios**:
1. **Given** a target portal updates its HTML classes, **When** `WebCrawlerProvider` extracts 0 articles using cached rule, **Then** it marks the rule as needing repair and triggers LLM selector discovery on the new HTML.
2. **Given** LLM re-discovery generates updated selectors, **When** PostgreSQL `CrawlerRule` is updated, **Then** subsequent parse retry succeeds and returns extracted articles.

---

### User Story 5 — Multi-Provider Pipeline Integration & Deduplication (Priority: P2)

As the central `NewsService`, I want to invoke both `RSSProvider` and `WebCrawlerProvider` concurrently, deduplicate incoming articles by URL hash, send new articles to the isolated Python FastAPI VADER service, and persist `NewsArticle` + `SentimentScore` in PostgreSQL.

**Why this priority**: Requirement §27-30 compliance. Connects crawler output to the full end-to-end sentiment analysis and UI pipeline.  
**Independent Test**: Run `NewsService.collectAllNews()`, verify articles from both RSS and Web Crawler are deduplicated, scored by VADER, and stored in PostgreSQL.

**Acceptance Scenarios**:
1. **Given** `RSSProvider` returns 15 articles and `WebCrawlerProvider` returns 10 articles (with 2 overlapping URLs), **When** `collectAllNews()` executes, **Then** exactly 23 unique articles are persisted and scored.
2. **Given** the Python FastAPI sentiment service is online, **When** crawler articles are processed, **Then** `sentimentScore` and `sentimentLabel` are populated for each article.

---

## 2. Edge Cases & Error Handling

1. **Target Website Blocks or Times Out**: `WebCrawlerProvider` catches HTTP/network timeout errors, logs a warning, and returns `[]` (Fault Isolation per ADR-0010). The RSS pipeline continues uninterrupted.
2. **Relative URLs in Extracted Links**: Crawler link extractor prepends the base domain (e.g. `/news/123` $\rightarrow$ `https://decrypt.co/news/123`).
3. **Invalid Date Format in HTML**: If date selector cannot be parsed into a valid Date object, fallback to `new Date().toISOString()`.
4. **LLM Discovery Unavailability**: If LLM API fails during discovery/self-healing, the crawler logs an error and returns `[]`, preserving the last known rule in DB for retry on next cron tick.

---

## 3. Requirements

### Functional Requirements
- **FR-001**: System MUST create a `CrawlerRule` model in Prisma PostgreSQL storing `domain`, `targetUrl`, `containerSelector`, `titleSelector`, `contentSelector`, `linkSelector`, `dateSelector`, `isActive`, and `lastDiscoveredAt`.
- **FR-002**: `WebCrawlerProvider` MUST implement `INewsProvider` interface and return `Promise<RawArticle[]>`.
- **FR-003**: In standard runs, `WebCrawlerProvider` MUST fetch active `CrawlerRule` from PostgreSQL and extract articles via `cheerio` without calling LLM.
- **FR-004**: When no rule exists for a configured target URL, the system MUST invoke LLM Discovery to generate CSS selectors and save the resulting `CrawlerRule` to PostgreSQL.
- **FR-005**: When cached selectors yield 0 articles on an active target, the system MUST trigger the Self-Healing flow (LLM re-discovery $\rightarrow$ DB update $\rightarrow$ re-parse).
- **FR-006**: Extracted articles MUST be normalized to `RawArticle` format with dynamic `relatedCoins` matching active `TradingPair` records (or `['GENERAL']`).
- **FR-007**: `NewsService` MUST deduplicate articles across all providers (RSS + Crawler) by URL before sentiment analysis and database storage.

### Non-Functional Requirements
- **NFR-001 (Performance)**: Cheerio HTML parsing using cached `CrawlerRule` MUST execute in less than 50ms per page.
- **NFR-002 (Cost Efficiency)**: 99%+ of periodic crawling executions MUST incur 0 LLM API token costs.
- **NFR-003 (Fault Isolation)**: Any failure in `WebCrawlerProvider` MUST return `[]` without throwing exceptions or affecting `RSSProvider` or NestJS stability (ADR-0010).
- **NFR-004 (Code Quality)**: All backend code MUST pass `npx tsc --noEmit` and `npx eslint` with 0 errors.
- **NFR-005 (Test Coverage)**: Module MUST include comprehensive unit tests covering cached parsing, selector discovery fallback, normalization, and fault isolation.
