'use client';

import type { ReactNode } from 'react';
import { MultiTimeframeGrid } from '../chart/multi-timeframe-grid';
import { PairSelector } from '../pair-selector';
import { StatusIndicator } from '../status-indicator';

export interface DashboardGridProps {
  pair: string;
  onPairChange(value: string): void;
  loopPanel: ReactNode;
  queueCard: ReactNode;
  leaderboardPreview: ReactNode;
}

export function DashboardGrid({
  pair,
  onPairChange,
  loopPanel,
  queueCard,
  leaderboardPreview,
}: DashboardGridProps) {
  return (
    <div
      data-testid="dashboard-grid"
      className="grid grid-cols-1 gap-6 md:grid-cols-12"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 md:col-span-12">
        <div>
          <h1 className="text-2xl font-semibold text-body">Market Dashboard</h1>
          <p className="mt-1 text-sm text-muted-strong">
            Live price action and strategy infrastructure
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-strong">
            <span>Trading pair</span>
            <PairSelector value={pair} onChange={onPairChange} />
          </label>
          <StatusIndicator />
        </div>
      </header>

      <section
        aria-label="Market Data"
        className="min-w-0 md:col-span-8"
      >
        <MultiTimeframeGrid pair={pair} />
      </section>

      <aside
        aria-label="Infrastructure status"
        className="flex min-w-0 flex-col gap-4 md:col-span-4"
      >
        {loopPanel}
        {queueCard}
        {leaderboardPreview}
      </aside>
    </div>
  );
}
