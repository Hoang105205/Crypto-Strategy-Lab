'use client';

// Dashboard Home — Crypto Strategy Lab
// Owner: Hoang
// See: spec.md US1–US4, plan.md Phase 3, DESIGN.md Dashboard route

import { useState } from 'react';
import { PairSelector } from '../components/pair-selector';
import { StatusIndicator } from '../components/status-indicator';
import { MultiTimeframeGrid } from '../components/chart/multi-timeframe-grid';
import { DEFAULT_PAIR, COLORS } from '../lib/constants';

export default function Home() {
  const [pair, setPair] = useState(DEFAULT_PAIR);

  return (
    <main className="min-h-screen p-6" style={{ backgroundColor: COLORS.canvasDark }}>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-body">Crypto Strategy Lab</h1>
        <div className="flex items-center gap-4">
          <PairSelector value={pair} onChange={setPair} />
          <StatusIndicator />
        </div>
      </header>

      <MultiTimeframeGrid pair={pair} />
    </main>
  );
}
