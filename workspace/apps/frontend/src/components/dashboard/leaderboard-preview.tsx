import Link from 'next/link';
import type { LeaderboardSnapshot } from '@crypto-strategy-lab/shared';
import { LoadingState } from '../common/loading-state';

export interface LeaderboardPreviewProps {
  snapshot: LeaderboardSnapshot | null;
  loading?: boolean;
  error?: Error | null;
  isStale?: boolean;
  lastSuccessfulAt?: Date | null;
  selectedStrategyVersionId?: string | null;
  onSelectStrategy?(strategyVersionId: string): void;
  onRetry(): void;
}

const LINK_CLASS =
  'rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark transition-all';

export function LeaderboardPreview({
  snapshot,
  loading = false,
  error = null,
  isStale = false,
  lastSuccessfulAt = null,
  selectedStrategyVersionId = null,
  onSelectStrategy,
  onRetry,
}: LeaderboardPreviewProps) {
  if (loading && snapshot === null) {
    return <LoadingState label="Loading leaderboard preview" minHeight={360} />;
  }

  if (error && snapshot === null) {
    return (
      <section
        aria-label="Leaderboard preview"
        className="rounded-xl border border-hairline-dark/80 bg-surface-card p-5 text-body shadow-sm"
      >
        <h2 className="text-lg font-semibold tracking-tight">Leaderboard</h2>
        <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
          <p role="alert" className="text-xs font-medium text-rose-400">
            Leaderboard data is temporarily unavailable.
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-10 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark shadow-sm"
        >
          Retry
        </button>
      </section>
    );
  }

  if (snapshot?.entries.length === 0) {
    return (
      <section
        aria-label="Leaderboard preview"
        className="rounded-xl border border-hairline-dark/80 bg-surface-card p-5 text-body shadow-sm"
      >
        <h2 className="text-lg font-semibold tracking-tight">Leaderboard</h2>
        <p className="mt-3 text-sm text-muted-strong">
          No leaderboard entries are available yet.
        </p>
        <Link
          href="/strategy"
          className={`mt-4 inline-flex min-h-10 items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black hover:bg-primary/90 ${LINK_CLASS}`}
        >
          Submit a backtest
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-label="Leaderboard preview"
      className="rounded-2xl border border-hairline-dark/80 bg-surface-card p-6 md:p-7 text-body shadow-md"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">Leaderboard</h2>
        <Link href="/leaderboard" className={`text-xs font-semibold text-primary hover:underline ${LINK_CLASS}`}>
          View full leaderboard
        </Link>
      </div>

      {isStale && (
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-2.5">
          <p className="text-xs font-medium text-primary">
            Reconnecting — showing the last successful ranking.
          </p>
        </div>
      )}
      {lastSuccessfulAt && (
        <p className="mt-1.5 text-xs font-medium text-muted-strong">
          Last updated: {lastSuccessfulAt.toLocaleString()}
        </p>
      )}
      {error && (
        <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5">
          <p role="alert" className="text-xs font-medium text-rose-400">
            The latest ranking could not be refreshed.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-black transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Retry
          </button>
        </div>
      )}

      {snapshot ? (
        <ul aria-label="Leaderboard preview" className="mt-4 space-y-2">
          {snapshot.entries.slice(0, 5).map((entry) => {
            const selected = entry.strategyVersionId === selectedStrategyVersionId;
            const returnClass =
              entry.totalReturn > 0
                ? 'text-trading-up font-semibold'
                : entry.totalReturn < 0
                  ? 'text-trading-down font-semibold'
                  : 'text-body';

            const rankBadgeClass =
              entry.rank === 1
                ? 'text-yellow-400 font-bold bg-yellow-400/10 rounded px-1'
                : entry.rank === 2
                  ? 'text-slate-300 font-bold bg-slate-300/10 rounded px-1'
                  : entry.rank === 3
                    ? 'text-amber-500 font-bold bg-amber-500/10 rounded px-1'
                    : 'text-muted-strong';

            return (
              <li
                key={entry.backtestResultId}
                className={`grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-xl p-3 transition-colors border border-transparent ${
                  selected
                    ? 'bg-surface-elevated border-l-4 border-l-primary'
                    : 'hover:bg-surface-elevated/60 hover:border-hairline-dark/40'
                }`}
              >
                <span
                  className={`font-mono tabular-nums text-sm text-center ${rankBadgeClass}`}
                >
                  {entry.rank}
                </span>
                <Link
                  href={`/leaderboard?strategyVersionId=${encodeURIComponent(entry.strategyVersionId)}`}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => onSelectStrategy?.(entry.strategyVersionId)}
                  className={`min-w-0 ${LINK_CLASS}`}
                >
                  <span className="block truncate max-w-[140px] sm:max-w-[200px] text-sm font-semibold text-body">
                    {entry.strategyName}
                  </span>
                  <span className="block truncate max-w-[140px] sm:max-w-[200px] text-xs text-muted-strong font-medium">
                    {entry.strategyType}
                  </span>
                </Link>
                <div className="text-right font-mono tabular-nums text-xs">
                  <div className="text-body font-semibold">{entry.score.toFixed(4)}</div>
                  <div className={returnClass}>
                    {entry.totalReturn > 0 ? '+' : ''}{entry.totalReturn.toFixed(2)}%
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-strong">No leaderboard snapshot.</p>
      )}
    </section>
  );
}
