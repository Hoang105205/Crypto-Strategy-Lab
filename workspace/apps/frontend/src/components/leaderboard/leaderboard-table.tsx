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
    <section aria-labelledby="leaderboard-heading" className="min-w-0 rounded-lg border border-hairline-dark bg-surface-card">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline-dark px-4 py-3">
        <div>
          <h1 id="leaderboard-heading" className="text-lg font-semibold text-body">Strategy Leaderboard</h1>
          <p className="mt-1 text-xs text-muted">Last updated: {snapshot.updatedAt.toLocaleString()}</p>
        </div>
        <label className="text-sm text-muted">
          Ranking criterion
          <select
            aria-label="Ranking criterion"
            className="ml-2 rounded border border-hairline-dark bg-canvas-dark px-2 py-1 text-body outline-none focus-visible:ring-2 focus-visible:ring-primary"
            value={sortBy}
            onChange={(event) => onSortByChange(event.target.value as RankingCriterion)}
          >
            {SORTABLE_COLUMNS.map(({ criterion, label }) => <option key={criterion} value={criterion}>{label}</option>)}
          </select>
        </label>
      </div>

      <div data-testid="leaderboard-scroll" className="overflow-x-auto">
        <table aria-label="Strategy leaderboard" className="min-w-[760px] w-full border-collapse text-left text-sm">
          <thead className="bg-canvas-dark text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-3" scope="col">Rank</th>
              <th className="px-3 py-3" scope="col">Strategy</th>
              {SORTABLE_COLUMNS.map(({ criterion, label }) => (
                <th key={criterion} aria-sort={criterion === sortBy ? 'descending' : 'none'} className="px-3 py-3" scope="col">
                  <button
                    type="button"
                    className="rounded outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={() => onSortByChange(criterion)}
                    aria-label={`Sort by ${label}`}
                  >
                    {label} {criterion === sortBy ? <span aria-hidden="true">↓</span> : null}
                  </button>
                </th>
              ))}
              <th className="px-3 py-3" scope="col">Trades</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.entries.map((entry) => {
              const selected = entry.strategyVersionId === selectedStrategyVersionId;
              return (
                <tr key={entry.strategyVersionId} aria-selected={selected} className={`border-t border-hairline-dark ${selected ? 'bg-primary/10' : 'hover:bg-canvas-dark/70'}`}>
                  <td className="px-3 py-3 font-mono tabular-nums text-body">#{entry.rank}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      aria-label={`Select ${entry.strategyName}`}
                      className="rounded font-medium text-body underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={() => onSelectStrategy(entry.strategyVersionId)}
                    >
                      {entry.strategyName}
                    </button>
                  </td>
                  {SORTABLE_COLUMNS.map(({ criterion }) => <td key={criterion} className="px-3 py-3 text-body"><FinancialCell entry={entry} criterion={criterion} /></td>)}
                  <td className="px-3 py-3 font-mono tabular-nums text-body">{entry.totalTrades}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
