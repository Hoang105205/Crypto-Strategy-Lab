# Tasks: Dynamic TradingPair Coin Tagging, General Fallback & React 19 NewsFeed Refactoring

**Input**: Design documents from `sdd_artifacts/news-general-tagging-clean/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (Dynamic Tagging & GENERAL), US2 (Dynamic Tabs), US3 (Remove Mock Data), US4 (React 19 Lint Cleanup)

---

## Phase 1: Setup & Contract Alignment

**Purpose**: Align Knowledge Base contracts and module documentation with new dynamic tagging architecture.

- [X] T001 Update `kb/contracts/news.yaml` to document `GENERAL` tag support and `GET /api/market-data/pairs` dynamic integration.
- [X] T002 [P] Update `kb/modules/news-sentiment.md` and `kb/flows/news-sentiment-pipeline.md` to reflect dynamic `TradingPair` coin extraction and elimination of BTC magic fallback.

---

## Phase 2: Backend Implementation (User Story 1 & 3 - P1)

**Purpose**: Implement dynamic coin extraction from PostgreSQL `TradingPair`, tag fallback to `GENERAL`, pure coin sentiment in trading strategy, and clean mock data.

- [ ] T003 [US1] [US3] Update `workspace/apps/backend/src/news/providers/rss.provider.ts`:
  - Accept dynamic `activeCoins` parameter in `fetchLatest()` and `extractCoins()`.
  - Tag unrecognized / macro articles with `['GENERAL']` instead of `['BTC']`.
  - Remove `mockArticles` array per ADR-0010 (return `[]` on feed failure).
- [ ] T004 [P] [US3] Update `workspace/apps/backend/src/news/providers/crawler.provider.ts`:
  - Remove `crawlerArticles` mock data (return `[]` on crawler failure).
- [ ] T005 [US1] Update `workspace/apps/backend/src/news/services/news.service.ts`:
  - Query active `TradingPair` base assets via `PrismaService.tradingPair.findMany({ where: { isActive: true } })`.
  - Pass active coin symbols to news providers.
  - Default null/empty `relatedCoins` to `['GENERAL']` in `collectAllNews()`.
- [ ] T006 [US1] Update `workspace/apps/backend/src/news/strategies/sentiment.strategy.ts`:
  - Ensure `NewsSentimentStrategy` computes trading signals using 100% of target coin sentiment.

---

## Phase 3: Frontend Implementation & React 19 Refactoring (User Stories 2, 3, 4 - P1/P2)

**Purpose**: Implement dynamic coin filter tabs from API, tab `GENERAL`, remove mock data, and fix 7 React 19 / ESLint 9 warnings/errors.

- [ ] T007 [US2] Update `workspace/apps/frontend/src/components/news/NewsFeed.tsx` to fetch active trading pairs from `GET /api/market-data/pairs` and render tabs `['ALL', ...activeCoins, 'GENERAL']`.
- [ ] T008 [US3] Remove `mockList` fallback array in `workspace/apps/frontend/src/components/news/NewsFeed.tsx`.
- [ ] T009 [US4] Refactor `workspace/apps/frontend/src/components/news/NewsFeed.tsx` for React 19 / ESLint 9 compliance:
  - Fix `pageSize` to constant `DEFAULT_PAGE_SIZE` (remove unused `setPageSize`).
  - Remove synchronous `setCurrentPage(1)` from `useEffect` and place in user interaction handlers (`handleTabClick`, `handleToggleMultiCoin`, etc.).
  - Wrap `fetchNewsData` and `fetchAggregateSentiment` in `useCallback` and position them above `useEffect`s.
  - Decouple news list fetch (`useEffect` on tab/page/multiCoins) from aggregate sentiment fetch (`useEffect` on timeframe/coins).
  - Remove unused `error` variables in `catch` blocks.

---

## Phase 4: Verification & Lessons Learned

**Purpose**: Verify TypeScript compilation, ESLint cleanliness, and document lessons learned.

- [ ] T010 [P] Verify backend TypeScript compilation with `npx tsc --noEmit -p tsconfig.json` in `workspace/apps/backend`.
- [ ] T011 [P] Verify frontend ESLint & TypeScript compilation with `npx eslint src/components/news/NewsFeed.tsx` and `npx tsc --noEmit` in `workspace/apps/frontend`.
- [ ] T012 Record lessons learned in `agent_learn/lessons/news-general-tagging-clean-2026-08-17.md` and update `agent_learn/INDEX.md`.

---

## Dependencies & Execution Order

1. **Phase 1 (Setup)**: T001, T002.
2. **Phase 2 (Backend)**: T003 → T004 → T005 → T006. *(Commit Step 1)*
3. **Phase 3 (Frontend)**: T007 → T008 → T009. *(Commit Step 2)*
4. **Phase 4 (Verification & Docs)**: T010 → T011 → T012. *(Commit Step 3)*
