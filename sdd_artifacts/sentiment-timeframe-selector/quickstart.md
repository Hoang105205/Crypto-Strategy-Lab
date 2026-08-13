# Quickstart: Aggregate Mood Score Timeframe Selector

## Prerequisites
- NestJS Backend running on port 3001 (`http://localhost:3001`)
- Next.js Frontend running on port 3000 (`http://localhost:3000`)

## Validation Scenarios

### Scenario 1: Fetch Aggregate Sentiment for 1h Timeframe
```bash
curl -X GET "http://localhost:3001/api/sentiment/aggregate?coin=BTC&timeframe=1h"
```
✅ **Expected**: Trả về object `{ score, label, articleCount, updatedAt }` của BTC tính riêng trong 1 giờ qua.

### Scenario 2: Fetch Aggregate Sentiment for 24h Timeframe (Default)
```bash
curl -X GET "http://localhost:3001/api/sentiment/aggregate?coin=BTC&timeframe=24h"
```
✅ **Expected**: Trả về điểm tâm lý gộp của BTC trong 24 giờ qua.

### Scenario 3: Fetch Aggregate Sentiment for 7d Timeframe (Multi-Coin)
```bash
curl -X GET "http://localhost:3001/api/sentiment/aggregate?coins=BTC,ETH&timeframe=7d"
```
✅ **Expected**: Trả về điểm tâm lý gộp của mảng coins `BTC,ETH` trong 7 ngày qua.
