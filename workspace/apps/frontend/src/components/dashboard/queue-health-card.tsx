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

  const redisBadgeClass = stats?.redisConnected
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    : 'bg-rose-500/10 text-rose-400 border-rose-500/30';

  return (
    <div
      role="region"
      aria-label="Queue health"
      className="rounded-2xl border border-hairline-dark/80 bg-surface-card p-6 text-body shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Queue Health</h2>
          <p className="mt-0.5 text-xs text-muted-strong font-medium">BullMQ and Redis snapshot</p>
        </div>
        {stats && (
          <span
            role="status"
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide ${redisBadgeClass}`}
          >
            Redis {stats.redisConnected ? 'connected' : 'disconnected'}
          </span>
        )}
      </div>

      {isStale && (
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-2.5">
          <p className="text-xs font-medium text-primary">
            Disconnected — showing the last successful queue data.
          </p>
        </div>
      )}
      {lastSuccessfulAt && (
        <p className="mt-1.5 text-xs text-muted-strong">
          Last updated: {lastSuccessfulAt.toLocaleString()}
        </p>
      )}

      {stats ? (
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {QUEUE_METRICS.map(([field, label]) => (
            <div key={field} className="p-4 bg-surface-elevated-dark rounded-lg flex flex-col gap-2">
              <dt className="text-xs font-medium uppercase tracking-wider text-[#707a8a]">{label}</dt>
              <dd className="font-mono tabular-nums text-lg font-bold text-[#eaecef]">{stats[field]}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-hairline-dark p-4 text-center">
          <p className="text-sm text-muted-strong">
            Queue health is temporarily unavailable.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
          <p role="alert" className="text-xs font-medium text-rose-400">
            Queue status could not be refreshed. Last known data remains visible.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 min-h-10 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark shadow-sm"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
