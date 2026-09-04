# Requirements Checklist: `adaptive-news-crawler`

**Feature**: `adaptive-news-crawler`  
**Created**: 2026-08-18  
**Status**: Active

## Functional Requirements
- [x] **FR-001 (Data Model)**: `CrawlerRule` model defined in `kb/contracts/news.yaml` and ready for Prisma schema.
- [x] **FR-002 (Provider Interface)**: `WebCrawlerProvider` implements `INewsProvider` interface contract.
- [x] **FR-003 (Fast Parsing)**: `cheerio` HTML parser extracts news articles using cached DB selectors.
- [x] **FR-004 (LLM Discovery)**: LLM service analyzes HTML samples and generates CSS selector schema.
- [x] **FR-005 (Self-Healing)**: Zero-extraction triggers re-discovery and updates `CrawlerRule` in DB.
- [x] **FR-006 (Data Normalization)**: Articles normalized with dynamic `relatedCoins` from `TradingPair` DB and `['GENERAL']` fallback.
- [x] **FR-007 (Pipeline Integration)**: Multi-provider ingestion (RSS + Crawler) with URL deduplication in `NewsService`.

## Non-Functional Requirements
- [x] **NFR-001 (Performance)**: Fast Cheerio parsing executes in <50ms per page.
- [x] **NFR-002 (Cost Optimization)**: Zero LLM token cost during normal periodic cron runs.
- [x] **NFR-003 (Fault Isolation)**: Unreachable web targets return `[]` cleanly per ADR-0010.
- [x] **NFR-004 (Code Quality)**: TypeScript and ESLint compliance with 0 errors.
- [x] **NFR-005 (Test Coverage)**: Full unit test suite with mock HTML fixtures and Jest runner.

## KB Cross-References
- [x] `kb/ADR/0014-llm-assisted-crawler-selector-caching.md`
- [x] `kb/contracts/news.yaml`
- [x] `kb/modules/news-sentiment.md`
- [x] `kb/flows/news-sentiment-pipeline.md`
- [x] `kb/GLOSSARY.md`
