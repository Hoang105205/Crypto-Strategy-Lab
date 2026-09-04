'use client';

import {
  LeaderboardScope,
  RankingCriterion,
  type LeaderboardEntryPayload,
} from '@crypto-strategy-lab/shared';
import type { ReactNode } from 'react';
import type { ProjectionViewState } from '../../contexts/leaderboard-live-context';

interface LeaderboardTableProps {
  heading: string;
  description: string;
  headingId: string;
  tableName: string;
  sourceScope: LeaderboardScope.SYSTEM | LeaderboardScope.MINE;
  projection: ProjectionViewState;
  sortBy: RankingCriterion;
  selectedStrategyVersionId: string | null;
  onSortByChange: (criterion: RankingCriterion) => void;
  onSelectStrategy: (
    strategyVersionId: string,
    sourceScope: LeaderboardScope.SYSTEM | LeaderboardScope.MINE,
  ) => void;
  emptyState: ReactNode;
}

const SORTABLE_COLUMNS: ReadonlyArray<{ criterion: RankingCriterion; label: string }> = [
  { criterion: RankingCriterion.SCORE, label: 'Score' },
  { criterion: RankingCriterion.TOTAL_RETURN, label: 'Return' },
  { criterion: RankingCriterion.WIN_RATE, label: 'Win Rate' },
  { criterion: RankingCriterion.MAX_DRAWDOWN, label: 'Max Drawdown' },
  { criterion: RankingCriterion.SHARPE_RATIO, label: 'Sharpe' },
];

