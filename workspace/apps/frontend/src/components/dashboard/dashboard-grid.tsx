'use client';

import type { ReactNode } from 'react';
import { MultiTimeframeGrid } from '../chart/multi-timeframe-grid';
import { PairSelector } from '../pair-selector';
import { StatusIndicator } from '../status-indicator';

export interface DashboardGridProps {
  pair: string;
  onPairChange(value: string): void;
  loopStatusPanel: ReactNode;
  queueCard: ReactNode;
  leaderboardPreview: ReactNode;
}

export function DashboardGrid({
  pair,
  onPairChange,
  loopStatusPanel,
  queueCard,
  leaderboardPreview,
}: DashboardGridProps) {
  return (
    <div
      data-testid="dashboard-grid"
      className="grid grid-cols-1 gap-6 md:grid-cols-12"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 pb-2 md:col-span-12">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-body md:text-3xl">
            Market Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-strong font-normal">
            Live price action and strategy infrastructure
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2.5 text-sm font-medium text-muted-strong">
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
        className="flex min-w-0 flex-col gap-6 md:col-span-4"
      >
        {loopStatusPanel}
        {queueCard}
        {leaderboardPreview}
      </aside>
    </div>
  );
}
