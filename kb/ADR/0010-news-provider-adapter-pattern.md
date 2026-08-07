# ADR-0010: News Provider Adapter Pattern

## Status
Accepted

## Context
Cryptocurrency news articles originate from a wide variety of external data sources: RSS feeds (e.g., CoinDesk, Cointelegraph), specialized REST APIs (e.g., CryptoPanic API), news portals, and custom web crawlers.

Coupling the news collection logic directly to a specific website or crawler (e.g., `Trading System ❌ Website A Crawler`) violates project spec (*"News không được gắn cứng với một crawler"*). The system must be capable of receiving news from any provider, normalizing raw payloads into a standardized `NewsArticle` schema (`id, title, content, source, publishedAt, crawledAt, relatedCoins, url`), and passing normalized articles to downstream components without modifying existing code.

## Decision Drivers
- **Decoupled Architecture**: News Providers must be decoupled from downstream storage, sentiment analysis, and strategy execution.
- **Open-Closed Principle (OCP)**: Adding a new news source must require adding 1 new adapter class, zero changes to existing code.
- **Data Normalization**: All providers must output unified `RawArticle` format containing `crawledAt` and `relatedCoins`.
- **Fault Isolation**: Failure of one RSS feed or news provider must not affect other operational providers.

## Considered Options
1. **Hardcoded ingestion methods** — Write crawler logic directly inside `NewsService` for each website. Fails OCP, high coupling, breaks when websites change structure.
2. **Generic third-party aggregator dependency** — Rely exclusively on a single paid external aggregator. Fails fallback requirements and adds vendor lock-in.
3. **Provider Adapter Pattern (`INewsProvider`)** — Define an abstract interface `INewsProvider` with `fetchLatest(limit?, coin?): Promise<RawArticle[]>`. Implement concrete adapters (`RSSProvider`, `CryptoPanicProvider`, `WebCrawlerProvider`). `NewsService` iterates over injected provider instances.

## Decision Outcome
Chosen option: **Provider Adapter Pattern (`INewsProvider`)**, because it enforces complete decoupling, adheres to OCP, and seamlessly standardizes diverse news payloads.

### Component Structure & Architecture Diagram

```
         News Provider Abstraction (INewsProvider)
                        ↑
     ┌──────────────────┼──────────────────┐
     │                  │                  │
RSSProvider       CryptoPanicProvider  WebCrawlerProvider
(CoinDesk RSS)     (CryptoPanic API)    (Custom Crawler)
     │                  │                  │
     └──────────────────┼──────────────────┘
                        │ (Unified RawArticle[])
                        ▼
             ┌─────────────────────┐
             │     NewsService     │
             └──────────┬──────────┘
                        │ (Normalized NewsArticle Entity)
                        ▼
             ┌─────────────────────┐
             │   PostgreSQL DB     │
             └─────────────────────┘
```

### Provider Adapter Rules
1. **Interface Contract**: All news adapters MUST implement `INewsProvider` and export `fetchLatest(limit?: number, coin?: string): Promise<RawArticle[]>`.
2. **Schema Uniformity**: Adapters MUST populate `publishedAt`, `crawledAt`, `source`, `relatedCoins`, and `url`.
3. **Fault Isolation**: Adapters catch their own HTTP/parsing errors and return empty arrays `[]` rather than throwing, preventing pipeline failure.
4. **Deduplication**: `NewsService` deduplicates normalized articles by URL hash across all providers before saving to PostgreSQL.

### Consequences
- **Positive**: High modifiability — adding a new news provider requires 1 new file implementing `INewsProvider`. Downstream modules (`NewsService`, DB, UI) require zero changes.
- **Positive**: Strict data normalization across diverse external news sources.
- **Positive**: Individual provider failures are contained and do not crash the news pipeline.
- **Negative**: Requires writing mapping logic inside each adapter to normalize raw JSON/XML into `RawArticle`.
- **Risks**: External HTML structure changes may break specific crawlers. Mitigated by adapter-level error handling returning empty arrays.

## Links
- Relates to ADR-0004 (Adapter Pattern for Data Sources — Binance Market Data Adapter)
- Relates to ADR-0003 (Plugin Architecture — `NewsSentimentStrategy`)
- Relates to ADR-0001 (Record Architecture Decisions)
- Affects: `kb/modules/news-sentiment.md` (Sections 2, 3, 7)
- Affects: `kb/contracts/news.yaml` (INewsProvider interface)
