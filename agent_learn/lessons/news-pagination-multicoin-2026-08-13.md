# Lessons: news-pagination-multicoin — 2026-08-13

## What Worked
- **Offset Pagination & Multi-Coin Filter**: Implementing `skip`/`take` alongside Prisma's `hasSome` array query provides clean offset pagination and multi-coin selection.
- **Contract Enforcement**: Enforcing strict `limit` bounds (`1 <= limit <= 50`) prevents runaway query memory consumption.
- **Prisma Array Indexing**: Adding `@@index([relatedCoins])` optimizes PostgreSQL query performance for coin filtering.

## What Didn't Work
- **Unclamped Query Limits**: Leaving `limit` unclamped allowed clients to potentially bypass API contract limits.
- **Redundant Filter Code**: Duplicate `if (coin)` check in fallback query overrode multi-coin `hasSome` logic.

## Deviations from Plan
- Bounded `limit` parameter in `NewsController` to max 50 per contract SSoT (`kb/contracts/news.yaml`).
- Fixed fallback filtering logic in `NewsService.getAggregateSentiment`.

## KB Updates Needed
- [x] All KB files (`kb/contracts/news.yaml`, `kb/modules/news-sentiment.md`, `kb/flows/news-sentiment-pipeline.md`) are up-to-date.
