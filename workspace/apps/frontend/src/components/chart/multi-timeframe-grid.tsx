'use client';

// MultiTimeframeGrid — 2×2 grid of candlestick chart panels.
// Owner: Hoang
// See: spec.md FR-5, FR-6, FR-14, DESIGN.md MultiTimeframeGrid + Dashboard route

import { useState } from 'react';
import { CandlestickChart } from './candlestick-chart';
import { TimeframeSelector } from '../timeframe-selector';
import { DEFAULT_GRID_TIMEFRAMES, COLORS, type Timeframe } from '../../lib/constants';

interface MultiTimeframeGridProps {
  pair: string;
}

interface PanelState {
  timeframe: Timeframe;
}

export function MultiTimeframeGrid({ pair }: MultiTimeframeGridProps) {
  const [panels, setPanels] = useState<PanelState[]>(
    DEFAULT_GRID_TIMEFRAMES.map((tf) => ({ timeframe: tf })),
  );

  const changeTimeframe = (index: number, tf: Timeframe) => {
    setPanels((prev) =>
      prev.map((panel, i) => (i === index ? { timeframe: tf } : panel)),
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {panels.map((panel, index) => (
        <div
          key={index}
          className="rounded-xl p-4"
          style={{
            backgroundColor: COLORS.surfaceCard,
            border: `1px solid ${COLORS.hairlineDark}`,
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs text-muted">
              {pair} · Chart {index + 1}
            </span>
            <TimeframeSelector
              value={panel.timeframe}
              onChange={(tf) => changeTimeframe(index, tf)}
            />
          </div>
          <CandlestickChart symbol={pair} timeframe={panel.timeframe} />
        </div>
      ))}
    </div>
  );
}
