# Data Model: backtest-result-visualization

## Entity Relationship Diagram
No structural database changes required. The schema already contains the `userId` field (nullable) and `trades` JSONB column.

## Entities

### StrategyVersion / BacktestResult
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| userId | String | Nullable | References Supabase `auth.users.id`. Null = system. |
| trades | JSONB | - | Stores Trade objects with new SL/TP/Cost fields. |

## Indexes
- No new indexes required (already defined in Prisma).

## Migration Notes
- We do not need a Prisma migration. We are just hydrating the JSONB payload and applying Prisma `where` clause filters on existing columns.
