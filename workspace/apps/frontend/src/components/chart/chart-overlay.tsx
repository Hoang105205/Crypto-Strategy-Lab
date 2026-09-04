'use client';

// ChartOverlay — toggle buttons for MA, Bollinger Bands, Support/Resistance.
// Adds LineSeries to the chart when toggled on.
// Owner: Hoang
// See: spec.md FR-11, FR-12, DESIGN.md ChartOverlay component

import { useState, useEffect, useRef } from 'react';
import {
  LineSeries,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import type { Candle } from '@crypto-strategy-lab/shared';
import { COLORS } from '../../lib/constants';
import { sma, bollingerBands, supportResistance } from '../../lib/indicators';

interface ChartOverlayProps {
  chart: IChartApi | null;
  candles: Candle[];
}

type OverlayKey = 'ma' | 'bollinger' | 'sr';

interface OverlayState {
  ma: boolean;
  bollinger: boolean;
  sr: boolean;
}

export function ChartOverlay({ chart, candles }: ChartOverlayProps) {
  const [active, setActive] = useState<OverlayState>({
    ma: false,
    bollinger: false,
    sr: false,
  });
  const seriesRefs = useRef<Record<string, ISeriesApi<'Line'>[]>>({});

  // Recalculate and update overlay series when candles change or toggles change
  useEffect(() => {
    if (!chart || candles.length === 0) return;

    // Clean up previous series
    Object.values(seriesRefs.current).flat().forEach((s) => {
      try {
        chart.removeSeries(s);
      } catch {
        // already removed
      }
    });
    seriesRefs.current = {};

    if (active.ma) {
      const data = sma(candles);
      const series = chart.addSeries(LineSeries, {
        color: COLORS.primary,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      series.setData(data);
      seriesRefs.current.ma = [series];
    }

    if (active.bollinger) {
      const { upper, middle, lower } = bollingerBands(candles);
      const upperSeries = chart.addSeries(LineSeries, {
        color: COLORS.info,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const middleSeries = chart.addSeries(LineSeries, {
        color: COLORS.muted,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const lowerSeries = chart.addSeries(LineSeries, {
        color: COLORS.info,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      upperSeries.setData(upper);
      middleSeries.setData(middle);
      lowerSeries.setData(lower);
      seriesRefs.current.bollinger = [upperSeries, middleSeries, lowerSeries];
    }

    if (active.sr) {
      const { support, resistance } = supportResistance(candles);
      const supportSeries = chart.addSeries(LineSeries, {
        color: COLORS.mutedStrong,
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const resistanceSeries = chart.addSeries(LineSeries, {
        color: COLORS.mutedStrong,
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      supportSeries.setData(support);
      resistanceSeries.setData(resistance);
      seriesRefs.current.sr = [supportSeries, resistanceSeries];
    }

    return () => {
      Object.values(seriesRefs.current).flat().forEach((s) => {
        try {
          chart.removeSeries(s);
        } catch {
          // already removed
        }
      });
      seriesRefs.current = {};
    };
  }, [chart, candles, active]);

  const toggle = (key: OverlayKey) => {
    setActive((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const buttonClass = (isActive: boolean) =>
    `rounded px-2 py-0.5 text-xs ${isActive ? 'text-primary' : 'text-muted'} hover:text-primary`;

  return (
    <div className="flex items-center gap-3 px-1">
      <button type="button" className={buttonClass(active.ma)} onClick={() => toggle('ma')}>
        MA
      </button>
      <button type="button" className={buttonClass(active.bollinger)} onClick={() => toggle('bollinger')}>
        BOLL
      </button>
      <button type="button" className={buttonClass(active.sr)} onClick={() => toggle('sr')}>
        S/R
      </button>
    </div>
  );
}
