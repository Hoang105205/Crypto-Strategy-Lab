import type { QueueStats } from '@crypto-strategy-lab/shared';
import { LoadingState } from '../common/loading-state';

export interface QueueHealthCardProps {
  stats: QueueStats | null;
  loading?: boolean;
  error?: Error | null;
  isStale?: boolean;
  lastSuccessfulAt?: Date | null;
  onRetry(): void;
}

const QUEUE_METRICS: ReadonlyArray<[keyof Omit<QueueStats, 'redisConnected'>, string]> = [
  ['queued', 'Queued'],
  ['processing', 'Processing'],
  ['completedLast24h', 'Completed last 24h'],
  ['deadLettered', 'Dead-lettered'],
  ['delayed', 'Delayed'],
];

export function QueueHealthCard({
  stats,
  loading = false,
  error = null,
  isStale = false,
  lastSuccessfulAt = null,
  onRetry,
}: QueueHealthCardProps) {
  if (loading && stats === null) {
    return <LoadingState label="Loading queue health" minHeight={300} />;
  }

  return (
    <section
      aria-label="Queue health"
      className="rounded-xl border border-hairline-dark bg-surface-card p-4 text-body"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Queue Health</h2>
          <p className="mt-1 text-xs text-muted-strong">BullMQ and Redis snapshot</p>
        </div>
        {stats && (
          <span
            role="status"
            className="rounded-md border border-hairline-dark px-2 py-1 text-xs font-semibold"
          >
            Redis {stats.redisConnected ? 'connected' : 'disconnected'}
          </span>
        )}
      </div>

      {isStale && (
        <p className="mt-3 text-sm text-primary">
          Disconnected — showing the last successful queue data.
        </p>
      )}
      {lastSuccessfulAt && (
        <p className="mt-1 text-xs text-muted-strong">
          Last updated: {lastSuccessfulAt.toLocaleString()}
        </p>
      )}

      {stats ? (
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {QUEUE_METRICS.map(([field, label]) => (
            <div key={field} className="rounded-lg bg-surface-elevated p-3">
              <dt className="text-xs text-muted-strong">{label}</dt>
              <dd className="mt-1 font-mono text-lg text-body">{stats[field]}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-4 text-sm text-muted-strong">
          Queue health is temporarily unavailable.
        </p>
      )}

      {error && (
        <div className="mt-4">
          <p role="alert" className="text-sm text-muted-strong">
            Queue status could not be refreshed. Last known data remains visible.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 min-h-10 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
          >
            Retry
          </button>
        </div>
      )}
    </section>
  );
}
