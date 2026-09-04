# Tasks: Trade Markers

## Phase 0: API Client
- [X] **T0.1** Add `getBacktestResult(id: string)` to `apps/frontend/src/services/api-client.ts`

## Phase 1: TradeMarkers Component
- [X] **T1.1** Rewrite `apps/frontend/src/components/chart/trade-markers.tsx` — accept `{ series, backtestResultId }`, fetch trades, map to markers, render via `createSeriesMarkers()`
- [X] **T1.2** Map trades: entry → arrowUp/belowBar/green/BUY, exit → arrowDown/aboveBar/red/SELL
- [X] **T1.3** Clean up markers on unmount (setMarkers([]))

## Phase 2: Chart Integration
- [X] **T2.1** Modify `candlestick-chart.tsx` — add optional `backtestResultId` prop, pass `seriesRef.current` + `backtestResultId` to TradeMarkers

## Phase 3: Verify
- [X] **T3.1** `tsc --noEmit` clean
- [X] **T3.2** `eslint` clean
