# Contract: Strategy API (backtest-result-visualization)

No new endpoints or events are introduced. This feature strictly implements the pre-existing contracts defined in `kb/contracts/strategy.yaml` and `kb/contracts/auth.yaml`.

## Field Changes
- `BacktesterService` will now populate the optional fields on the `Trade` object: `stopLoss`, `takeProfit`, `transactionCost`, `slippage`, and `volumeUsd`.
- Prisma queries will use `WHERE userId IS NULL OR userId = :currentUserId`.
