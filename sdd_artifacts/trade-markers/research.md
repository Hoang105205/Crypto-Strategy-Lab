# Research: Trade Markers

## D1: lightweight-charts v5 markers API

- **Chosen**: `createSeriesMarkers(series, markers)` — v5 API (v4's `series.setMarkers()` is removed)
- **Usage**:
  ```ts
  import { createSeriesMarkers, type SeriesMarker, type UTCTimestamp } from 'lightweight-charts';
  const markersPlugin = createSeriesMarkers(series, markers);
  // Later: markersPlugin.setMarkers([]); // clear
  ```
- **SeriesMarker shape**: `{ time: UTCTimestamp, position: 'aboveBar'|'belowBar'|'inBar', color: string, shape: 'circle'|'square'|'arrowUp'|'arrowDown', text?: string }`
- **KB reference**: research.md D1 from market-data-frontend (v5 API confirmed)

## D2: Trade data source

- **Endpoint**: `GET /api/strategies/backtest/:id` (Huy's implementation — confirmed shipped)
- **Response**: `BacktestResult` with `trades: Trade[]`
- **Trade fields**: `entryDate` (ISO8601), `exitDate` (ISO8601), `entryPrice`, `exitPrice`, `side: "LONG"|"SHORT"`, `pnl`, `quantity`
- **Time conversion**: `Math.floor(new Date(trade.entryDate).getTime() / 1000)` → UTCTimestamp
