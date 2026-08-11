# Tasks: Crypto News & Sentiment Analysis Pipeline

**Input**: Design documents from `sdd_artifacts/news-sentiment-pipeline/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/news-api.md`  

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, Foundation)
- Includes exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Verify project layout, directory structure, and shared types.

- [X] T001 Verify monorepo directory layout for News Module in `workspace/apps/backend/src/news/`, `workspace/apps/sentiment/`, and `workspace/apps/frontend/src/app/news/` per plan.md
- [X] T002 [P] Verify Python dependencies in `workspace/apps/sentiment/requirements.txt` (fastapi, uvicorn, vaderSentiment, pydantic) per research.md
- [X] T003 [P] Export shared news and sentiment types in `workspace/libs/shared/src/types/news.ts` per contracts/news-api.md

---

## Phase 2: Foundation

**Purpose**: Core database schema and ORM setup required before starting business logic.

- [X] T004 [Foundation] Update Prisma schema in `workspace/apps/backend/prisma/schema.prisma` with `NewsArticle` and `SentimentScore` entities per data-model.md
- [X] T005 [Foundation] Run Prisma client generation and migration (`npx prisma generate`, `npx prisma migrate dev --name add_news_sentiment`) in `workspace/apps/backend`
- [X] T006 [P] [Foundation] Register `PrismaService` dependency injection inside `workspace/apps/backend/src/news/news.module.ts` per plan.md

**Checkpoint**: Foundation ready — database entities and module skeleton available for business features.

---

## Phase 3: User Story 1 - Multi-Source News Ingestion & Normalization (Priority: P1) 🎯 MVP

**Goal**: Ingest crypto news from RSS and Web Crawlers, normalize into standard `NewsArticle` schema (`crawledAt`, `relatedCoins`), deduplicate by URL hash, and store in PostgreSQL.  
**Independent Test**: Trigger ingestion via service/cron, inspect DB, verify articles contain `crawledAt` and `relatedCoins`, and duplicate URLs are skipped.

### Implementation for User Story 1

- [X] T007 [P] [US1] Create `INewsProvider` interface and `RawArticle` interface in `workspace/apps/backend/src/news/providers/news.provider.interface.ts` per ADR-0010 and spec.md
- [X] T008 [P] [US1] Implement `RSSProvider` adapter in `workspace/apps/backend/src/news/providers/rss.provider.ts` to parse public RSS feeds (CoinDesk) and output `RawArticle[]`
- [X] T009 [P] [US1] Implement `WebCrawlerProvider` adapter in `workspace/apps/backend/src/news/providers/crawler.provider.ts` to scrape news portals and output `RawArticle[]`
- [X] T010 [US1] Implement `NewsService` in `workspace/apps/backend/src/news/services/news.service.ts` for normalization, deduplication by URL hash, and Prisma persistence (depends T007, T008, T009)
- [X] T011 [US1] Implement `NewsCollectorCron` in `workspace/apps/backend/src/news/cron/news-collector.cron.ts` using `@nestjs/schedule` to trigger periodic ingestion (depends T010)

**Checkpoint**: User Story 1 fully functional — news articles fetched, normalized, deduplicated, and persisted in database.

---

## Phase 4: User Story 2 - ML Sentiment Analysis & Process Isolation (Priority: P1) 🎯 MVP

**Goal**: Execute VADER sentiment analysis in an isolated Python FastAPI process on port 8000; connect NestJS via `SentimentClient` with 500ms timeout & graceful degradation fallback.  
**Independent Test**: Send text to Python `/analyze` and NestJS `SentimentClient`. Verify score (-1.0 to 1.0) and label (`POSITIVE`, `NEGATIVE`, `NEUTRAL`). Stop Python service and verify fallback `{ score: 0.0, label: "NEUTRAL" }` without crashing NestJS.

### Implementation for User Story 2

- [X] T012 [P] [US2] Implement Pydantic request/response models in `workspace/apps/sentiment/models.py` per contracts/news-api.md
- [X] T013 [P] [US2] Implement VADER sentiment intensity logic in `workspace/apps/sentiment/analyzer.py` returning compound score and classification label per research.md D1
- [X] T014 [US2] Implement FastAPI web server in `workspace/apps/sentiment/app.py` exposing `GET /health` and `POST /analyze` (depends T012, T013)
- [X] T015 [US2] Implement `SentimentClient` in `workspace/apps/backend/src/news/services/sentiment.client.ts` using `@nestjs/axios` / `fetch` with 500ms timeout & graceful degradation fallback (depends T014)
- [X] T016 [US2] Connect `NewsService` to `SentimentClient` to enrich ingested articles with `sentimentScore` and `sentimentLabel` upon storage (depends T010, T015)

