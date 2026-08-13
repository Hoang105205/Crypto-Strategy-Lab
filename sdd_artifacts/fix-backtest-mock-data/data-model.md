# Data Model: fix-backtest-mock-data

## Entity Relationship Diagram
(No new schema, reusing existing Prisma model)

## Entities

### BacktestResult
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | PK (UUID) | |
| strategyVersionId | String | FK | |
| pair | String | | |
| timeframe | String | | |
| startDate | DateTime | | |
| endDate | DateTime | | |
| totalReturn | Float | | |
| winRate | Float | | |
| maxDrawdown | Float | | |
| sharpeRatio | Float | | |
| profitFactor | Float | | |
| totalTrades | Int | | |
| trades | Json | | Array of trades |
| executedAt | DateTime | | |
| executionTimeMs | Int | | |

## Indexes
- `@@index([strategyVersionId])`
- `@@index([pair, timeframe])`

## Migration Notes
- No DB migrations required. The schema is already defined in `schema.prisma`.
