# Contract: News & Sentiment API

> **Source of Truth**: `kb/contracts/news.yaml`

## REST Endpoints (NestJS Backend :3001)

### 1. `GET /api/news`
Fetch paginated news articles filtered by coin or multiple coins.

**Query Parameters**:
- `limit` (number, optional, default: 10, max: 50): Number of articles to return per page.
- `offset` (number, optional, default: 0): Offset for pagination / Load More.
- `coin` (string, optional, e.g. `'BTC'`): Single coin filter.
- `coins` (string, optional, e.g. `'BTC,ETH'`): Comma-separated multi-coin filter.

**Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "a3b8c9d0-1234-5678-9abc-def012345678",
      "source": "CoinDesk RSS",
      "title": "Bitcoin Surges Above $90,000 Following Institutional Inflows",
      "content": "Institutional adoption accelerates as ETF inflows reach record highs...",
      "url": "https://coindesk.com/markets/2026/08/10/btc-surges",
      "publishedAt": "2026-08-10T08:00:00.000Z",
      "crawledAt": "2026-08-10T08:05:00.000Z",
      "relatedCoins": ["BTC"],
      "sentimentScore": 0.82,
      "sentimentLabel": "POSITIVE",
      "createdAt": "2026-08-10T08:05:01.000Z"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### 2. `GET /api/sentiment/aggregate`
Fetch aggregate sentiment score and label for a coin or multiple coins over a timeframe.

**Query Parameters**:
- `coin` (string, optional, e.g. `'BTC'`): Single target coin ticker.
- `coins` (string, optional, e.g. `'BTC,ETH'`): Comma-separated multi-coin tickers.
- `timeframe` (string, optional, default: `'1h'`, enum: `['1h', '24h', '7d']`): Time window.

**Response (200 OK)**:
```json
{
  "score": 0.65,
  "label": "POSITIVE",
  "articleCount": 12,
  "updatedAt": "2026-08-10T10:00:00.000Z"
}
```
