# Contract: News & Sentiment API

> **Source of Truth**: `kb/contracts/news.yaml`

## REST Endpoints (NestJS Backend :3001)

### 1. `GET /api/news`
Fetch latest news articles with sentiment classifications.

**Query Parameters**:
- `limit` (number, optional, default: 10, max: 50): Number of articles to return.
- `coin` (string, optional, e.g. `'BTC'`): Filter articles related to specific coin.

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
  ]
}
```

---

### 2. `GET /api/sentiment/aggregate`
Fetch aggregate sentiment score and label for a coin over a timeframe.

**Query Parameters**:
- `coin` (string, required, e.g. `'BTC'`): Target coin ticker.
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

---

## Internal Micro-Service Endpoint (Python FastAPI :8000)

### `POST /analyze`
Internal HTTP REST call from NestJS `SentimentClient` to Python FastAPI. *Never exposed to frontend.*

**Request**:
```json
{
  "text": "Bitcoin price rallies following positive economic indicators and ETF approval."
}
```

**Response (200 OK)**:
```json
{
  "score": 0.76,
  "label": "POSITIVE"
}
```

**Degraded Response (Fallback on error/timeout)**:
```json
{
  "score": 0.0,
  "label": "NEUTRAL"
}
```
