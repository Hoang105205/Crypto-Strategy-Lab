# Tasks: News Feed Offset Pagination & Multi-Coin Filter

**Input**: Design documents from `sdd_artifacts/news-pagination-multicoin/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/news-api.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Verify environment and KB contract synchronization

- [x] T001 Verify project KB contract definitions in `kb/contracts/news.yaml` and `sdd_artifacts/news-pagination-multicoin/contracts/news-api.md`
- [x] T002 [P] Verify monorepo dependencies and shared constants in `workspace/libs/shared/src/constants/news.constants.ts`

---

## Phase 2: Foundation

**Purpose**: Core infrastructure that MUST complete before User Stories start

- [x] T003 [Foundation] Ensure Prisma schema `NewsArticle` indexes exist for `publishedAt` and `relatedCoins` per `sdd_artifacts/news-pagination-multicoin/data-model.md`

---

## Phase 3: User Story 1 - Offset Pagination & Numbered Navigation (Priority: P1) 🎯 MVP

**Goal**: Support offset-based pagination (`limit`, `offset`) returning metadata (`total`, `limit`, `offset`, `hasMore`) for both Load More and Numbered Navigation `< 1 2 3 ... X >`
**Independent Test**: Execute `GET /api/news?limit=10&offset=0` for page 1, and `GET /api/news?limit=10&offset=10` for page 2, verifying page 2 items don't overlap page 1.

### Implementation for User Story 1

- [x] T004 [US1] Update `NewsService.getLatestNews` signature and implementation in `workspace/apps/backend/src/news/services/news.service.ts` to accept `limit` and `offset`, using Prisma `findMany({ skip: offset, take: limit })` and `count()`
- [x] T005 [US1] Update `NewsController.getNews` in `workspace/apps/backend/src/news/news.controller.ts` to extract `@Query('offset')`, call `newsService.getLatestNews()`, and return `{ success: true, data, pagination }` per `sdd_artifacts/news-pagination-multicoin/contracts/news-api.md`
- [x] T006 [US1] Update `NewsFeed.tsx` in `workspace/apps/frontend/src/components/news/NewsFeed.tsx` to handle offset-based fetch requests for Load More and Numbered Navigation `< 1 2 3 ... X >`

---

## Phase 4: User Story 2 - Multi-Coin Filtering (Priority: P1)

**Goal**: Support filtering news articles by single coin (`coin=BTC`) or multiple coins (`coins=BTC,ETH,SOL`)
**Independent Test**: Execute `GET /api/news?coins=BTC,ETH` and verify all returned items contain 'BTC' or 'ETH' in `relatedCoins`.

### Implementation for User Story 2

- [x] T007 [US2] Update `NewsService.getLatestNews` and `NewsService.getAggregateSentiment` in `workspace/apps/backend/src/news/services/news.service.ts` to accept `coins?: string[]` and execute Prisma `hasSome` filter
- [x] T008 [US2] Update `NewsController` endpoints in `workspace/apps/backend/src/news/news.controller.ts` to parse comma-separated `@Query('coins')` and pass array to `newsService`
- [x] T009 [US2] Update `NewsFeed.tsx` in `workspace/apps/frontend/src/components/news/NewsFeed.tsx` to allow selecting multi-coin filters and querying updated API endpoints

---

## Phase 5: Polish & Validation

**Purpose**: End-to-end verification and documentation

- [x] T010 Run TypeScript compilation check `npx tsc --noEmit` across backend and frontend
- [x] T011 Run quickstart validation scenarios from `sdd_artifacts/news-pagination-multicoin/quickstart.md`
- [x] T012 Update convergence and analysis logs

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Start immediately
- **Foundation (Phase 2)**: Depends on Setup
- **User Story 1 (Phase 3)**: Depends on Foundation completion
- **User Story 2 (Phase 4)**: Depends on User Story 1 completion
- **Polish (Phase 5)**: Depends on User Story 1 and 2 completion
- **Convergence (Phase 6)**: Depends on Polish phase / post-implementation audit

---

## Phase 6: Convergence

**Purpose**: Close gaps between specification, contracts, data model, and implementation
**Generated**: 2026-08-13 by /hoang-sdd-converge

### High Gaps
- [x] CV001 ⚠️ [partial] Add `@@index([relatedCoins])` to `NewsArticle` model in `workspace/apps/backend/prisma/schema.prisma` per `sdd_artifacts/news-pagination-multicoin/data-model.md` and execute `npx prisma db push`

### Medium Gaps
- [x] CV002 ⚠️ [partial] Clamp `limit` parameter to max 50 (`Math.min(Math.max(limit, 1), 50)`) in `workspace/apps/backend/src/news/news.controller.ts` per `sdd_artifacts/news-pagination-multicoin/contracts/news-api.md`
- [x] CV003 ❌ [contradicts] Remove redundant line 216 overwriting multi-coin filter in `workspace/apps/backend/src/news/services/news.service.ts`

### Low Gaps
- [x] CV004 ℹ️ [missing] Document `@@index([source])` in `sdd_artifacts/news-pagination-multicoin/data-model.md`

