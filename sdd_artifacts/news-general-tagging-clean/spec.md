# Feature Specification: Dynamic TradingPair Coin Tagging, General Market Fallback, Mock Data Cleanup & React 19 NewsFeed Refactoring

**Feature**: `news-general-tagging-clean`
**Created**: 2026-08-17
**Status**: Ready for Planning
**Input**: User description: "Dynamic TradingPair coin extraction from DB, fallback to ['GENERAL'] tag for non-trading coins, clean all news mock data, and refactor React 19 NewsFeed ESLint debt"

---

## User Scenarios & Testing

### User Story 1 - Dynamic Coin Tagging from Active Trading Pairs (Priority: P1)
As a trader monitoring crypto market news, I want news articles to be automatically tagged only with coins that currently exist as active Trading Pairs in the database, and any general/macro/unrecognized news to be tagged with `GENERAL` (instead of being incorrectly forced into `BTC`), so that I only see genuinely relevant news when filtering by a specific coin.

**Why this priority**: Eliminates data contamination in the news sentiment pipeline and prevents false trading signals in `NewsSentimentStrategy`.
**Independent Test**: Ingest an article mentioning "Solana" and an article mentioning "Federal Reserve inflation rate". Verify the first has `relatedCoins: ['SOL']` and the second has `relatedCoins: ['GENERAL']`. Verify neither article contaminates `coin=BTC` queries.

**Acceptance Scenarios**:
1. **Given** an incoming article mentioning "Ethereum L2 scaling", **When** parsed by the provider adapter, **Then** it is tagged with `relatedCoins: ['ETH']`.
2. **Given** an incoming article mentioning general macro economics or an unsupported coin (e.g. "SEC Crypto Regulations 2026"), **When** parsed, **Then** it is tagged with `relatedCoins: ['GENERAL']`.
3. **Given** a user filtering by `coin=BTC`, **When** news is retrieved, **Then** only articles specifically tagged with `BTC` are returned.

---

### User Story 2 - Dynamic Filter Tabs & GENERAL View on Frontend (Priority: P1)
As a user browsing the News Feed, I want the coin filter tabs to dynamically reflect all active trading pairs in the system (plus `All Markets` and `GENERAL`), so that I can easily browse general market news or specific trading assets without hardcoded UI limits.

**Why this priority**: Ensures the frontend UI dynamically adapts whenever new trading pairs are inserted into the database.
**Independent Test**: Open the News Feed page and verify tabs show `All Markets`, active coins (`BTC`, `ETH`, `SOL`, ...), and `GENERAL`. Click `GENERAL` and verify only general/macro market news appears.

**Acceptance Scenarios**:
1. **Given** active trading pairs in PostgreSQL, **When** the NewsFeed loads, **Then** it renders filter tabs matching the available active base assets plus `GENERAL`.
2. **Given** the user selects the `GENERAL` tab, **When** news is fetched, **Then** only articles with `relatedCoins` containing `GENERAL` are displayed.
3. **Given** the user selects `All Markets`, **When** news is fetched, **Then** all articles across all coins and general news are displayed.

---

### User Story 3 - Elimination of Mock Data Fallbacks (Priority: P2)
As a developer maintaining the system, I want all mock news arrays in backend provider adapters and the frontend news component removed, so that the system adheres strictly to ADR-0010 (Fault Isolation) and does not display fabricated fallback data.

**Why this priority**: Prevents stale, hardcoded mock data from masking real network or database failures.
**Independent Test**: Disconnect network feeds and verify provider returns `[]` without throwing exceptions or generating mock news articles.

**Acceptance Scenarios**:
1. **Given** RSS feeds or Web Crawler feeds fail or return empty, **When** `fetchLatest()` is called, **Then** it returns an empty array `[]` cleanly.
2. **Given** the backend API is unreachable, **When** the frontend fetches news, **Then** it displays an empty/error notice rather than fake mock articles.

---

### User Story 4 - React 19 & ESLint 9 NewsFeed Optimization (Priority: P2)
As a frontend developer, I want `NewsFeed.tsx` to follow React 19 and ESLint 9 best practices without synchronous `setState` in effects, missing dependencies, or duplicate API invocations, so that the UI renders smoothly with 0 lint warnings/errors.

**Why this priority**: Eliminates cascading re-renders, race conditions, and duplicate aggregate sentiment API calls.
**Independent Test**: Run `npx eslint src/components/news/NewsFeed.tsx` and verify 0 errors and 0 warnings.

**Acceptance Scenarios**:
1. **Given** filter tab changes, **When** user clicks a new coin tab, **Then** `currentPage` resets to 1 via the click handler rather than a synchronous `setState` inside `useEffect`.
2. **Given** timeframe pill button clicks (`1h`, `24h`, `7d`), **When** clicked, **Then** only the Aggregate Sentiment API is queried without triggering a duplicate full news feed reload.

---

## Requirements

### Functional Requirements
- **FR-001**: The system MUST extract coin symbols dynamically from the active `TradingPair` list in PostgreSQL rather than using a hardcoded list.
- **FR-002**: If an article does not match any active trading pair symbol, the system MUST tag it with `relatedCoins: ['GENERAL']`.
- **FR-003**: The frontend MUST dynamically fetch active trading pairs from `GET /api/market-data/pairs` and render corresponding filter buttons plus `GENERAL`.
- **FR-004**: All mock fallback article data in `rss.provider.ts`, `crawler.provider.ts`, and `NewsFeed.tsx` MUST be removed.
- **FR-005**: `NewsSentimentStrategy` MUST compute trading sentiment using 100% of the target coin's sentiment score without mixing other assets.
- **FR-006**: `NewsFeed.tsx` MUST pass ESLint 9 / React 19 checks with 0 errors and 0 warnings.

---

## Success Criteria
- **SC-001**: 100% of untagged or non-trading pair articles receive the `['GENERAL']` tag instead of `['BTC']`.
- **SC-002**: Zero mock data remains in news backend providers and frontend components.
- **SC-003**: `npx eslint src/components/news/NewsFeed.tsx` passes with 0 errors, 0 warnings.
- **SC-004**: Adding a new trading pair row in Supabase/PostgreSQL instantly enables coin filtering and news tagging for that coin without modifying codebase.

---

## KB Cross-References
- **Modules affected**: News & Sentiment Module (`kb/modules/news-sentiment.md`), Market Data Module (`kb/modules/market-data.md`), Frontend (`kb/DESIGN.md`), Strategy Engine (`kb/contracts/strategy.yaml`).
- **E2E flows affected**: `kb/flows/news-sentiment-pipeline.md`.
- **Architecture constraints**: ADR-0009 (Sentiment Service as Separate Process), ADR-0010 (News Provider Adapter Pattern).
- **Constitution gates**: Article I (Single Source of Truth), Article II (Contract-Driven), Article VI (Explicit Over Implicit).
