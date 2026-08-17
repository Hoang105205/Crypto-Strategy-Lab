# Quickstart: news-general-tagging-clean

## Prerequisites
- PostgreSQL running with active `TradingPair` and `NewsArticle` tables.
- Backend running on `http://localhost:3001`.
- Frontend running on `http://localhost:3000`.

## Validation Scenarios

### Scenario 1: Verify Dynamic Tagging & GENERAL Filter
1. Collect news articles via cron or `collectAllNews()`.
2. Query `GET /api/news?coin=GENERAL`.
3. ✅ Expected: Only articles with `relatedCoins: ['GENERAL']` are returned.
4. Query `GET /api/news?coin=BTC`.
5. ✅ Expected: Only articles specifically mentioning Bitcoin (`BTC`) are returned.

### Scenario 2: Verify ESLint & React 19 Cleanliness
1. Run `npx eslint src/components/news/NewsFeed.tsx` in `workspace/apps/frontend`.
2. ✅ Expected: Exit code 0 with 0 errors and 0 warnings.
