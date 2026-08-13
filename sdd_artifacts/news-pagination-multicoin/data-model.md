# Data Model: News Feed Offset Pagination & Multi-Coin Filter

## Entity Relationship Diagram

```text
┌────────────────────────────────────────────────────────┐
│                      NewsArticle                       │
├────────────────────────────────────────────────────────┤
│ id: String (UUID, PK)                                  │
│ source: String                                         │
│ title: String                                          │
│ content: String                                        │
│ url: String (Unique)                                   │
│ publishedAt: DateTime                                  │
│ crawledAt: DateTime                                    │
│ relatedCoins: String[]  <--- Index (has / hasSome)     │
│ sentimentScore: Float?                                 │
│ sentimentLabel: String?                                │
│ createdAt: DateTime                                    │
└───────────────────────────┬────────────────────────────┘
                            │ 1-to-1
                            ▼
┌────────────────────────────────────────────────────────┐
│                     SentimentScore                     │
├────────────────────────────────────────────────────────┤
│ id: String (UUID, PK)                                  │
│ articleId: String (FK -> NewsArticle.id)               │
│ score: Float                                           │
│ label: String                                          │
│ model: String                                          │
│ scoredAt: DateTime                                     │
└────────────────────────────────────────────────────────┘
```

## Data Transfer Objects (DTOs) & Interfaces

### PaginationMeta DTO
| Field | Type | Constraints | Description |
|---|---|---|---|
| `total` | number | >= 0 | Tổng số bài báo phù hợp với bộ lọc |
| `limit` | number | > 0 | Số lượng bài requested per page |
| `offset` | number | >= 0 | Vị trí offset hiện tại |
| `hasMore` | boolean | true/false | `offset + articles.length < total` |

## Indexes
- `CREATE INDEX idx_news_article_published_at ON "NewsArticle"("publishedAt" DESC);`
- `CREATE INDEX idx_news_article_source ON "NewsArticle"("source");`
- `CREATE INDEX idx_news_article_related_coins ON "NewsArticle" USING GIN ("relatedCoins");`
