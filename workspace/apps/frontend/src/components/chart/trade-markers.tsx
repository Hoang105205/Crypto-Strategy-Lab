'use client';

// TradeMarkers — stub component. Real implementation deferred to W3.
// Owner: Hoang
// See: spec.md FR-13 [DEFERRED W3], plan.md Phase 5

interface TradeMarkersProps {
  symbol: string;
  timeframe: string;
}

/**
 * TODO W3: Integrate with BacktestResult.trades from the Strategy Engine.
 * Will render buy/sell markers on the chart using lightweight-charts
 * markers API (series.setMarkers()).
 */
export function TradeMarkers({}: TradeMarkersProps) {
  // Stub — no trade data available. Render nothing visible.
  return null;
}
