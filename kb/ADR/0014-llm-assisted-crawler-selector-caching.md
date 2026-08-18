# ADR-0014: LLM-Assisted Adaptive Web Crawler with Selector Caching & Self-Healing

## Status
Accepted

## Context
Cryptocurrency market movements are heavily influenced by news and macroeconomic releases (§27). Requirement §28 mandates that the news ingestion pipeline must not be tightly coupled to a single crawler or news provider (`Trading System ❌ Website A Crawler`).

Traditional web crawlers rely on hardcoded CSS selectors (e.g., `div.article-card`, `h2.headline`, `p.summary`). This approach introduces two critical architectural flaws:
1. **Fragility & High Maintenance**: When websites redesign or modify their HTML/CSS class names, hardcoded crawlers break immediately and require manual developer intervention.
2. **Naive LLM Scraping Inefficiency**: Feeding full HTML documents to a Large Language Model (LLM) on every 15-minute cron ingestion cycle is computationally wasteful, slow (3–10s latency per page), and financially unsustainable due to continuous token consumption.

The system requires an intelligent, self-healing crawling mechanism that combines semantic understanding with high-performance, cost-effective execution.

## Decision Drivers
- **Zero-Code Extensibility**: Adding new crypto news portals should require only providing target URLs, without writing custom scraping scripts.
- **Cost & Latency Optimization**: Daily/periodic crawling must run at near-zero LLM cost ($O(1)$ fast HTML parsing) with sub-second execution.
- **Schema & Selector Persistence**: CSS selector rules discovered by the LLM must be persisted in PostgreSQL (`CrawlerRule`) for long-term reuse.
- **Self-Healing Resilience**: When a target site redesigns and cached selectors fail (extracting 0 articles or corrupt fields), the system must automatically trigger an LLM re-discovery cycle to heal its rules.
- **Data Normalization**: Extracted articles must seamlessly map to the canonical `RawArticle` / `NewsArticle` schema (`id, title, content, source, publishedAt, crawledAt, relatedCoins, url`).

## Considered Options
1. **Hardcoded CSS Selectors per Website** — High maintenance, brittle, breaks on site redesigns.
2. **Direct LLM Extraction on Every Run** — Sends full HTML to LLM every 15 minutes. Very high API cost, high latency, rate-limit vulnerability.
3. **Two-Tier Adaptive Crawler with Selector Caching & Self-Healing (Chosen)**:
   - **Tier 1 (LLM Discovery)**: On initial domain registration (or upon selector failure), a lightweight HTML sample is sent to the LLM to discover semantic CSS selectors (`container`, `title`, `content`, `link`, `date`).
   - **Tier 2 (Database Persistence & Fast Parsing)**: Discovered selectors are saved to PostgreSQL (`CrawlerRule`). Regular cron cycles fetch cached rules from DB and parse HTML via `cheerio` in milliseconds without calling LLM.
   - **Tier 3 (Self-Healing Loop)**: If parsing with cached selectors yields 0 articles, a re-discovery event is triggered to update the DB rule.

## Decision Outcome
Chosen option: **Option 3 — Two-Tier Adaptive Crawler with Selector Caching & Self-Healing**.

### Architecture & Data Flow Diagram

```text
                                 ┌──────────────────────────────────────────────┐
                                 │           1. INITIAL DISCOVERY               │
                                 │  Fetch HTML Sample ──> LLM Analyzes Structure│
                                 └──────────────────────┬───────────────────────┘
                                                        │ Discovered CSS Selectors (JSON)
                                                        ▼
                                 ┌──────────────────────────────────────────────┐
                                 │          2. DATABASE PERSISTENCE             │
                                 │ Save to PostgreSQL `CrawlerRule` Table       │
                                 └──────────────────────┬───────────────────────┘
                                                        │
                      ┌─────────────────────────────────┴─────────────────────────────────┐
                      ▼                                                                   ▼
    ┌───────────────────────────────────────────────┐                   ┌───────────────────────────────────┐
    │     3. FAST PERIODIC CRAWLING (99.9% Runs)    │                   │   4. SELF-HEALING FALLBACK LOOP   │
    │ • Load cached `CrawlerRule` from DB           │                   │ • Site redesign detected (0 items)│
    │ • Fast HTML extraction via `cheerio` (<50ms)  │                   │ • Auto-trigger LLM re-discovery   │
    │ • Zero LLM token cost & low latency           │                   │ • Update `CrawlerRule` in DB      │
    └──────────────────────┬────────────────────────┘                   └───────────────────────────────────┘
                           │
                           ▼ (Normalized RawArticle[])
    ┌───────────────────────────────────────────────┐
    │     5. DEDUPLICATION & SENTIMENT PIPELINE     │
    │ Deduplicate URL ──> Python VADER ML ──> UI/DB │
    └───────────────────────────────────────────────┘
```

### Database Schema: `CrawlerRule` Entity
```yaml
CrawlerRule:
  id: string (uuid)
  domain: string # e.g., 'decrypt.co'
  targetUrl: string # e.g., 'https://decrypt.co/news'
  containerSelector: string # e.g., 'article.post-card'
  titleSelector: string # e.g., 'h3.post-title'
  contentSelector: string # e.g., 'p.post-excerpt'
  linkSelector: string # e.g., 'a.story-link'
  dateSelector: string # e.g., 'time'
  isActive: boolean # default true
  lastDiscoveredAt: string (ISO8601)
  createdAt: string (ISO8601)
  updatedAt: string (ISO8601)
```

### Consequences
- **Positive**: Complete compliance with requirement §28 and ADR-0010.
- **Positive**: 99%+ reduction in LLM API costs compared to naive LLM scraping.
- **Positive**: Self-healing ensures uninterrupted news ingestion when third-party sites update layouts.
- **Positive**: Perfect decoupling: `NewsService` receives standard `RawArticle[]` regardless of source.
- **Trade-offs**: Requires an LLM provider integration (e.g. Gemini / OpenAI / local model) during discovery phase. Mitigated by fallback to default RSS ingestion if LLM is unavailable.

## Links
- Extends ADR-0010 (News Provider Adapter Pattern)
- Relates to ADR-0009 (Sentiment Service as Separate Process)
- Affects: `kb/contracts/news.yaml` (CrawlerRule entity)
- Affects: `kb/modules/news-sentiment.md` (Sections 2, 3, 4, 5, 6)
- Affects: `kb/flows/news-sentiment-pipeline.md` (Steps 2, 3 and Error flows)
