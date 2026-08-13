# Quickstart: News Feed Offset Pagination & Multi-Coin Filter

## Prerequisites
- PostgreSQL running with Prisma schema migrated
- NestJS Backend running on port 3001 (`http://localhost:3001`)
- Python FastAPI Sentiment Service running on port 8000 (`http://localhost:8000`)
- Next.js Frontend running on port 3000 (`http://localhost:3000`)

## Validation Scenarios

### Scenario 1: Fetch Page 1 (Offset 0)
```bash
curl -X GET "http://localhost:3001/api/news?limit=10&offset=0&coin=BTC"
```
✅ **Expected**: Trả về 10 bài báo liên quan BTC + `pagination: { total: X, limit: 10, offset: 0, hasMore: true }`.

### Scenario 2: Fetch Page 2 (Offset 10) for Numbered Pagination (< 2 >)
```bash
curl -X GET "http://localhost:3001/api/news?limit=10&offset=10&coin=BTC"
```
✅ **Expected**: Trả về 10 bài báo tiếp theo của BTC không bị trùng lặp với trang 1.

### Scenario 3: Multi-Coin Filter (BTC, ETH, SOL)
```bash
curl -X GET "http://localhost:3001/api/news?limit=10&offset=0&coins=BTC,ETH,SOL"
```
✅ **Expected**: Trả về bài báo có `relatedCoins` chứa BTC, ETH hoặc SOL.
