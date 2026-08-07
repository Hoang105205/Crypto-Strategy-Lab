# ADR-0008: Strategy Versioning for Reproducibility

## Status
Accepted

## Context
During the strategy search loop, the system generates and backtests hundreds or thousands of strategy candidates. Users and the loop controller need to:
1. **Reproduce** an experiment — re-run backtest #122 with the exact same strategy + parameters → get the same result.
2. **Track lineage** — know which strategy version produced a given leaderboard entry.
3. **Compare versions** — see how parameter tweaks affected performance over time.

Without versioning, a strategy's parameters could be changed after a backtest, breaking reproducibility. The architecture document (CONSTITUTION.md §III) requires extension points to be **demonstrable**, and reproducibility is extensibility scenario #8.

## Decision Drivers
- **Reproducibility**: Experiment → Strategy version + params is an immutable snapshot.
- **Auditability**: Every leaderboard entry links to a specific strategy version.
- **Simplicity**: YAGNI — we need version tracking, not a full VCS for strategies.
- **Data model fit**: PostgreSQL + Prisma with JSONB for flexible strategy params.

## Considered Options
1. **No versioning** — Overwrite strategy params in place. Backtest results lose context. Fails reproducibility requirement.
2. **Git-based versioning** — Store strategies in Git, tag each version. Overkill for course project, adds Git dependency.
3. **Database versioning with immutable snapshots** — Each `(strategy_type, params, version)` tuple is immutable. New params = new version. BacktestResult links to a strategy version ID.

## Decision Outcome
Chosen option: **Database versioning with immutable snapshots**, because it is simple, fits Prisma/PostgreSQL, and directly satisfies the reproducibility extensibility scenario.

### Data Model

```
┌──────────────────────────────────┐
│        StrategyVersion           │
├──────────────────────────────────┤
│ id: UUID (PK)                    │
│ strategyType: string             │
│ name: string                     │
│ version: number                  │
│ parameters: JSONB                │
│ parentVersionId: UUID? (FK)      │
│ createdAt: DateTime              │
│ isComposite: boolean             │
│ childVersionIds: UUID[]?         │
│ combinerType: string?            │
│ combinerWeights: JSONB?          │
└──────────┬───────────────────────┘
           │ 1:N
           ▼
┌──────────────────────────────────┐
│        BacktestResult            │
├──────────────────────────────────┤
│ id: UUID (PK)                    │
│ strategyVersionId: UUID (FK)     │
│ pair: string                     │
│ timeframe: string                │
│ startDate: DateTime              │
│ endDate: DateTime                │
│ totalReturn: float               │
│ winRate: float                   │
│ maxDrawdown: float               │
│ sharpeRatio: float               │
│ profitFactor: float              │
│ totalTrades: number              │
│ trades: JSONB                    │
│ executedAt: DateTime             │
│ executionTimeMs: number          │
└──────────────────────────────────┘
```

### Versioning Rules
1. **Immutable**: Once a `StrategyVersion` is created, its `parameters` field is never updated.
2. **Monotonic versions**: version numbers increment per `strategyType` (MA v1, MA v2, ...).
3. **Composite snapshots**: A composite version captures `childVersionIds` + `combinerType` + `combinerWeights` — it's a frozen composition.
4. **Reproduction**: To reproduce experiment #122, look up `BacktestResult.strategyVersionId` → get the exact `StrategyVersion` → re-run with saved params.

### Consequences
- **Positive**: Full reproducibility. Leaderboard entries are traceable to exact strategy configs.
- **Positive**: Supports version comparison (v1 vs v2 performance).
- **Positive**: Works with existing Prisma + PostgreSQL + JSONB stack.
- **Negative**: Storage grows with each version. Acceptable for course project scale.
- **Negative**: No branching/merging (unlike Git). Not needed for this scope.
- **Risks**: JSONB comparison for deduplication may be needed if the search loop generates identical candidates. Mitigated by hashing params for fast dedup.

## Links
- Relates to ADR-0003 (Plugin Architecture — strategies are versioned plugins)
- Relates to ADR-0001 (Record Architecture Decisions)
- Affects: `kb/modules/strategy-engine.md` (Sections 3, 6, 8)
