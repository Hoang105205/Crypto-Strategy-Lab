# Tasks: LLM-Assisted Adaptive Web Crawler with Selector Caching & Self-Healing

**Feature**: `adaptive-news-crawler`  
**Input**: Design documents from `sdd_artifacts/adaptive-news-crawler/`  
**Prerequisites**: [spec.md](file:///d:/STD/Y3/Y3S3/KienTrucPM/pj/sdd_artifacts/adaptive-news-crawler/spec.md), [plan.md](file:///d:/STD/Y3/Y3S3/KienTrucPM/pj/sdd_artifacts/adaptive-news-crawler/plan.md), [data-model.md](file:///d:/STD/Y3/Y3S3/KienTrucPM/pj/sdd_artifacts/adaptive-news-crawler/data-model.md)  
**Dedicated Crawler Sources**: `theblock.co` and `cryptoslate.com` (100% distinct from the 3 RSS sources: CoinDesk, CoinTelegraph, Decrypt).

---

## Phase 1: Setup & Database Schema

**Purpose**: Database model setup, dependencies, and initial domain seeding.

- [ ] T001 [Setup] Install `cheerio` and `@types/cheerio` in `workspace/apps/backend/package.json`.
- [ ] T002 [Foundation] Add `CrawlerRule` model to `workspace/apps/backend/prisma/schema.prisma` and execute `npx prisma db push && npx prisma generate`.
- [ ] T003 [P] [Foundation] Seed initial `CrawlerRule` records for distinct web targets (`theblock.co`, `cryptoslate.com`) in `workspace/apps/backend/prisma/seed.ts` and ensure automatic startup initialization.

---

## Phase 2: LLM Discovery & Self-Healing Service (US2, US4)

**Purpose**: Semantic selector discovery and automatic rule repair.

- [ ] T004 [US2/US4] Implement `CrawlerDiscoveryService` in `workspace/apps/backend/src/news/services/crawler-discovery.service.ts` with DOM heuristic analysis, LLM selector discovery, and self-healing rule repair.
- [ ] T005 [P] [US2/US4] Create comprehensive unit test suite in `workspace/apps/backend/src/news/services/crawler-discovery.service.spec.ts` testing selector discovery from HTML samples and repair logic.

---

## Phase 3: Fast Cheerio Extraction & Provider Adapter (US1, US3)

**Purpose**: Ultra-fast HTML parsing (<50ms, 0 token LLM), dynamic coin extraction, and provider interface compliance.

- [ ] T006 [US1/US3] Implement `WebCrawlerProvider` in `workspace/apps/backend/src/news/providers/crawler.provider.ts` integrating cached `CrawlerRule` lookup from Prisma, Cheerio DOM extraction, relative URL resolution, dynamic `relatedCoins` matching against `TradingPair` DB (fallback `['GENERAL']`), and self-healing trigger.
- [ ] T007 [P] [US1/US3] Create comprehensive unit test suite in `workspace/apps/backend/src/news/providers/crawler.provider.spec.ts` testing cached rule parsing, dynamic coin tagging, distinct source tagging (`The Block Web` / `CryptoSlate Web`), self-healing recovery, and fault isolation (`[]` on error).

---

## Phase 4: Module Integration & End-to-End Verification (US5)

**Purpose**: Wire all components into `NewsModule`, verify multi-provider deduplication, and execute full automated test suite.

- [ ] T008 [US5] Register `CrawlerDiscoveryService` and update `WebCrawlerProvider` injection in `workspace/apps/backend/src/news/news.module.ts`.
- [ ] T009 [US5] Verify `NewsService.collectAllNews()` in `workspace/apps/backend/src/news/services/news.service.ts` consumes both `RSSProvider` (CoinDesk, CoinTelegraph, Decrypt) and `WebCrawlerProvider` (The Block / CryptoSlate), deduplicates by URL, scores via Python VADER ML, and saves to PostgreSQL.
- [ ] T010 [Verify] Execute full Jest test suite across `src/news` (`npx jest src/news --verbose`) and verify 100% pass across all test suites.
- [ ] T011 [Verify] Execute backend TypeScript compilation (`npx tsc --noEmit -p tsconfig.json`) and verify 0 errors.
