'use client';

import { RankingCriterion, type LeaderboardEntryPayload, type LeaderboardSnapshot } from '@crypto-strategy-lab/shared';

interface LeaderboardTableProps {
  snapshot: LeaderboardSnapshot;
  sortBy: RankingCriterion;
  selectedStrategyVersionId: string | null;
  onSortByChange: (criterion: RankingCriterion) => void;
  onSelectStrategy: (strategyVersionId: string) => void;
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

export function LeaderboardTable({ snapshot, sortBy, selectedStrategyVersionId, onSortByChange, onSelectStrategy }: LeaderboardTableProps) {
  return (
    <section aria-labelledby="leaderboard-heading" className="min-w-0 overflow-hidden rounded-xl border border-hairline-dark/80 bg-surface-card shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline-dark/80 px-6 py-5">
        <div>
          <h1 id="leaderboard-heading" className="text-2xl font-bold tracking-tight text-body">Strategy Leaderboard</h1>
          <p className="mt-1 text-xs font-medium text-muted">Last updated: {snapshot.updatedAt.toLocaleString()}</p>
        </div>
        <label className="flex items-center gap-2.5 text-sm font-medium text-muted">
          <span>Ranking criterion</span>
          <select
            aria-label="Ranking criterion"
            className="rounded-xl border border-hairline-dark/80 bg-canvas-dark px-3.5 py-2 text-sm font-medium text-body cursor-pointer transition-colors hover:border-muted-strong outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary shadow-sm"
            value={sortBy}
            onChange={(event) => onSortByChange(event.target.value as RankingCriterion)}
          >
            {SORTABLE_COLUMNS.map(({ criterion, label }) => <option key={criterion} value={criterion}>{label}</option>)}
          </select>
        </label>
      </div>

      <div data-testid="leaderboard-scroll" className="max-h-[680px] overflow-x-auto overflow-y-auto">
        <table aria-label="Strategy leaderboard" className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-canvas-dark/95 backdrop-blur-sm text-xs font-bold uppercase tracking-wider text-muted-strong border-b border-hairline-dark/80">
            <tr>
              <th className="px-4 py-3 text-left text-muted font-normal whitespace-nowrap" scope="col">Rank</th>
              <th className="px-4 py-3 text-left text-muted font-normal whitespace-nowrap" scope="col">Strategy</th>
              {SORTABLE_COLUMNS.map(({ criterion, label }) => (
                <th key={criterion} aria-sort={criterion === sortBy ? 'descending' : 'none'} className="px-4 py-3 text-left text-muted font-normal whitespace-nowrap" scope="col">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-bold transition-colors hover:text-primary hover:bg-surface-elevated/50 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={() => onSortByChange(criterion)}
                    aria-label={`Sort by ${label}`}
                  >
                    {label} {criterion === sortBy ? <span aria-hidden="true" className="text-primary font-extrabold">↓</span> : null}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-muted font-normal whitespace-nowrap" scope="col">Trades</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline-dark/60">
            {snapshot.entries.map((entry) => {
              const selected = entry.strategyVersionId === selectedStrategyVersionId;
              const rankBadge =
                entry.rank === 1
                  ? 'text-yellow-400 font-bold bg-yellow-400/15 px-2.5 py-1 rounded-md border border-yellow-400/30'
                  : entry.rank === 2
                    ? 'text-slate-300 font-bold bg-slate-300/15 px-2.5 py-1 rounded-md border border-slate-300/30'
                    : entry.rank === 3
                      ? 'text-amber-500 font-bold bg-amber-500/15 px-2.5 py-1 rounded-md border border-amber-500/30'
                      : 'text-body font-mono font-medium';

              return (
                <tr key={entry.strategyVersionId} aria-selected={selected} className={`transition-colors ${selected ? 'bg-primary/15 border-l-4 border-l-primary' : 'hover:bg-canvas-dark/70'}`}>
                  <td className="px-4 py-3 whitespace-nowrap"><span className={`font-mono tabular-nums ${rankBadge}`}>#{entry.rank}</span></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      type="button"
                      aria-label={`Select ${entry.strategyName}`}
                      className="rounded-md font-semibold text-body underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-left max-w-[200px] sm:max-w-[260px] lg:max-w-[320px] truncate block"
                      onClick={() => onSelectStrategy(entry.strategyVersionId)}
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
    </section>
  );
}
