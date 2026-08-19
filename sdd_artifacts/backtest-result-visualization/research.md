# Research: backtest-result-visualization

## Decisions

### D1: How to handle missing `userId` during loop runs vs. authenticated requests?
- **Chosen**: The Guard returns `null` if unauthenticated. The query logic must use `WHERE userId IS NULL OR userId = :userId` when fetching global data, but when a user creates/submits a backtest, the `userId` is firmly attached to the generated result/version.
- **Rationale**: Meets ADR-0016 for data scoping.
- **KB reference**: `kb/contracts/auth.yaml` section `data_scoping`

### D2: Trade Calculation Formulas
- **Chosen**: 
  - `volumeUsd` = `entryPrice * quantity`
  - `transactionCost` = `volumeUsd * config.commission` (charged per trade, assumes entry+exit combined or simplifies to per-trade). Note: we'll apply it once per trade.
  - `slippage` = `entryPrice * config.slippage` (applied to entry and exit).
  - `stopLoss` = `entryPrice * (1 - config.stopLossPercent)` (for LONG, inverted for SHORT).
  - `takeProfit` = `entryPrice * (1 + config.takeProfitPercent)` (for LONG, inverted for SHORT).
- **Rationale**: Strict compliance with `kb/contracts/strategy.yaml`.

### D3: Equity Curve rendering
- **Chosen**: Use the existing `lightweight-charts` reference implementation from Hoàng. The data requires an array of `{ time, value }` where value is the cumulative return percentage or total capital at that specific trade's exitDate.
- **Rationale**: Minimizes dependencies, uses already proven primitive.
