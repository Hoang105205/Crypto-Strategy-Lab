'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LeaderboardDetail } from '../../components/leaderboard/leaderboard-detail';
import { LeaderboardTable } from '../../components/leaderboard/leaderboard-table';
import { LoadingState } from '../../components/common/loading-state';
import { useInfrastructure } from '../../components/common/infrastructure-provider';
import { useLeaderboard } from '../../hooks/use-leaderboard';
import type { InfrastructureEventSocket } from '../../hooks/use-dashboard-summary';

function LeaderboardWorkspace() {
  const searchParams = useSearchParams();
  const { socket, statusText } = useInfrastructure();
  const leaderboard = useLeaderboard({ socket: socket as unknown as InfrastructureEventSocket });
  const selectedId = leaderboard.selectedStrategyVersionId ?? searchParams.get('strategyVersionId');

  if (leaderboard.loading && !leaderboard.data) {
    return <LoadingState label="Loading leaderboard" minHeight={420} />;
  }
  if (leaderboard.error && !leaderboard.data) {
    return (
      <section role="alert" className="rounded-lg border border-hairline-dark bg-surface-card p-6">
        <p className="text-body">Leaderboard is temporarily unavailable.</p>
        <button type="button" onClick={() => void leaderboard.refetch()} className="mt-4 rounded bg-primary px-4 py-2 font-medium text-canvas-dark outline-none focus-visible:ring-2 focus-visible:ring-white">Retry</button>
      </section>
    );
  }
  if (!leaderboard.data || leaderboard.data.entries.length === 0) {
    return (
      <section className="rounded-lg border border-hairline-dark bg-surface-card p-6">
        <h1 className="text-xl font-semibold text-body">Strategy Leaderboard</h1>
        <p className="mt-2 text-sm text-muted">No ranked strategies have been published yet.</p>
        <a href="/strategy" className="mt-4 inline-block rounded bg-primary px-4 py-2 font-medium text-canvas-dark">View strategies</a>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span role="status">Infrastructure: {statusText}</span>
        {leaderboard.isStale ? <span role="status">Showing last successful snapshot while reconnecting.</span> : null}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <LeaderboardTable
          snapshot={leaderboard.data}
          sortBy={leaderboard.sortBy}
          selectedStrategyVersionId={selectedId}
          onSortByChange={(criterion) => {
            leaderboard.setSortBy(criterion);
            void leaderboard.refetch();
          }}
          onSelectStrategy={leaderboard.setSelectedStrategyVersionId}
        />
        <LeaderboardDetail strategyVersionId={selectedId} />
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <main className="p-4 md:p-6">
      <Suspense fallback={<LoadingState label="Loading leaderboard" minHeight={420} />}>
        <LeaderboardWorkspace />
      </Suspense>
    </main>
  );
}
