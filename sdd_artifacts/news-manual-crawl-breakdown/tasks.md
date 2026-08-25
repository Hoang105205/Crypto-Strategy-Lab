# Tasks: News On-Demand Crawl with Anti-Spam Cooldown & Sentiment Distribution Breakdown

**Input**: Design documents from `sdd_artifacts/news-manual-crawl-breakdown/`  
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths in descriptions

---

## Phase 1: Setup & Shared Contracts

**Purpose**: Shared types, interfaces, and scheduling constants

- [X] T001 [P] [US3] Update `libs/shared/src/constants/news.constants.ts` to set `NEWS_COLLECTION_CRON_SCHEDULE = '*/5 * * * *'` and add `MANUAL_CRAWL_COOLDOWN_MS = 120_000` per plan.md
- [X] T002 [P] [US2] Update `libs/shared/src/types/news.ts` to extend `AggregateSentiment` with `positiveRatio`, `neutralRatio`, `negativeRatio`, `positiveCount`, `neutralCount`, `negativeCount`, and add `ManualCrawlResult` per data-model.md

---

## Phase 2: Backend Implementation (User Stories 1, 2, 3)

**Purpose**: Backend REST endpoints, rate-limiting cooldown, mutex lock, and ratio calculations

- [X] T003 [US2] Update `apps/backend/src/news/services/news.service.ts` to compute positive/neutral/negative counts and ratios in `getAggregateSentiment()` per contracts/news-manual-crawl-breakdown.md
- [X] T004 [US1] Update `apps/backend/src/news/services/news.service.ts` to implement `isCrawling` Mutex lock and on-demand collection safety
- [X] T005 [US1] Update `apps/backend/src/news/news.controller.ts` to implement `POST /api/news/crawl` with 120s cooldown check, returning HTTP 429 with `retryAfterSeconds` or HTTP 409 on conflict per contracts/news-manual-crawl-breakdown.md
- [X] T006 [P] [US3] Verify and update `apps/backend/src/news/cron/news-collector.cron.ts` to ensure 5-minute scheduled execution

**Checkpoint**: Backend endpoints `POST /api/news/crawl` and `GET /api/sentiment/aggregate` are fully functional and verifiable via curl/REST.

---

## Phase 3: Frontend Implementation (User Stories 1 & 2)

**Purpose**: Frontend UI components in `NewsFeed.tsx`

- [X] T007 [P] [US2] Update `apps/frontend/src/components/news/NewsFeed.tsx` to render the 3-color sentiment distribution breakdown bar (`#0ecb81` green, `#fcd535` yellow, `#f6465d` red) and display exact ratio percentages in the Header Card
- [X] T008 [US1] Update `apps/frontend/src/components/news/NewsFeed.tsx` to add the `[ ⚡ Cào tin mới ]` button in the header bar with loading spinner, 120s OP.GG-style countdown timer, `localStorage` (`news_last_crawl_timestamp`) hydration across page reloads, and automatic feed refresh on success

**Checkpoint**: Frontend renders the breakdown bar and provides a reactive, spam-protected crawl button.

---

## Phase 4: Polish, Testing & Verification

**Purpose**: Unit test validation, build check, and Quickstart scenario verification

- [X] T009 [P] Add/update unit test in `apps/backend/src/news/news.controller.spec.ts` (or `news.service.spec.ts`) covering manual crawl 120s cooldown (429) and aggregate breakdown ratios
- [X] T010 Run build check and execute all 4 Quickstart validation scenarios from `sdd_artifacts/news-manual-crawl-breakdown/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)**: No dependencies — start immediately (T001, T002 in parallel).
- **Phase 2 (Backend)**: Depends on Phase 1 completion (T003, T004, T005, T006).
- **Phase 3 (Frontend)**: Depends on Phase 1 & Phase 2 contract completion (T007, T008).
- **Phase 4 (Polish & Testing)**: Depends on Phase 2 & Phase 3 completion (T009, T010).

### Parallel Opportunities
- T001 and T002 can run in parallel.
- T006 can run in parallel with T003/T004/T005.
- T007 and T008 can be developed together in `NewsFeed.tsx`.
- T009 can run in parallel with frontend polish.

---

## Implementation Strategy

### MVP Milestone (All 3 User Stories)
1. Complete Phase 1 (Shared Types & Constants)
2. Complete Phase 2 (Backend Controller & Service)
3. Complete Phase 3 (Frontend NewsFeed UI)
4. Execute Phase 4 (Build & Quickstart verification)
