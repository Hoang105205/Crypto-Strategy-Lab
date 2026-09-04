'use client';

import { useEffect, useRef } from 'react';
import {
  createSeriesMarkers,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Trade } from '@crypto-strategy-lab/shared';
import { COLORS } from '../../lib/constants';

interface TradeMarkersProps {
  series: ISeriesApi<'Candlestick'> | null;
  trades: Trade[];
}

function toTimestamp(date: Date): UTCTimestamp {
  return Math.floor(date.getTime() / 1000) as UTCTimestamp;
}

function toMarkers(trades: Trade[]): SeriesMarker<Time>[] {
  return trades.flatMap((trade) => {
    const isLong = trade.side === 'LONG';
    return [
      {
        time: toTimestamp(trade.entryDate),
        position: isLong ? 'belowBar' : 'aboveBar',
        shape: isLong ? 'arrowUp' : 'arrowDown',
        color: isLong ? COLORS.tradingUp : COLORS.tradingDown,
        text: `Entry ${trade.side} @ ${trade.entryPrice.toFixed(2)}`,
      },
      {
        time: toTimestamp(trade.exitDate),
        position: isLong ? 'aboveBar' : 'belowBar',
        shape: isLong ? 'arrowDown' : 'arrowUp',
        color: trade.pnl >= 0 ? COLORS.tradingUp : COLORS.tradingDown,
        text: `Exit P&L ${trade.pnl.toFixed(2)}`,
      },
    ] satisfies SeriesMarker<Time>[];
  });
}

/** Maps published trades to the lightweight-charts v5 marker primitive. */
export function TradeMarkers({ series, trades }: TradeMarkersProps) {
  const pluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const skipFirstUpdateRef = useRef(false);

  useEffect(() => {
    if (!series) return;
    const plugin = createSeriesMarkers(series, toMarkers(trades));
    pluginRef.current = plugin;
    skipFirstUpdateRef.current = true;

    return () => {
      try {
        plugin.detach();
      } catch (error: unknown) {
        // The parent chart owns the series and can be disposed before this
        // child passive-effect cleanup runs during route navigation.
        if (!(error instanceof Error && error.message === 'Object is disposed')) {
          throw error;
        }
      }
      if (pluginRef.current === plugin) pluginRef.current = null;
    };
    // Series replacement recreates the primitive; trade-only updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);

  useEffect(() => {
    if (!series || !pluginRef.current) return;
    if (skipFirstUpdateRef.current) {
      skipFirstUpdateRef.current = false;
      return;
    }
    pluginRef.current.setMarkers(toMarkers(trades));
  }, [series, trades]);

  return null;
}
