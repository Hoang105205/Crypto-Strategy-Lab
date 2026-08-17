'use client';

// CandlestickChart — lightweight-charts v5 wrapper with real-time updates.
// Owner: Hoang
// See: sdd_artifacts/market-data-frontend/research.md D1, spec.md FR-1 through FR-4

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle, Trade } from '@crypto-strategy-lab/shared';
import { useMarketData } from '../../hooks/use-market-data';
import { COLORS } from '../../lib/constants';
import { ChartOverlay } from './chart-overlay';
import { TradeMarkers } from './trade-markers';

interface CandlestickChartProps {
  symbol: string;
  timeframe: string;
  trades?: Trade[];
}

function toChartBar(candle: Candle) {
  return {
    time: Math.floor(candle.openTime.getTime() / 1000) as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

export function CandlestickChart({ symbol, timeframe, trades = [] }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [chart, setChart] = useState<IChartApi | null>(null);
  const [markerSeries, setMarkerSeries] = useState<ISeriesApi<'Candlestick'> | null>(null);
  const [showOverlays, setShowOverlays] = useState(false);

  const { candles, loading, error } = useMarketData(symbol, timeframe, {
    onUpdate: (candle: Candle) => {
      seriesRef.current?.update(toChartBar(candle));
    },
    onClose: (candle: Candle) => {
      seriesRef.current?.update(toChartBar(candle));
    },
  });

  // Create chart instance once
  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: COLORS.surfaceCard },
        textColor: COLORS.body,
      },
      grid: {
        vertLines: { color: COLORS.hairlineDark },
        horzLines: { color: COLORS.hairlineDark },
      },
      timeScale: {
        borderColor: COLORS.hairlineDark,
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: COLORS.hairlineDark,
      },
      width: containerRef.current.clientWidth,
      height: 400,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.tradingUp,
      downColor: COLORS.tradingDown,
      borderVisible: false,
      wickUpColor: COLORS.tradingUp,
      wickDownColor: COLORS.tradingDown,
    });

    setChart(chart);
    seriesRef.current = series;
    setMarkerSeries(series);

    // Responsive resize
    const ro = new ResizeObserver(() => {
      if (!disposed && containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      // A ResizeObserver notification may already be queued when the route
      // unmounts. Mark the instance dead before disposing the chart so that
      // the queued callback cannot call into lightweight-charts afterwards.
      disposed = true;
      ro.disconnect();
      chart.remove();
      setChart(null);
      setMarkerSeries(null);
      seriesRef.current = null;
    };
  }, []);

  // Update chart data when historical candles load or timeframe changes
  useEffect(() => {
    if (seriesRef.current && candles.length > 0) {
      seriesRef.current.setData(candles.map(toChartBar));
      chart?.timeScale().fitContent();
    }
  }, [candles, chart]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="font-mono text-sm text-body">
          {symbol} · {timeframe}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowOverlays((v) => !v)}
            className="rounded px-2 py-0.5 text-xs text-muted hover:text-primary"
          >
            {showOverlays ? 'Hide' : 'Overlays'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex h-[400px] items-center justify-center text-muted">
          Loading candles...
        </div>
      )}
      {error && (
        <div className="flex h-[400px] items-center justify-center text-trading-down">
          {error}
        </div>
      )}

      <div ref={containerRef} className="w-full" style={{ display: loading || error ? 'none' : 'block' }} />

      {showOverlays && !loading && !error && (
        <ChartOverlay
          chart={chart}
          candles={candles}
        />
      )}

      {trades.length > 0 ? (
        <TradeMarkers series={markerSeries} trades={trades} />
      ) : null}
    </div>
  );
}
