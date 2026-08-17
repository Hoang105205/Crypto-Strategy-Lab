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
  'rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info';

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
        className="rounded-xl border border-hairline-dark bg-surface-card p-4 text-body"
      >
        <h2 className="text-lg font-semibold">Leaderboard</h2>
        <p role="alert" className="mt-3 text-sm text-muted-strong">
          Leaderboard data is temporarily unavailable.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-10 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
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
        className="rounded-xl border border-hairline-dark bg-surface-card p-4 text-body"
      >
        <h2 className="text-lg font-semibold">Leaderboard</h2>
        <p className="mt-3 text-sm text-muted-strong">
          No leaderboard entries are available yet.
        </p>
        <Link
          href="/strategy"
          className={`mt-4 inline-flex min-h-10 items-center bg-primary px-4 py-2 text-sm font-semibold text-black ${LINK_CLASS}`}
        >
          Submit a backtest
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-label="Leaderboard preview"
      className="rounded-xl border border-hairline-dark bg-surface-card p-4 text-body"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Leaderboard</h2>
        <Link href="/leaderboard" className={`text-sm text-primary ${LINK_CLASS}`}>
          View full leaderboard
        </Link>
      </div>

      {isStale && (
        <p className="mt-3 text-sm text-primary">
          Reconnecting — showing the last successful ranking.
        </p>
      )}
      {lastSuccessfulAt && (
        <p className="mt-1 text-xs text-muted-strong">
          Last updated: {lastSuccessfulAt.toLocaleString()}
        </p>
      )}
      {error && (
        <div className="mt-3">
          <p role="alert" className="text-sm text-muted-strong">
            The latest ranking could not be refreshed.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
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
                ? 'text-trading-up'
                : entry.totalReturn < 0
                  ? 'text-trading-down'
                  : 'text-body';

            return (
              <li
                key={entry.backtestResultId}
                className={`grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-lg p-2 ${
                  selected ? 'bg-surface-elevated' : ''
                }`}
              >
                <span
                  className={`font-mono text-sm ${entry.rank <= 3 ? 'text-primary' : 'text-muted-strong'}`}
                >
                  {entry.rank}
                </span>
                <Link
                  href={`/leaderboard?strategyVersionId=${encodeURIComponent(entry.strategyVersionId)}`}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => onSelectStrategy?.(entry.strategyVersionId)}
                  className={`min-w-0 ${LINK_CLASS}`}
                >
                  <span className="block truncate text-sm text-body">
                    {entry.strategyName}
                  </span>
                  <span className="block truncate text-xs text-muted-strong">
                    {entry.strategyType}
                  </span>
                </Link>
                <div className="text-right font-mono text-xs">
                  <div className="text-body">{entry.score.toFixed(4)}</div>
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
