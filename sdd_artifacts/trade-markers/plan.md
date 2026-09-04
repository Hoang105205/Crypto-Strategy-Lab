# Implementation Plan: Trade Markers

**Feature**: `trade-markers` | **Date**: 2026-08-17 | **Spec**: spec.md

## Summary

Renders buy/sell markers on the candlestick chart using trade data from Huy's backtest API. Uses lightweight-charts v5 `createSeriesMarkers()` API.

## Technical Context

| Aspect | Value |
|---|---|
| **Chart library** | lightweight-charts 5.2.0 — `createSeriesMarkers(series, markers)` |
| **Backend API** | `GET /api/strategies/backtest/:id` → `BacktestResult` with `trades: Trade[]` |
| **Trade shape** | `{ entryDate, exitDate, entryPrice, exitPrice, side: "LONG"\|"SHORT", pnl, quantity }` |
| **Marker time format** | UTCTimestamp (epoch seconds) — same as candle data |
| **Shared types** | `Trade`, `BacktestResult` already exported from `@crypto-strategy-lab/shared` |

## Source Code Structure

```
apps/frontend/src/
├── services/api-client.ts        # ADD: getBacktestResult(id) method
├── components/chart/
│   ├── trade-markers.tsx          # REWRITE: fetch trades + render markers
│   └── candlestick-chart.tsx      # MODIFY: pass seriesRef + backtestResultId to TradeMarkers
```

## Phases

### Phase 0: API Client
1. Add `getBacktestResult(id: string): Promise<BacktestResult>` to `api-client.ts`

### Phase 1: TradeMarkers Component
1. Rewrite `trade-markers.tsx` — accept `{ series, backtestResultId }` props
2. Fetch trades when `backtestResultId` changes
3. Map trades to `SeriesMarker<UTCTimestamp>[]`:
   - Entry: `{ time: entryDate→epoch, position: 'belowBar', shape: 'arrowUp', color: '#0ecb81', text: 'BUY' }`
   - Exit: `{ time: exitDate→epoch, position: 'aboveBar', shape: 'arrowDown', color: '#f6465d', text: 'SELL' }`
4. Call `createSeriesMarkers(series, markers)` and clean up on unmount

### Phase 2: Chart Integration
1. Modify `candlestick-chart.tsx` — add optional `backtestResultId` prop
2. Pass `seriesRef.current` and `backtestResultId` to `<TradeMarkers>`

### Phase 3: Verify
1. `tsc --noEmit` clean
2. `eslint` clean
