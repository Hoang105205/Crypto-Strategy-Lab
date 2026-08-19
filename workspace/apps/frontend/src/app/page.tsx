'use client';

// Dashboard Home — Crypto Strategy Lab
// Owner: Hoang
// See: spec.md US1–US4, plan.md Phase 3, DESIGN.md Dashboard route

import { useMemo, useState } from 'react';
import { StrategyGeneratorType } from '@crypto-strategy-lab/shared';
import { DashboardGrid } from '../components/dashboard/dashboard-grid';
import { LeaderboardPreview } from '../components/dashboard/leaderboard-preview';
import { LoopStatusPanel } from '../components/dashboard/loop-status-panel';
import { QueueHealthCard } from '../components/dashboard/queue-health-card';
import { ProtectedRoute } from '../components/auth/protected-route';
import { useDashboardSummary } from '../hooks/use-dashboard-summary';
import { DEFAULT_PAIR } from '../lib/constants';
import { apiClient, type StartLoopRequest } from '../services/api-client';

export default function Home() {
  const [pair, setPair] = useState(DEFAULT_PAIR);
  const [selectedStrategyVersionId, setSelectedStrategyVersionId] = useState<
    string | null
  >(null);
  const dashboard = useDashboardSummary();
  const startRequest = useMemo<StartLoopRequest>(() => {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    return {
      generatorType: StrategyGeneratorType.RANDOM,
      pair,
      timeframe: '1h',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      backtestConfig: {
        initialCapital: 10_000,
        positionSizePercent: 10,
      },
      maxCandidates: 20,
      stopOnNoImprovementIterations: 10,
    };
  }, [pair]);

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-canvas-dark">
        <DashboardGrid
        pair={pair}
        onPairChange={setPair}
        loopPanel={
          <LoopStatusPanel
            loop={dashboard.data?.loop ?? null}
            loading={dashboard.loading}
            error={dashboard.error}
            isStale={dashboard.isStale}
            lastSuccessfulAt={dashboard.lastSuccessfulAt}
            startRequest={startRequest}
            api={apiClient}
            onRefresh={dashboard.refetch}
          />
        }
        queueCard={
          <QueueHealthCard
            stats={dashboard.data?.queue ?? null}
            loading={dashboard.loading}
            error={dashboard.error}
            isStale={dashboard.isStale}
            lastSuccessfulAt={dashboard.lastSuccessfulAt}
            onRetry={() => void dashboard.refetch()}
          />
        }
        leaderboardPreview={
          <LeaderboardPreview
            snapshot={dashboard.data?.leaderboard ?? null}
            loading={dashboard.loading}
            error={dashboard.error}
            isStale={dashboard.isStale}
            lastSuccessfulAt={dashboard.lastSuccessfulAt}
            selectedStrategyVersionId={selectedStrategyVersionId}
            onSelectStrategy={setSelectedStrategyVersionId}
            onRetry={() => void dashboard.refetch()}
          />
        }
      />
      </main>
    </ProtectedRoute>
  );
}
