'use client';

import { LoopStatus, type SearchLoopRun } from '@crypto-strategy-lab/shared';
import { LoadingState } from '../common/loading-state';

export interface LoopStatusPanelProps {
  loop: SearchLoopRun | null;
  loading?: boolean;
  error?: Error | null;
  isStale?: boolean;
  lastSuccessfulAt?: Date | null;
  isLeaderboardLive: boolean;
  onLeaderboardLiveChange(value: boolean): void;
  onRefresh(): void | Promise<void>;
}

const BUTTON_CLASS =
  'inline-flex h-10 items-center justify-center rounded-md px-6 py-3 text-sm font-semibold transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark';

export function LoopStatusPanel({
  loop,
  loading = false,
  error = null,
  isStale = false,
  lastSuccessfulAt = null,
  isLeaderboardLive,
  onLeaderboardLiveChange,
  onRefresh,
}: LoopStatusPanelProps) {
  if (loading && loop === null) {
    return <LoadingState label="Loading search loop" minHeight={320} />;
  }

  const progressMaximum =
    loop?.maxCandidates ?? Math.max(loop?.testedCandidates ?? 0, 1);
  const progressValue = Math.min(
    loop?.testedCandidates ?? 0,
    progressMaximum,
  );

  const statusBadgeClass =
    loop?.status === LoopStatus.RUNNING
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      : loop?.status === LoopStatus.PAUSED
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        : loop?.status === LoopStatus.FAILED ||
            loop?.status === LoopStatus.STOPPED_BY_USER
          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          : 'bg-surface-elevated text-muted-strong border-hairline-dark/80';

  return (
    <div
      role="region"
      aria-labelledby="loop-status-title"
      className="rounded-xl border border-hairline-dark/80 bg-surface-card p-6 text-body shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="loop-status-title"
            className="text-lg font-semibold tracking-tight"
          >
            Search Loop
          </h2>
          <p className="mt-0.5 text-xs text-muted-strong">
            System-wide search process status
          </p>
        </div>
        <span
          role="status"
          className={`rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ${statusBadgeClass}`}
        >
          {loop?.status ?? 'IDLE'}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-hairline-dark/60 bg-surface-elevated/70 p-4">
        <div>
          <p className="text-sm font-semibold text-body">Live updates</p>
          <p className="mt-0.5 text-xs text-muted-strong">
            Freeze only this leaderboard view. The system loop keeps running.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-label="Live updates"
          aria-checked={isLeaderboardLive}
          onClick={() => onLeaderboardLiveChange(!isLeaderboardLive)}
          className={`min-h-10 min-w-16 rounded-full border px-3 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark ${
            isLeaderboardLive
              ? 'border-primary bg-primary text-black'
              : 'border-hairline-dark bg-canvas-dark text-muted-strong'
          }`}
        >
          {isLeaderboardLive ? 'ON' : 'OFF'}
        </button>
      </div>

      {isStale && (
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-2.5">
          <p className="text-xs font-medium text-primary">
            Reconnecting — showing the last successful Loop data.
          </p>
        </div>
      )}
      {lastSuccessfulAt && (
        <p className="mt-1.5 text-xs text-muted-strong">
          Last updated: {lastSuccessfulAt.toLocaleString()}
        </p>
      )}
      {error && (
        <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5">
          <p role="alert" className="text-xs font-medium text-rose-400">
            The latest Loop status could not be refreshed. Last known data
            remains visible.
          </p>
        </div>
      )}

      {loop === null ? (
        <div className="mt-5 rounded-xl border border-dashed border-hairline-dark/80 bg-surface-elevated/40 p-5 text-center shadow-inner">
          <p className="text-xs font-medium leading-relaxed text-muted-strong">
            No active system search loop. Status updates appear automatically
            when the system starts a run.
          </p>
        </div>
      ) : (
        <>
          <dl className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <Metric label="Iteration" value={loop.iteration} />
            <Metric label="Tested candidates" value={loop.testedCandidates} />
            <Metric
              label="Current candidate"
              value={loop.currentCandidateStrategyVersionId ?? 'None'}
            />
            <Metric
              label="Best score"
              value={loop.bestScore === null ? 'None' : loop.bestScore}
            />
          </dl>
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-muted-strong">
              <span className="font-medium">Progress</span>
              <span className="font-mono tabular-nums">
                {loop.testedCandidates}/{loop.maxCandidates ?? 'unbounded'}
              </span>
            </div>
            <progress
              aria-label="Search Loop progress"
              aria-valuemin={0}
              aria-valuemax={progressMaximum}
              aria-valuenow={progressValue}
              className="h-2 w-full overflow-hidden rounded-full accent-primary"
              max={progressMaximum}
              value={progressValue}
            />
          </div>
        </>
      )}

      {error && (
        <button
          type="button"
          onClick={() => void onRefresh()}
          className={`${BUTTON_CLASS} mt-5 bg-primary text-black hover:bg-primary/90`}
        >
          Retry
        </button>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col justify-between gap-2 rounded-xl border border-hairline-dark/60 bg-surface-elevated/70 p-4 transition-colors hover:border-hairline-dark">
      <dt className="text-xs font-medium uppercase tracking-wider text-[#707a8a]">
        {label}
      </dt>
      <dd className="break-all font-mono text-sm font-bold tabular-nums text-[#eaecef]">
        {value}
      </dd>
    </div>
  );
}
