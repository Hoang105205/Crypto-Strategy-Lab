# Data Model: Crypto News & Sentiment Analysis Pipeline

## Entity Relationship Diagram

```
┌────────────────────────────────────────┐       1 : 1       ┌────────────────────────────────────────┐
│               NewsArticle              │ ────────────────> │             SentimentScore             │
├────────────────────────────────────────┤                   ├────────────────────────────────────────┤
│ id: String (UUID, PK)                  │                   │ id: String (UUID, PK)                  │
│ source: String                         │                   │ articleId: String (FK -> NewsArticle)  │
│ title: String                          │                   │ score: Float (-1.0 to 1.0)             │
│ content: String                        │                   │ label: String (POSITIVE/NEGATIVE/NEUT) │
│ url: String (Unique Hash)              │                   │ model: String ('VADER')                │
│ publishedAt: DateTime                  │                   │ scoredAt: DateTime                     │
│ crawledAt: DateTime                    │                   └────────────────────────────────────────┘
│ relatedCoins: String[] (e.g. ['BTC'])  │
│ sentimentScore: Float?                 │
│ sentimentLabel: String?                │
│ createdAt: DateTime                    │
└────────────────────────────────────────┘
```

## Entities

### `NewsArticle`
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | PK, UUID, default uuid() | Primary key |
| `source` | String | Required | e.g. `'CoinDesk RSS'`, `'WebCrawler'` |
| `title` | String | Required | News article headline |
| `content` | String | Required | Full text or summary content |
| `url` | String | Unique | Unique article URL hash for deduplication |
| `publishedAt` | DateTime | Required | Original article publication timestamp |
| `crawledAt` | DateTime | Required, default now() | Ingestion timestamp (Section 27) |
| `relatedCoins` | String[] | Required | Related coin tickers e.g. `['BTC', 'ETH']` |
| `sentimentScore` | Float | Optional | Calculated compound score (-1.0 to 1.0) |
| `sentimentLabel` | String | Optional | `'POSITIVE'`, `'NEGATIVE'`, `'NEUTRAL'` |
| `createdAt` | DateTime | Required, default now() | Database record creation timestamp |

### `SentimentScore`
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | PK, UUID, default uuid() | Primary key |
| `articleId` | String | FK -> `NewsArticle.id`, Unique | 1-to-1 relationship |
| `score` | Float | Required (-1.0 to 1.0) | Compound VADER score |
| `label` | String | Required | `'POSITIVE'`, `'NEGATIVE'`, `'NEUTRAL'` |
| `model` | String | Required, default `'VADER'` | ML model identifier |
| `scoredAt` | DateTime | Required, default now() | Inference timestamp |

## Indexes

- `idx_news_url` ON `NewsArticle(url)` (UNIQUE)
- `idx_news_publishedAt` ON `NewsArticle(publishedAt DESC)`
- `idx_news_relatedCoins` ON `NewsArticle(relatedCoins)`

## Migration Notes

- Database schema is managed via Prisma ORM (`workspace/apps/backend/prisma/schema.prisma`).
- Existing migration `init` already creates baseline tables; update model definitions if additional fields are required.
