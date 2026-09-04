# Implementation Plan: Dynamic TradingPair Coin Tagging, General Fallback & NewsFeed React 19 Refactoring

**Feature**: `news-general-tagging-clean` | **Date**: 2026-08-17 | **Spec**: [`spec.md`](file:///d:/STD/Y3/Y3S3/KienTrucPM/pj/sdd_artifacts/news-general-tagging-clean/spec.md)

---

## Summary
Implement dynamic coin symbol extraction based on active `TradingPair` records in PostgreSQL, tag non-trading/unrecognized articles with `relatedCoins: ['GENERAL']` instead of hardcoding `BTC`, completely eliminate mock data in backend providers and frontend components, and refactor `NewsFeed.tsx` to conform to React 19 / ESLint 9 standards.

---

## Technical Context
- **Language/Version**: TypeScript 5.7+ (Node.js 20, Next.js 16.3 / React 19, NestJS 10)
- **Primary Dependencies**: NestJS, Prisma ORM, Axios, TailwindCSS, React 19 Hooks
- **Storage**: PostgreSQL via Prisma (`NewsArticle`, `TradingPair`)
- **Testing**: `npx tsc --noEmit`, `npx eslint`
- **Target Platform**: Node.js & Web Browser (Next.js client-side)
- **Project Type**: Full-stack Monorepo feature enhancement
- **Constraints**: ADR-0009, ADR-0010, Constitution Articles I, II, IV, VI.

---

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| **Art I: SSoT** | ✅ PASS | `kb/contracts/news.yaml` updated as SSoT for news endpoints & parameters. |
| **Art II: Contract-Driven** | ✅ PASS | `GET /api/news?coin=GENERAL` and `GET /api/market-data/pairs` adhere to OpenAPI specs. |
| **Art III: Extensibility** | ✅ PASS | New coins added to `TradingPair` in DB automatically work in news feeds and extraction. |
| **Art IV: Simplicity Over Cleverness** | ✅ PASS | Clean regex/token matching without introducing heavy NLP dependencies. |
| **Art VI: Explicit Over Implicit** | ✅ PASS | Explicit `GENERAL` tag replaces implicit BTC fallback magic. |

---

## Architecture Decision & Technical Approach

### 1. Dynamic Coin Extraction (Backend)
- `NewsService` fetches active `TradingPair` symbols (`baseAsset`) from `PrismaService`.
- `extractCoins(text, activeCoins)` in `RSSProvider` scans for words matching active `baseAsset`s.
- If no active coin matches, it outputs `['GENERAL']`.
- `NewsService.collectAllNews()` defaults null `relatedCoins` to `['GENERAL']`.

### 2. Elimination of Mock Data Fallbacks (Backend & Frontend)
- Remove `mockArticles` in `rss.provider.ts` and `crawlerArticles` in `crawler.provider.ts`. If feeds fail, return empty array `[]` cleanly per ADR-0010.
- Remove `mockList` fallback in `NewsFeed.tsx`. If backend API is unreachable, show clear error state.

### 3. Dynamic Filter Tabs & React 19 Refactoring (Frontend)
- `NewsFeed.tsx` queries `GET /api/market-data/pairs` on mount to build the dynamic tab list: `['ALL', ...activeCoins, 'GENERAL']`.
- Caches / memoizes `activeCoins`.
- Removes synchronous `setState` in effects (converts `setCurrentPage(1)` into filter event handlers).
- Wraps `fetchNewsData` and `fetchAggregateSentiment` in `useCallback` and places them above `useEffect`s.
- Decouples articles fetch from sentiment fetch.
- Fixes unused error variables.

---

## Source Code Structure
```
workspace/
├── apps/
│   ├── backend/
│   │   └── src/news/
│   │       ├── providers/
│   │       │   ├── rss.provider.ts           # Dynamic extractCoins + Remove mockArticles
│   │       │   └── crawler.provider.ts       # Remove mock crawlerArticles
│   │       ├── services/
│   │       │   └── news.service.ts           # Inject active coins, default to ['GENERAL']
│   │       └── strategies/
│   │           └── sentiment.strategy.ts     # 100% target coin sentiment weighting
│   └── frontend/
│       └── src/components/news/
│           └── NewsFeed.tsx                  # Dynamic tabs, GENERAL filter, React 19 ESLint fix
```
