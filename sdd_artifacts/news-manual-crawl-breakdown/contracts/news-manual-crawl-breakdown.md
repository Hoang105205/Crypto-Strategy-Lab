# Contract: News On-Demand Crawl & Sentiment Breakdown API

## Endpoints

### 1. POST /api/news/crawl
Manually trigger on-demand news collection across registered providers.

- **Headers**: `Content-Type: application/json`
- **Request Body**: None
- **Responses**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "count": 5,
      "message": "News collection completed successfully."
    }
    ```
  - `429 Too Many Requests` (Cooldown Active):
    ```json
    {
      "statusCode": 429,
      "error": "Rate limit exceeded. Please wait before crawling again.",
      "retryAfterSeconds": 84
    }
    ```
  - `409 Conflict` (Crawl in progress):
    ```json
    {
      "statusCode": 409,
      "error": "Crawl in progress. Please wait for current execution to finish."
    }
    ```

---

### 2. GET /api/sentiment/aggregate
Get aggregate sentiment and distribution breakdown ratios for selected coin and timeframe.

- **Query Parameters**:
  - `coin` (string, optional, e.g. `BTC`)
  - `coins` (string, optional, e.g. `BTC,ETH`)
  - `timeframe` (string, default: `24h`, options: `1h`, `24h`, `7d`)
- **Responses**:
  - `200 OK`:
    ```json
    {
      "score": 0.45,
      "label": "POSITIVE",
      "articleCount": 20,
      "positiveCount": 12,
      "neutralCount": 6,
      "negativeCount": 2,
      "positiveRatio": 60.0,
      "neutralRatio": 30.0,
      "negativeRatio": 10.0,
      "updatedAt": "2026-08-25T11:55:00.000Z"
    }
    ```
