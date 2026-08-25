# Data Model: News On-Demand Crawl with Anti-Spam Cooldown & Sentiment Distribution Breakdown

## Entity Definitions & Extensions

### AggregateSentiment (Extended DTO)

```typescript
export interface AggregateSentiment {
  score: number; // Average compound score (-1.0 to 1.0)
  label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  articleCount: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  positiveRatio: number; // Percentage (0.0 - 100.0)
  neutralRatio: number;  // Percentage (0.0 - 100.0)
  negativeRatio: number; // Percentage (0.0 - 100.0)
  updatedAt: string;     // ISO8601
}
```

### ManualCrawlResult (Response DTO)

```typescript
export interface ManualCrawlResult {
  success: boolean;
  count: number;
  message: string;
}

export interface CrawlRateLimitError {
  statusCode: 429;
  error: string;
  retryAfterSeconds: number;
}
```

## Database Schema Impact
- **No changes required** to `prisma/schema.prisma`. Existing `NewsArticle` and `SentimentScore` tables hold all necessary raw records. Ratios are computed on-the-fly during aggregate queries.
