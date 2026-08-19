# Contract: Strategy API (Updated)

## Endpoints

### POST /api/strategies/composite
**Request**: `{ name: string, childStrategyNames: string[], combinerType: string, combinerWeights?: Record<string, number> }`
**Response**: `StrategyVersion` object with assigned UUID.
**Errors**: 400 Bad Request if validation fails.

### GET /api/strategies
**Response**: `StrategyItem[]`
**Errors**: 500 Internal Server Error

### GET /api/strategies/:id
**Response**: `StrategyItem`
**Errors**: 404 Not Found

### DELETE /api/strategies/:id
*(No changes - used to delete a strategy entirely if not linked to backtests)*

### ~~PUT/PATCH /api/strategies/:id~~
**[REMOVED]** Endpoint strictly forbidden to enforce immutability.
