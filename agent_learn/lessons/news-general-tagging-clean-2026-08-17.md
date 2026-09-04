# Lessons: news-general-tagging-clean — 2026-08-17

## What Worked
- **Dynamic TradingPair Extraction**: Querying active `TradingPair` base assets dynamically from PostgreSQL allows seamless coin tagging without code modifications when new pairs are added to Supabase.
- **Explicit `GENERAL` Tag Fallback**: Tagging non-trading and macro news with `['GENERAL']` avoids contaminating Bitcoin (`BTC`) news feeds and prevents false trading signals in `NewsSentimentStrategy`.
- **React 19 Pure Effects**: Decoupling news list fetching from aggregate mood score updates and removing synchronous `setState` in effects completely eliminated React 19 cascading re-render warnings in ESLint 9.

## What Didn't Work
- **Synchronous `setLoading(true)` in Effects**: Calling `setState` synchronously within an effect before an async tick triggers React 19's `react-hooks/set-state-in-effect` compiler rule. Solved by moving state transitions to user interaction handlers and using `ignore` guards.

## Deviations from Plan
- Preserved `default` coin fallback list in `NewsFeed.tsx` for resilient UI rendering when the backend server is temporarily booting up.

## KB Updates Needed
- [x] `kb/contracts/news.yaml` updated with `GENERAL` and `ALL` coin filter documentation.
- [x] `kb/modules/news-sentiment.md` updated with dynamic coin extraction and mock data removal.
- [x] `kb/flows/news-sentiment-pipeline.md` updated with dynamic tagging flow and BR-6.
