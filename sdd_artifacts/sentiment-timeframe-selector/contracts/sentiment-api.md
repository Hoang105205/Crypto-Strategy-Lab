# Contract: News & Sentiment API — Timeframe Selector

> **Source of Truth**: `kb/contracts/news.yaml`

## REST Endpoints (NestJS Backend :3001)

### `GET /api/sentiment/aggregate`
Fetch aggregate sentiment score and label for a coin or multiple coins over a specified timeframe.

**Query Parameters**:
- `coin` (string, optional, e.g. `'BTC'`): Single target coin ticker.
- `coins` (string, optional, e.g. `'BTC,ETH'`): Comma-separated multi-coin tickers.
- `timeframe` (string, optional, default: `'24h'`, enum: `['1h', '24h', '7d']`): Time window for aggregating sentiment scores.

**Response (200 OK)**:
```json
{
  "score": 0.65,
  "label": "POSITIVE",
  "articleCount": 12,
  "updatedAt": "2026-08-13T10:00:00.000Z"
}
```

**Response when no articles in timeframe (200 OK)**:
```json
{
  "score": 0.0,
  "label": "NEUTRAL",
  "articleCount": 0,
  "updatedAt": "2026-08-13T10:00:00.000Z"
}
```
