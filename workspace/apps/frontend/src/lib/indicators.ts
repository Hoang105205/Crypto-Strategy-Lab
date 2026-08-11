// Technical indicators — pure functions for chart overlays.
// Owner: Hoang
// See: sdd_artifacts/market-data-frontend/plan.md Phase 4

import type { UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '@crypto-strategy-lab/shared';
import { INDICATOR_PERIODS } from './constants';

export interface LinePoint {
  time: UTCTimestamp;
  value: number;
}

/** Simple Moving Average */
export function sma(
  candles: Candle[],
  period: number = INDICATOR_PERIODS.sma,
): LinePoint[] {
  const result: LinePoint[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].close;
    }
    result.push({
      time: Math.floor(candles[i].openTime.getTime() / 1000) as UTCTimestamp,
      value: sum / period,
    });
  }
  return result;
}

/** Bollinger Bands — returns upper, middle (SMA), and lower lines */
export function bollingerBands(
  candles: Candle[],
  period: number = INDICATOR_PERIODS.bollingerPeriod,
  stdDev: number = INDICATOR_PERIODS.bollingerStdDev,
): { upper: LinePoint[]; middle: LinePoint[]; lower: LinePoint[] } {
  const upper: LinePoint[] = [];
  const middle: LinePoint[] = [];
  const lower: LinePoint[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].close;
    }
    const mean = sum / period;

    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      variance += (candles[j].close - mean) ** 2;
    }
    const sd = Math.sqrt(variance / period);
    const time = Math.floor(candles[i].openTime.getTime() / 1000) as UTCTimestamp;

    upper.push({ time, value: mean + sd * stdDev });
    middle.push({ time, value: mean });
    lower.push({ time, value: mean - sd * stdDev });
  }

  return { upper, middle, lower };
}

/** Support and Resistance levels — recent high/low over lookback period */
export function supportResistance(
  candles: Candle[],
  lookback: number = INDICATOR_PERIODS.srLookback,
): { support: LinePoint[]; resistance: LinePoint[] } {
  if (candles.length === 0) return { support: [], resistance: [] };

  const start = Math.max(0, candles.length - lookback);
  const recent = candles.slice(start);

  let high = -Infinity;
  let low = Infinity;
  for (const c of recent) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }

  const lastTime = Math.floor(
    candles[candles.length - 1].openTime.getTime() / 1000,
  ) as UTCTimestamp;

  return {
    support: [{ time: lastTime, value: low }],
    resistance: [{ time: lastTime, value: high }],
  };
}
