# Data Model: `adaptive-news-crawler`

## 1. Entities & Schema

### Entity: `CrawlerRule` (PostgreSQL / Prisma)

```prisma
model CrawlerRule {
  id                 String   @id @default(uuid())
  domain             String   @unique
  targetUrl          String
  containerSelector  String
  titleSelector      String
  contentSelector    String
  linkSelector       String
  dateSelector       String
  isActive           Boolean  @default(true)
  lastDiscoveredAt   DateTime @default(now())
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@map("crawler_rules")
}
```

### Entity: `RawArticle` (TypeScript Shared DTO)

```typescript
export interface RawArticle {
  title: string;
  content: string;
  source: string;
  publishedAt: string; // ISO8601
  crawledAt: string;   // ISO8601
  relatedCoins: string[]; // e.g. ['BTC'], ['ETH'], ['GENERAL']
  url: string;
}
```

---

## 2. Seed Configuration for `decrypt.co`

```json
{
  "domain": "decrypt.co",
  "targetUrl": "https://decrypt.co/news",
  "containerSelector": "article, div.post-card, div.grid > div",
  "titleSelector": "h2, h3, a.link-title, span.font-bold",
  "contentSelector": "p, div.description, div.text-sm",
  "linkSelector": "a[href]",
  "dateSelector": "time, span.text-xs",
  "isActive": true
}
```
