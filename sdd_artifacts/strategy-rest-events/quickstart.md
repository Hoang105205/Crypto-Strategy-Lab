# Quickstart: Strategy REST API & Event Bus

## 1. List Strategies
```http
GET /api/strategies HTTP/1.1
Host: localhost:3000
```

## 2. Create Composite Strategy
```http
POST /api/strategies/composite HTTP/1.1
Content-Type: application/json

{
  "name": "MA_RSI_Combo",
  "childStrategyNames": ["MovingAverage", "RelativeStrengthIndex"],
  "combinerType": "MajorityVote"
}
```

## 3. Request Backtest
```http
POST /api/strategies/backtest HTTP/1.1
Content-Type: application/json

{
  "strategyName": "MovingAverage",
  "pair": "BTCUSDT",
  "timeframe": "1h",
  "startDate": "2026-01-01T00:00:00Z",
  "endDate": "2026-06-01T00:00:00Z",
  "initialCapital": 10000
}
```
Response `202 Accepted`:
```json
{
  "jobId": "job_1770800000000_abc12",
  "strategyVersionId": "ver_1770800000000_xyz34",
  "status": "QUEUED"
}
```
