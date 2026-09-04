# Contract: Strategy REST API (GET Endpoints)

## Endpoints

### GET /api/strategies/:id
**Request**: `id` (path param - UUID)
**Response**: `StrategyVersion` object
**Errors**: 
- `404 NOT FOUND` nếu không tồn tại version.

### GET /api/strategies/:name/versions
**Request**: `name` (path param - string)
**Response**: `StrategyVersion[]` array
**Errors**: 
- (Không có lỗi, trả về mảng rỗng nếu không tìm thấy)

### GET /api/strategies/backtest/:id
**Request**: `id` (path param - UUID)
**Response**: `BacktestResult` object (Mocked cho MVP)
**Errors**:
- `404 NOT FOUND` nếu không tồn tại result.
