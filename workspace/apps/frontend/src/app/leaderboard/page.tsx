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
      <section role="alert" className="rounded-xl border border-rose-500/30 bg-surface-card p-6 shadow-sm">
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
          <p className="text-sm font-medium text-rose-400">Leaderboard is temporarily unavailable.</p>
        </div>
        <button type="button" onClick={() => void leaderboard.refetch()} className="mt-4 rounded-lg bg-primary px-4 py-2 font-semibold text-black transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark shadow-sm">Retry</button>
      </section>
    );
  }
  if (!leaderboard.data || leaderboard.data.entries.length === 0) {
    return (
      <section className="rounded-xl border border-hairline-dark/80 bg-surface-card p-6 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight text-body">Strategy Leaderboard</h1>
        <p className="mt-2 text-sm text-muted">No ranked strategies have been published yet.</p>
        <a href="/strategy" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 font-semibold text-black transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark shadow-sm">View strategies</a>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-strong bg-surface-card border border-hairline-dark/80 rounded-xl px-4 py-2.5 shadow-sm">
        <span role="status" className="flex items-center gap-2.5 font-medium">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          Infrastructure: {statusText}
        </span>
        {leaderboard.isStale ? <span role="status" className="text-primary font-semibold">Showing last successful snapshot while reconnecting.</span> : null}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(360px,1fr)] items-start">
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
    <main className="min-w-0">
      <Suspense fallback={<LoadingState label="Loading leaderboard" minHeight={420} />}>
        <LeaderboardWorkspace />
      </Suspense>
    </main>
  );
}
