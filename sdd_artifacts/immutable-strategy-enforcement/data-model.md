# Data Model: Immutable Strategy Enforcement

## Entity Relationship & Immutability Architecture

```mermaid
erDiagram
    StrategyVersion ||--o{ BacktestResult : "evaluated in"
    StrategyVersion ||--o{ StrategyVersion : "child versions (frozen UUID array)"

    StrategyVersion {
        UUID id PK "Immutable UUID"
        string strategyType "MA, RSI, COMPOSITE..."
        string name "Strategy Identifier"
        int version "Monotonic version number"
        jsonb parameters "Frozen parameter map"
        UUID parentVersionId FK "Optional parent lineage"
        datetime createdAt "Creation timestamp"
        boolean isComposite "Composite flag"
        UUID[] childVersionIds "Array of child StrategyVersion IDs"
        string combinerType "MAJORITY_VOTE or WEIGHTED_SCORE"
        jsonb combinerWeights "Weight allocation map"
        string userId "Owner or null if system-discovered"
    }

    BacktestResult {
        UUID id PK
        UUID strategyVersionId FK "Permanent reference"
        float totalReturn
        float winRate
        float maxDrawdown
        float sharpeRatio
        float profitFactor
        jsonb trades "Audit log of executed trades"
    }
```

## Immutability Invariant Guarantees
1. **Insert-Only Lifecycle**:
   - `StrategyVersion` records are only ever created via `INSERT INTO "StrategyVersion"`.
   - `UPDATE` queries on `StrategyVersion` are prohibited across the application codebase.
   - `DELETE` queries on `StrategyVersion` are prohibited; foreign key references from `BacktestResult` remain perpetually intact.

2. **Lineage Preservation**:
   - For composite strategies, `childVersionIds` contains frozen UUID references to the exact snapshot version of each child strategy.
   - Because child versions cannot be deleted, `StrategyExecutionPort.resolveVersion()` is guaranteed never to encounter a missing child version.

## Migration Notes
- **No Database Schema Migration Required**: The existing PostgreSQL schema already models `StrategyVersion` as independent snapshot records. No alter table or drop statements are needed.
