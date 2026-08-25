# Lessons: News On-Demand Crawl & Sentiment Distribution Breakdown — 2026-08-25

## What Worked
- **Two-Layer Cooldown Protection**: Combining client-side UI ticking countdown (hydrated from `localStorage`) with backend in-memory timestamp rate limiting (HTTP 429) gives instant UX feedback while guaranteeing external provider protection.
- **Mutex Lock Ingestion Safety**: An in-memory boolean flag `isCrawling` wrapped in a `try ... finally` block completely eliminates race condition risks between scheduled cron execution and manual UI clicks without needing distributed Redis locks.
- **Normalized Breakdown Proportions**: Computing `positiveRatio`, `neutralRatio`, and `negativeRatio` to 1 decimal place with residual alignment (`100 - positive - neutral`) guarantees the visual bar always totals exactly 100.0%.

## What Didn't Work / Edge Cases Encountered
- **SSR LocalStorage Access**: Direct calls to `localStorage` during initial Next.js SSR can throw errors if not guarded by `useEffect` and `try/catch`. Wrapping hydration inside `useEffect` ensures smooth hydration across page refreshes.

## Deviations from Plan
- None. Implementation matched `plan.md`, `spec.md`, and `contracts/news-manual-crawl-breakdown.md` with 100% fidelity.

## KB Updates Completed
- [x] Updated `kb/contracts/news.yaml`: Added `POST /api/news/crawl` and extended `GET /api/sentiment/aggregate`.
- [x] Updated `kb/modules/news-sentiment.md`: Documented on-demand crawler, 5-minute cron schedule, 120s cooldown, and 3-color breakdown bar.
- [x] Updated `kb/flows/news-sentiment-pipeline.md`: Added on-demand execution flow and cooldown exception scenarios.
- [x] Updated `kb/INDEX.md`: Reflected latest module capabilities and date.
