'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  type IChartApi,
  type UTCTimestamp,
  LineSeries,
} from 'lightweight-charts';
import type { Trade } from '@crypto-strategy-lab/shared';

interface EquityCurveChartProps {
  trades: Trade[];
  initialCapital?: number;
}

/**
 * Equity curve chart — cumulative profit over time.
 * Computes running balance from Trade[] and renders as a line chart.
 *
 * Req §5 (todo #5): "Visualize trên biểu đồ" — home page stats.
 * See: kb/GLOSSARY.md §Equity Curve
 */
export function EquityCurveChart({ trades, initialCapital = 10000 }: EquityCurveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || trades.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 300,
      layout: {
        background: { color: 'transparent' },
        textColor: '#848e9c',
      },
      grid: {
        vertLines: { color: 'rgba(132, 142, 156, 0.1)' },
        horzLines: { color: 'rgba(132, 142, 156, 0.1)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(132, 142, 156, 0.2)',
      },
      timeScale: {
        borderColor: 'rgba(132, 142, 156, 0.2)',
      },
    });

    chartRef.current = chart;

    const series = chart.addSeries(LineSeries, {
      color: '#fcd535',
      lineWidth: 2,
    });

    // Compute equity curve: cumulative PnL over trade exit dates
    let balance = initialCapital;
    const data = trades
      .filter((t) => t.exitDate)
      .map((trade) => {
        balance += (balance * trade.pnl) / 100;
        return {
          time: Math.floor(new Date(trade.exitDate).getTime() / 1000) as UTCTimestamp,
          value: balance,
        };
      })
      .sort((a, b) => a.time - b.time);

    series.setData(data);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [trades, initialCapital]);

  if (!trades || trades.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg bg-surface-card text-body-secondary">
        No trade data for equity curve
      </div>
    );
  }

  return <div ref={containerRef} className="rounded-lg bg-surface-card p-2" />;
}
