# API Contract: News & Market Data API (Updated)

## 1. GET /api/news
Retrieve paginated crypto news articles filtered by coin or multi-coins.

### Query Parameters
- `limit` (optional, integer): Items per page (default: 10, max: 50)
- `offset` (optional, integer): Pagination offset (default: 0)
- `coin` (optional, string): Filter by single coin symbol (e.g. `BTC`, `ETH`, `GENERAL`, `ALL`)
- `coins` (optional, string): Comma-separated multi-coin filter (e.g. `BTC,ETH,GENERAL`)

### Response 200 OK
```json
{
  "data": [
    {
      "id": "uuid-1234",
      "source": "CoinDesk RSS",
      "title": "Fed Holds Rates Steady Amid Digital Asset Inflows",
      "content": "Central bank policy projections...",
      "url": "https://coindesk.com/fed-policy",
      "publishedAt": "2026-08-17T08:00:00.000Z",
      "crawledAt": "2026-08-17T08:15:00.000Z",
      "relatedCoins": ["GENERAL"],
      "sentimentScore": 0.12,
      "sentimentLabel": "NEUTRAL"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 10,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## 2. GET /api/market-data/pairs
Retrieve active trading pairs for dynamic frontend rendering.

### Response 200 OK
```json
[
  {
    "id": 1,
    "symbol": "BTCUSDT",
    "baseAsset": "BTC",
    "quoteAsset": "USDT",
    "isActive": true
  },
  {
    "id": 2,
    "symbol": "ETHUSDT",
    "baseAsset": "ETH",
    "quoteAsset": "USDT",
    "isActive": true
  }
]
```
