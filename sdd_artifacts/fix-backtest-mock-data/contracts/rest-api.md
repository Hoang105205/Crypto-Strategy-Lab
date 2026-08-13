# Contract: StrategyController Backtest API

## Endpoints

### GET /api/strategies/backtest/:id
**Response**: 
```typescript
{
  id: string;
  strategyVersionId: string;
  pair: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  totalTrades: number;
  trades: Array<{
    entryDate: string;
    exitDate: string;
    entryPrice: number;
    exitPrice: number;
    side: "LONG" | "SHORT";
    pnl: number;
    quantity: number;
  }>;
  executedAt: Date;
  executionTimeMs: number;
}
```
**Errors**: 
- `404 Not Found`: If the backtest result with the given ID does not exist in the database.
