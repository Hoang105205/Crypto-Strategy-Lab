# Quickstart: strategy-rest-events

## Prerequisites
- Backend chạy ở port 3001 (`npm run dev:backend`)

## Validation Scenarios

### Scenario 1: Fetch versions by strategy name
1. Chạy Postman gọi `GET /api/strategies/MA/versions` (hoặc tên tuỳ ý).
2. ✅ Expected: Trả về HTTP 200 kèm array JSON.

### Scenario 2: Fetch strategy by id
1. Chạy Postman gọi `GET /api/strategies/12345` (ID có thể copy từ log hoặc sau khi gọi create composite).
2. ✅ Expected: Trả về HTTP 200 kèm object StrategyVersion (nếu đúng ID).

### Scenario 3: Fetch backtest result
1. Chạy Postman gọi `GET /api/strategies/backtest/999`.
2. ✅ Expected: Trả về HTTP 200 kèm dữ liệu BacktestResult giả lập (mocked).
