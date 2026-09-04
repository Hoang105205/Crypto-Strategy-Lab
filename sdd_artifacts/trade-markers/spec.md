# Feature Specification: Trade Markers

**Feature**: `trade-markers`
**Created**: 2026-08-17
**Status**: Draft
**Input**: "Implement TradeMarkers to render buy/sell markers on candlestick chart using BacktestResult.trades from GET /api/strategies/backtest/:id"

## User Story — View Trade Markers on Chart (Priority: P1)

A user clicks a strategy on the leaderboard. The chart displays buy markers (green arrows below the bar) at entry points and sell markers (red arrows above the bar) at exit points for each trade in the backtest.

**Acceptance Scenarios**:
1. Given a chart is showing candles, when a backtestResultId is provided, then buy/sell markers appear at the correct candle positions.
2. Given no backtestResultId, no markers are rendered (component returns null).
3. Given a backtest with 0 trades, no markers appear.
4. Given LONG trades: entry = arrowUp below bar (green, "BUY"), exit = arrowDown above bar (red, "SELL").

## Requirements

- **FR-1**: Component MUST fetch trades from `GET /api/strategies/backtest/:id` when `backtestResultId` is provided.
- **FR-2**: MUST render markers via `createSeriesMarkers()` (lightweight-charts v5 API).
- **FR-3**: Entry markers: `position: 'belowBar'`, `shape: 'arrowUp'`, `color: '#0ecb81'`, `text: 'BUY'`.
- **FR-4**: Exit markers: `position: 'aboveBar'`, `shape: 'arrowDown'`, `color: '#f6465d'`, `text: 'SELL'`.
- **FR-5**: Markers MUST use epoch seconds for `time` (same as candle data).
- **FR-6**: MUST clean up markers on unmount or when backtestResultId changes.

## KB Cross-References
- **Req**: §25 (Visualization), §26 (Trade Detail), §37 (MVP: Buy/Sell, Entry/Exit)
- **Contract**: `kb/contracts/strategy.yaml` — `Trade` entity, `BacktestResult` entity
- **Backend**: `GET /api/strategies/backtest/:id` (Huy's implementation — confirmed shipped)