function formatPercent(value: number, showPositiveSign = false, normalized = false): string {
  const percent = normalized ? value * 100 : value;
  return `${showPositiveSign && percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
}

function FinancialCell({ entry, criterion }: { entry: LeaderboardEntryPayload; criterion: RankingCriterion }) {
  switch (criterion) {
    case RankingCriterion.SCORE:
      return <span className="font-mono tabular-nums">{entry.score.toFixed(4)}</span>;
    case RankingCriterion.TOTAL_RETURN:
      return (
        <span
          aria-label={`${entry.totalReturn > 0 ? 'positive return trading-up' : entry.totalReturn < 0 ? 'negative return trading-down' : 'unchanged return'} ${formatPercent(entry.totalReturn, true)}`}
          className={`font-mono tabular-nums ${entry.totalReturn > 0 ? 'text-trading-up' : entry.totalReturn < 0 ? 'text-trading-down' : 'text-body'}`}
        >
          {formatPercent(entry.totalReturn, true)}
        </span>
      );
    case RankingCriterion.WIN_RATE:
      return <span className="font-mono tabular-nums">{formatPercent(entry.winRate, false, true)}</span>;
    case RankingCriterion.MAX_DRAWDOWN:
      return <span className="font-mono tabular-nums">{formatPercent(entry.maxDrawdown)}</span>;
    case RankingCriterion.SHARPE_RATIO:
      return <span className="font-mono tabular-nums">{entry.sharpeRatio.toFixed(2)}</span>;
  }
}

function RetryButton({ heading, refetch }: { heading: string; refetch(): Promise<void> }) {
  return (
    <button
      type="button"
      aria-label={`Retry ${heading}`}
      onClick={() => void refetch()}
      className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
    >
      Retry
    </button>
  );
}

export function LeaderboardTable({
  heading,
  description,
  headingId,
  tableName,
  sourceScope,
  projection,
  sortBy,
  selectedStrategyVersionId,
  onSortByChange,
  onSelectStrategy,
  emptyState,
}: LeaderboardTableProps) {
  const { snapshot, loading, error, isStale, lastSuccessfulAt, refetch } = projection;
  return (
    <section aria-labelledby={headingId} className="min-w-0 overflow-hidden rounded-xl border border-hairline-dark/80 bg-surface-card shadow-md">
      <header className="border-b border-hairline-dark/80 px-6 py-5">
        <h2 id={headingId} className="text-2xl font-bold tracking-tight text-body">{heading}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
        {snapshot ? <p className="mt-2 text-xs font-medium text-muted">Last updated: {snapshot.updatedAt.toLocaleString()}</p> : null}
      </header>

      {loading && !snapshot ? (
        <div role="status" aria-label={`Loading ${heading}`} aria-busy="true" className="min-h-48 p-6 text-sm text-muted">
          Loading {heading.toLowerCase()}…
        </div>
      ) : null}

      {error && !snapshot ? (
        <div role="alert" aria-label={`${heading} unavailable`} className="space-y-4 p-6">
          <p className="text-sm text-rose-400">{heading} is temporarily unavailable.</p>
          <RetryButton heading={heading} refetch={refetch} />
        </div>
      ) : null}

      {!loading && !error && snapshot?.entries.length === 0 ? (
        <div className="p-6 text-sm text-muted">{emptyState}</div>
      ) : null}

      {snapshot && isStale ? (
        <div className="border-b border-amber-400/30 bg-amber-400/10 px-6 py-3">
          <p role="status" aria-label={`${heading} is stale`} className="text-sm text-amber-200">
            Showing the last successful snapshot{lastSuccessfulAt ? ` from ${lastSuccessfulAt.toLocaleString()}` : ''}.
          </p>
        </div>
      ) : null}

      {snapshot && snapshot.entries.length > 0 ? (
        <div
          role="region"
          aria-label={`Scroll ${tableName}`}
          tabIndex={0}
          className="max-h-[680px] overflow-x-auto overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <table aria-label={tableName} className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-hairline-dark/80 bg-canvas-dark/95 text-xs font-bold uppercase tracking-wider text-muted-strong backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3 text-left font-normal text-muted whitespace-nowrap" scope="col">Rank</th>
                <th className="px-4 py-3 text-left font-normal text-muted whitespace-nowrap" scope="col">Strategy</th>
                {SORTABLE_COLUMNS.map(({ criterion, label }) => (
                  <th key={criterion} aria-sort={criterion === sortBy ? 'descending' : 'none'} className="px-4 py-3 text-left font-normal text-muted whitespace-nowrap" scope="col">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-bold transition-colors hover:bg-surface-elevated/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={() => onSortByChange(criterion)}
                      aria-label={`Sort by ${label}`}
                    >
                      {label} {criterion === sortBy ? <span aria-hidden="true" className="font-extrabold text-primary">↓</span> : null}
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-normal text-muted whitespace-nowrap" scope="col">Trades</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-dark/60">
              {snapshot.entries.map((entry) => {
                const selected = entry.strategyVersionId === selectedStrategyVersionId;
                const rankBadge = entry.rank === 1
                  ? 'border border-yellow-400/30 bg-yellow-400/15 px-2.5 py-1 font-bold text-yellow-400 rounded-md'
                  : entry.rank === 2
                    ? 'border border-slate-300/30 bg-slate-300/15 px-2.5 py-1 font-bold text-slate-300 rounded-md'
                    : entry.rank === 3
                      ? 'border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 font-bold text-amber-500 rounded-md'
                      : 'font-mono font-medium text-body';
                return (
                  <tr key={entry.strategyVersionId} aria-selected={selected} className={`transition-colors ${selected ? 'border-l-4 border-l-primary bg-primary/15' : 'hover:bg-canvas-dark/70'}`}>
                    <td className="px-4 py-3 whitespace-nowrap"><span className={`font-mono tabular-nums ${rankBadge}`}>#{entry.rank}</span></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        aria-label={`Select ${entry.strategyName}`}
                        className="block max-w-[200px] truncate rounded-md text-left font-semibold text-body underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:max-w-[260px] lg:max-w-[320px]"
                        onClick={() => onSelectStrategy(entry.strategyVersionId, sourceScope)}
                      >
                        {entry.strategyName}
                      </button>
                    </td>
                    {SORTABLE_COLUMNS.map(({ criterion }) => <td key={criterion} className="px-4 py-3 whitespace-nowrap"><FinancialCell entry={entry} criterion={criterion} /></td>)}
                    <td className="px-4 py-3 whitespace-nowrap"><span className="font-mono tabular-nums text-body">{entry.totalTrades}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
