# Huy — New Requirements Assignment

> **Date**: 2026-08-18 | **From**: Hoàng (Architect)
> **Prerequisite**: ✅ Hoàng's auth infra is DONE — pull from `dev` to get `SupabaseJwtGuard`, `@CurrentUser()`, and extended `Trade` type.
> **Must read**: `plans/new-requirements-summary.md` before starting

## Your Tasks

### A6: Add userId filtering to Strategy Engine

**What**: Add `@CurrentUser()` to your strategy controller methods. Filter all
StrategyVersion and BacktestResult queries by userId.

**Why**: Users should only see system-discovered strategies (shared) + their own
user-created strategies (private). System data has `userId = null`.

**How**:
1. Read `kb/contracts/auth.yaml` — especially §decorators and §data_scoping
2. Add `@UseGuards(SupabaseJwtGuard)` to your controller class or methods
3. Add `@CurrentUser() userId: string | null` parameter to each controller method
4. Pass `userId` to your service methods
5. In Prisma queries, add: `where: { OR: [{ userId: null }, { userId: userId }] }`

**Example**:
```typescript
@UseGuards(SupabaseJwtGuard)
@Controller('strategies')
export class StrategyController {
  @Get()
  async list(@CurrentUser() userId: string | null) {
    return this.service.findAll({
      OR: [{ userId: null }, { userId: userId }]
    });
  }
}
```

**Files to modify**: `src/strategy/controllers/strategy.controller.ts`, related services

### B2: Extend Backtester trade output

**What**: The Backtester must output 5 new fields per trade: `stopLoss`, `takeProfit`,
`transactionCost`, `slippage`, `volumeUsd`.

**Why**: New requirement (todo #4) — trade detail table on the frontend needs these fields.

**How**:
1. Read updated `kb/contracts/strategy.yaml` — see `Trade` entity (5 new fields) and `BacktestConfig` (2 new fields: `stopLossPercent`, `takeProfitPercent`)
2. Read updated `libs/shared/src/types/strategy.ts` — Hoàng will extend the `Trade` interface
3. In your Backtester, after computing each trade:
   - `stopLoss` = for LONG: `entryPrice × (1 - config.stopLossPercent)`, for SHORT: `entryPrice × (1 + config.stopLossPercent)`
   - `takeProfit` = for LONG: `entryPrice × (1 + config.takeProfitPercent)`, for SHORT: `entryPrice × (1 - config.takeProfitPercent)`
   - `transactionCost` = `config.commission × (entryPrice × quantity)`
   - `slippage` = `config.slippage × entryPrice`
   - `volumeUsd` = `entryPrice × quantity`
4. All 5 fields are optional (`?`) — if config values are null, output null

**Files to modify**: `src/strategy/backtest/backtester.ts` or equivalent

### B3: Trade Detail Table (frontend)

**What**: Frontend component that displays all trade fields in a table — Entry Time, Exit Time, Direction, Volume USD, Entry/Exit Price, StopLoss, TakeProfit, TxCost, Slippage, Profit + summary stats (win rate, total profit, total trades).

**Why**: New requirement (todo #4) — users need to see detailed trade results.

**Reference code (already committed by Hoàng)**:
- `apps/frontend/src/components/trade-detail-table.tsx` — full implementation exists. Read it, understand it, iterate on it. It already renders all 12 columns + 3 stat cards.
- Uses `Trade[]` from `@crypto-strategy-lab/shared` (already extended with 5 new fields by Hoàng)

**What you need to do**:
1. Review the reference implementation — it's functional but may need styling/layout adjustments
2. Wire it into your strategy/backtest page where backtest results are displayed
3. Make sure it works with real data from your backtester output (after B2 is done)

### C1: Equity Curve Chart (frontend)

**What**: Cumulative profit line chart showing account balance growth over time, computed from `Trade[]`.

**Why**: New requirement (todo #5) — "Visualize trên biểu đồ" — stats visualization on home page.

**Reference code (already committed by Hoàng)**:
- `apps/frontend/src/components/chart/equity-curve-chart.tsx` — full implementation exists. Uses lightweight-charts v5 `LineSeries`. Computes running balance from `trade.pnl` percentages.
- Uses `Trade[]` from `@crypto-strategy-lab/shared`

**What you need to do**:
1. Review the reference implementation
2. Wire it into the appropriate page (home page or strategy detail page)
3. Make sure it works with real backtest data

### C2: Integrate into page

**What**: Wire B3 (trade detail table) + C1 (equity curve chart) into the page where backtest results are displayed (likely strategy page or leaderboard detail).

**How**: Import both components, pass `trades` from the backtest result to each:
```tsx
import { TradeDetailTable } from '../components/trade-detail-table';
import { EquityCurveChart } from '../components/chart/equity-curve-chart';

// In your page:
<TradeDetailTable trades={backtestResult.trades} />
<EquityCurveChart trades={backtestResult.trades} />
```

## How to Start

```bash
# 1. Pull latest code from dev branch
git pull origin dev

# 2. Read the updated KB
cat kb/contracts/auth.yaml       # Auth contract — guards, decorators, data scoping
cat kb/contracts/strategy.yaml   # Updated Trade entity + BacktestConfig

# 3. Review reference implementations Hoàng already wrote
cat workspace/apps/frontend/src/components/trade-detail-table.tsx
cat workspace/apps/frontend/src/components/chart/equity-curve-chart.tsx

# 4. Run SDD cycle for your tasks
/hoang-sdd-specify
# Feature: "Add userId filtering to Strategy Engine, extend Backtester trade output, wire trade detail table and equity curve chart into strategy page"
```

## Estimated effort: 2.5 days (A6: 0.5d + B2: 1d + B3+C1+C2: 1d — reference code exists, mostly wiring)
