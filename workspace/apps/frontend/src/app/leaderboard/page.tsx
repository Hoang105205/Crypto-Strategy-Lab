'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { LeaderboardScope, RankingCriterion } from '@crypto-strategy-lab/shared';
import { LeaderboardDetail } from '../../components/leaderboard/leaderboard-detail';
import { LeaderboardTable } from '../../components/leaderboard/leaderboard-table';
import { LoadingState } from '../../components/common/loading-state';
import { useInfrastructure } from '../../components/common/infrastructure-provider';
import { useAuth } from '../../contexts/auth-context';
import { useLeaderboard } from '../../hooks/use-leaderboard';

const CRITERIA: ReadonlyArray<{ value: RankingCriterion; label: string }> = [
  { value: RankingCriterion.SCORE, label: 'Score' },
  { value: RankingCriterion.TOTAL_RETURN, label: 'Return' },
  { value: RankingCriterion.WIN_RATE, label: 'Win Rate' },
  { value: RankingCriterion.MAX_DRAWDOWN, label: 'Max Drawdown' },
  { value: RankingCriterion.SHARPE_RATIO, label: 'Sharpe' },
];

function AnonymousMineCard({ authLoading }: { authLoading: boolean }) {
  return (
    <section
      role="region"
      aria-labelledby="mine-strategies-heading"
      aria-label="My Strategies"
      className="rounded-xl border border-hairline-dark/80 bg-surface-card p-6 shadow-md"
    >
      <h2 id="mine-strategies-heading" className="text-2xl font-bold tracking-tight text-body">My Strategies</h2>
      <p className="mt-1 text-sm text-muted">Your private ranking projection is available only to your signed-in account.</p>
      {authLoading ? (
        <p role="status" className="mt-4 text-sm text-muted">Checking sign-in status…</p>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-muted">Sign in to view your strategies.</p>
          <Link
            href="/login?redirect=/leaderboard"
            className="mt-4 inline-flex rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Sign in
          </Link>
        </div>
      )}
    </section>
  );
}

function LeaderboardWorkspace() {
  const searchParams = useSearchParams();
  const { statusText } = useInfrastructure();
  const { user, loading: authLoading } = useAuth();
  const leaderboard = useLeaderboard();
  const urlSelectionId = searchParams.get('strategyVersionId');
  const selection = leaderboard.selectedStrategy ?? (urlSelectionId
    ? { strategyVersionId: urlSelectionId, sourceScope: LeaderboardScope.COMBINED }
    : null);

  const selectStrategy = (
    strategyVersionId: string,
    sourceScope: LeaderboardScope.SYSTEM | LeaderboardScope.MINE,
  ) => {
    leaderboard.setSelectedStrategy({ strategyVersionId, sourceScope });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-hairline-dark/80 bg-surface-card px-4 py-3 shadow-sm">
        <span role="status" className="flex items-center gap-2.5 text-xs font-medium text-muted-strong">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          Infrastructure: {statusText}
        </span>
        <label className="flex items-center gap-2.5 text-sm font-medium text-muted">
          <span>Ranking criterion</span>
          <select
            aria-label="Ranking criterion"
            value={leaderboard.sortBy}
            onChange={(event) => leaderboard.setSortBy(event.target.value as RankingCriterion)}
            className="cursor-pointer rounded-xl border border-hairline-dark/80 bg-canvas-dark px-3.5 py-2 text-sm font-medium text-body outline-none hover:border-muted-strong focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"
          >
            {CRITERIA.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div
        data-testid="leaderboard-workspace"
        className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(360px,1fr)]"
      >
        <div data-testid="ranking-column" className="min-w-0 space-y-6">
          <LeaderboardTable
            heading="System Leaderboard"
            description="Strategies published by the global Search Loop."
            headingId="system-leaderboard-heading"
            tableName="System leaderboard rankings"
            sourceScope={LeaderboardScope.SYSTEM}
            projection={leaderboard.system}
            sortBy={leaderboard.sortBy}
            selectedStrategyVersionId={selection?.sourceScope === LeaderboardScope.SYSTEM ? selection.strategyVersionId : null}
            onSortByChange={leaderboard.setSortBy}
            onSelectStrategy={selectStrategy}
            emptyState={<p>No system strategies are ranked.</p>}
          />

          {user ? (
            <LeaderboardTable
              heading="My Strategies"
              description="Strategies ranked only for your current account."
              headingId="mine-strategies-heading"
              tableName="My strategies rankings"
              sourceScope={LeaderboardScope.MINE}
              projection={leaderboard.mine}
              sortBy={leaderboard.sortBy}
              selectedStrategyVersionId={selection?.sourceScope === LeaderboardScope.MINE ? selection.strategyVersionId : null}
              onSortByChange={leaderboard.setSortBy}
              onSelectStrategy={selectStrategy}
              emptyState={(
                <div>
                  <p>No strategies ranked yet.</p>
                  <Link
                    href="/strategy"
                    className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 font-semibold text-black hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
                  >
                    Build a strategy
                  </Link>
                </div>
              )}
            />
          ) : <AnonymousMineCard authLoading={authLoading} />}
        </div>

        <LeaderboardDetail
          strategyVersionId={selection?.strategyVersionId ?? null}
          sourceScope={selection?.sourceScope ?? LeaderboardScope.COMBINED}
        />
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
