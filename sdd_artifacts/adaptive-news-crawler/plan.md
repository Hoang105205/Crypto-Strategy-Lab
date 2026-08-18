# Implementation Plan: LLM-Assisted Adaptive Web Crawler with Selector Caching & Self-Healing

**Feature**: `adaptive-news-crawler` | **Date**: 2026-08-18 | **Spec**: [spec.md](file:///d:/STD/Y3/Y3S3/KienTrucPM/pj/sdd_artifacts/adaptive-news-crawler/spec.md)

---

## 1. Summary
Implement an adaptive web crawling subsystem within the News & Sentiment module according to [ADR-0014](file:///d:/STD/Y3/Y3S3/KienTrucPM/pj/kb/ADR/0014-llm-assisted-crawler-selector-caching.md). The crawler utilizes LLM-based semantic discovery for CSS selectors on initial domain setup or failure, persists rules in PostgreSQL (`CrawlerRule` table), executes fast HTML extraction via `cheerio` (<50ms, 0 LLM token cost) during periodic cron runs, normalizes articles to `RawArticle` with dynamic coin tagging from `TradingPair` DB, and integrates with the URL deduplication and Python VADER sentiment pipeline.

---

## 2. Technical Context
- **Language/Version**: TypeScript 5.7+ / Node.js 18+ (NestJS 11)
- **Primary Dependencies**: `cheerio` (fast server-side HTML DOM parser), `axios` (HTTP client), `@prisma/client` (database ORM)
- **Storage**: PostgreSQL database (`crawler_rules`, `news_articles`, `sentiment_scores` tables)
- **Testing**: Jest 30 (`npx jest src/news`) with mock HTML fixtures and fault isolation tests
- **Target Platform**: Node.js backend (`apps/backend`)
- **Project Type**: Modular Monolith Backend Service
- **Performance Goals**: Cheerio parsing < 50ms per HTML page; 99%+ periodic runs with 0 LLM API token consumption; sub-second E2E ingestion
- **Constraints**: Comply strictly with [ADR-0010](file:///d:/STD/Y3/Y3S3/KienTrucPM/pj/kb/ADR/0010-news-provider-adapter-pattern.md) (return `[]` on error without throwing), [ADR-0014](file:///d:/STD/Y3/Y3S3/KienTrucPM/pj/kb/ADR/0014-llm-assisted-crawler-selector-caching.md) (Selector Caching), and Constitution Art. II (Contract-Driven).

---

## 3. Constitution Check
*GATE: Must pass before implementation.*

| Principle | Status | Notes |
|---|:---:|---|
| **Art I. Architecture Quality** | ✅ PASS | Implements 3-Tier Adaptive Crawler Architecture (ADR-0014) extending Provider Adapter Pattern (ADR-0010). |
| **Art II. Contract-Driven** | ✅ PASS | Grounded in SSoT contract `kb/contracts/news.yaml` (`CrawlerRule` entity, `IAdaptiveCrawler` interface). |
| **Art III. Demonstrable Extensibility** | ✅ PASS | Demonstrates adding any new crypto news domain by URL alone; shows self-healing when HTML class names change. |
| **Art IV. Simplicity Over Cleverness** | ✅ PASS | Uses fast Cheerio DOM selector matching for 99.9% of runs; avoids complex headless browser overhead (Puppeteer) or unnecessary continuous LLM scraping. |
| **Art V. Knowledge Base as Truth** | ✅ PASS | KB contracts, modules, flows, and ADR-0014 fully updated prior to planning. |
| **Art VI. Explicit Over Implicit** | ✅ PASS | Strongly typed interfaces, explicit Prisma models, explicit database caching. |

---

## 4. Architecture Decision & Source Code Structure

### Architecture Alignment
- **Module Affected**: News & Sentiment Module (`apps/backend/src/news`)
- **Integration Points**:
  - `WebCrawlerProvider` implements `INewsProvider` and is provided under `INEWS_PROVIDER_TOKEN`.
  - `NewsCollectorCron` calls `NewsService.collectAllNews()`, which queries both `RSSProvider` and `WebCrawlerProvider`.
  - Database: `CrawlerRule` model in `prisma/schema.prisma`.
  - LLM Service: `CrawlerDiscoveryService` handles semantic HTML analysis and self-healing selector generation.

### Source Code File Layout

```text
workspace/apps/backend/src/news/
├── cron/
│   └── news-collector.cron.ts        # Periodic ingestion trigger (15m)
├── providers/
│   ├── news.provider.interface.ts     # INewsProvider contract
│   ├── rss.provider.ts                # RSS multi-feed adapter
│   ├── crawler.provider.ts            # [UPDATE] Fast Cheerio crawler with DB cached rules
│   └── crawler.provider.spec.ts       # [NEW] Unit tests for WebCrawlerProvider
├── services/
│   ├── crawler-discovery.service.ts   # [NEW] LLM Selector Discovery & Self-Healing Service
│   ├── crawler-discovery.service.spec.ts # [NEW] Unit tests for discovery service
│   ├── news.service.ts                # Orchestrator: Multi-provider collection, deduplication, DB save
│   └── sentiment.client.ts            # REST client to Python VADER service
├── strategies/
│   └── sentiment.strategy.ts          # NewsSentimentStrategy plugin
└── news.module.ts                     # NestJS DI configuration
```

---

## 5. Phase Breakdown

### Phase 1: Database Schema & Entity Setup
- Add `CrawlerRule` model to `workspace/apps/backend/prisma/schema.prisma`.
- Generate Prisma Client (`npx prisma generate`).
- Create seed data / initial rule for target domain (`decrypt.co`).

### Phase 2: Cheerio Fast Parsing & Discovery Service Implementation
- Install `cheerio` in `workspace/apps/backend`.
- Create `CrawlerDiscoveryService` (`apps/backend/src/news/services/crawler-discovery.service.ts`):
  - `discoverSelectors(htmlSample, domain)`: Analyzes HTML sample via LLM prompt and parses JSON CSS selectors.
  - `repairSelectors(htmlSample, domain)`: Self-healing selector updater.
- Update `WebCrawlerProvider` (`apps/backend/src/news/providers/crawler.provider.ts`):
  - Fetches active `CrawlerRule` from Prisma DB.
  - If rule not found, calls `CrawlerDiscoveryService` to discover and persist rule.
  - Fetches target HTML via Axios and parses article cards using `cheerio`.
  - Normalizes extracted items to `RawArticle` with dynamic coin tagging.
  - If 0 items parsed from active page, invokes Self-Healing recovery.
  - Catches all errors and returns `[]` (Fault Isolation).

### Phase 3: Ingestion Pipeline & NewsService Verification
- Verify `NewsService.collectAllNews()` aggregates articles from both `RSSProvider` and `WebCrawlerProvider`.
- Verify URL deduplication across both providers.
- Verify VADER sentiment enrichment and persistence.

### Phase 4: Unit Testing & SDD Verification
- Implement unit tests for `CrawlerDiscoveryService` (mock LLM responses, selector validation).
- Implement unit tests for `WebCrawlerProvider` (cached selector extraction, dynamic coin tagging, fault isolation, self-healing trigger).
- Run Jest test suite (`npx jest src/news`) $\rightarrow$ verify 100% pass.
- Run `npx tsc --noEmit` and `npx eslint` $\rightarrow$ 0 errors.
