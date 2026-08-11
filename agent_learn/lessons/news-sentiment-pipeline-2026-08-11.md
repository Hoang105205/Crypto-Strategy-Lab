# Lessons: Crypto News & Sentiment Analysis Pipeline — 2026-08-11

## What Worked
- **Process Isolation (ADR-0009)**: Running Python FastAPI as a standalone process on port 8000 allows VADER ML sentiment analysis to execute efficiently without blocking the single-threaded Node.js event loop in NestJS.
- **Provider Adapter Pattern (ADR-0010)**: Decoupling `INewsProvider` interface allowed adding `RSSProvider` and `WebCrawlerProvider` seamlessly, with fault isolation returning empty arrays on scraper failures instead of throwing.
- **Graceful Degradation**: 500ms timeout SLA in `SentimentClient` fallback to neutral `{ score: 0.0, label: "NEUTRAL" }` ensures NestJS endpoints and `NewsSentimentStrategy` continue operating safely when Python ML service is down or lagging.
- **Centralized Constants**: Extracting all magic numbers into `workspace/libs/shared/src/constants/news.constants.ts` guaranteed 100% compliance with Constitution Art VI (Explicit Over Implicit).

## What Didn't Work
- `CronExpression.EVERY_15_MINUTES` is not a member of NestJS `@nestjs/schedule` `CronExpression` enum; replaced with standard cron string `'*/15 * * * *'`.
- Using Python `.strip()` in TypeScript strings caused a compilation error; fixed to `.trim()`.

## Deviations from Plan
- Made `sentimentScore` and `sentimentLabel` optional in `NewsArticle` model (`Float?`, `String?`) to allow storing raw articles immediately upon ingestion before ML sentiment scoring completes asynchronously.

## KB Updates Needed
- [x] All KB files (`kb/modules/news-sentiment.md`, `kb/contracts/news.yaml`, `kb/flows/news-sentiment-pipeline.md`, ADR-0009, ADR-0010) are 100% synchronized.
