# Quickstart: backtest-result-visualization

## Prerequisites
- Supabase account configured and user registered/logged in via the Frontend.
- Backend and Frontend running locally.

## Setup
```bash
# If needed, run migrations
npm run db:push
```

## Validation Scenarios

### Scenario 1: Private Strategy Scope
1. Log into the Frontend as User A.
2. Create a Custom Composite Strategy.
3. Log out and log in as User B.
4. ✅ Expected: User B cannot see User A's custom strategy in the strategy list.

### Scenario 2: Extended Backtest Metrics & Chart
1. As any logged-in user, configure a backtest with `10000` Capital, `0.001` Commission, `0.02` SL, and `0.05` TP.
2. Submit the backtest and wait for it to complete.
3. Navigate to the backtest details.
4. ✅ Expected: The Trade Detail table displays columns for SL, TP, Slippage, Cost, and Volume USD, with calculated numbers (not `undefined`).
5. ✅ Expected: An Equity Curve line chart is rendered, visually showing the P&L progression.