**Checkpoint**: User Story 2 complete — process isolation verified; sentiment scores stored; graceful degradation operational when Python process is stopped.

---

## Phase 5: User Story 3 - News Feed & Aggregate Sentiment REST API (Priority: P2)

**Goal**: Expose REST API endpoints for Frontend News Feed and Sentiment Gauge.  
**Independent Test**: Call `GET /api/news?coin=BTC` and `GET /api/sentiment/aggregate?coin=BTC` via cURL / browser; verify JSON responses match `contracts/news-api.md`.

### Implementation for User Story 3

- [X] T017 [US3] Implement `NewsController` in `workspace/apps/backend/src/news/news.controller.ts` exposing `GET /api/news` and `GET /api/sentiment/aggregate` per contracts/news-api.md (depends T010, T016)
- [X] T018 [US3] Wire `NewsController`, `NewsService`, `SentimentClient`, `RSSProvider`, `WebCrawlerProvider`, and `NewsCollectorCron` into `workspace/apps/backend/src/news/news.module.ts` (depends T017)
- [X] T019 [P] [US3] Create `NewsFeed.tsx` component in `workspace/apps/frontend/src/components/news/NewsFeed.tsx` rendering article list with sentiment badges (`POSITIVE`, `NEGATIVE`, `NEUTRAL`)
- [X] T020 [US3] Create Next.js News page in `workspace/apps/frontend/src/app/news/page.tsx` integrating `NewsFeed.tsx` with coin filtering tabs (depends T019)

**Checkpoint**: User Story 3 complete — Next.js frontend renders live News Feed filtered by coin ticker.

---

## Phase 6: User Story 4 - Sentiment Strategy Plugin for Composite Trading (Priority: P1)

**Goal**: Implement `NewsSentimentStrategy` complying with `IStrategy` interface and register into `StrategyRegistry` for composite trading strategy creation (`MA + RSI + News Sentiment`).  
**Independent Test**: Register `NewsSentimentStrategy`, analyze market data + sentiment, verify signal emission (`BUY` > +0.X, `SELL` < -0.X, `HOLD` fallback).

### Implementation for User Story 4

- [X] T021 [US4] Implement `NewsSentimentStrategy` in `workspace/apps/backend/src/news/strategies/sentiment.strategy.ts` implementing `IStrategy` interface per spec.md (depends T010, T016)
- [X] T022 [US4] Register `NewsSentimentStrategy` into `StrategyRegistry` during module initialization in `workspace/apps/backend/src/news/news.module.ts` per ADR-0003 and plan.md (depends T021)

**Checkpoint**: User Story 4 complete — `NewsSentimentStrategy` registered and ready for backtesting in composite strategies.

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: End-to-end integration verification, fault tolerance validation, and documentation updates.

- [X] T023 Run quickstart validation scenarios in `sdd_artifacts/news-sentiment-pipeline/quickstart.md` (Scenario 1, 2, 3, 4)
- [X] T024 Verify fault tolerance: stop Python FastAPI process, trigger news API and backtest, verify NestJS does NOT crash and strategy returns `HOLD`
- [X] T025 Update `sdd_artifacts/news-sentiment-pipeline/.intent` status to completed

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundation (Phase 2)**: Depends on Setup — BLOCKS all user story database operations
- **User Stories (Phase 3 & 4 - P1 MVP)**: Depend on Foundation completion
- **User Stories (Phase 5 - P2 UI)**: Depends on Phase 3 & 4 backend APIs
- **User Stories (Phase 6 - Strategy Plugin)**: Depends on Phase 3 & 4 backend services
- **Polish (Phase 7)**: Depends on all user stories completion

### Parallel Opportunities
- All Setup [P] tasks (T002, T003) can run in parallel
- Providers (T007, T008, T009) can be developed in parallel
- Python ML models (T012, T013) can run in parallel with NestJS provider setup
- Frontend UI components (T019) can run in parallel with NestJS controller development

---

## Implementation Strategy

### MVP First (Phases 1-4)
1. Complete Phase 1: Setup & Types
2. Complete Phase 2: Foundation DB Migration
3. Complete Phase 3: User Story 1 Ingestion Pipeline
4. Complete Phase 4: User Story 2 Python ML Sentiment Service
5. **STOP and VALIDATE**: Verify End-to-End ingestion + sentiment analysis + graceful degradation
6. Proceed to Phase 5 (UI) & Phase 6 (Strategy Plugin)
