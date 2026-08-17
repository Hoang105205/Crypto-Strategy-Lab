'use client';

import { useRef, useState } from 'react';
import { LoopStatus, type SearchLoopRun } from '@crypto-strategy-lab/shared';
import type {
  LoopCommandResponse,
  StartLoopRequest,
} from '../../services/api-client';
import { LoadingState } from '../common/loading-state';

export interface LoopCommandApi {
  startLoop(input: StartLoopRequest): Promise<LoopCommandResponse>;
  pauseLoop(loopRunId: string): Promise<LoopCommandResponse>;
  resumeLoop(loopRunId: string): Promise<LoopCommandResponse>;
  stopLoop(loopRunId: string): Promise<LoopCommandResponse>;
}

export interface LoopStatusPanelProps {
  loop: SearchLoopRun | null;
  loading?: boolean;
  error?: Error | null;
  isStale?: boolean;
  lastSuccessfulAt?: Date | null;
  startRequest: StartLoopRequest;
  api: LoopCommandApi;
  onRefresh(): void | Promise<void>;
}

type LoopAction = 'start' | 'pause' | 'resume' | 'stop';

const BUTTON_CLASS =
  'inline-flex h-10 items-center justify-center rounded-md px-6 py-3 text-sm font-semibold transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none shadow-sm';

export function LoopStatusPanel({
  loop,
  loading = false,
  error = null,
  isStale = false,
  lastSuccessfulAt = null,
  startRequest,
  api,
  onRefresh,
}: LoopStatusPanelProps) {
  const [pendingAction, setPendingAction] = useState<LoopAction | null>(null);
  const [commandFailed, setCommandFailed] = useState(false);
  const pendingRef = useRef(false);

  const runCommand = async (action: LoopAction) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPendingAction(action);
    setCommandFailed(false);

    try {
      if (action === 'start') await api.startLoop(startRequest);
      if (action === 'pause' && loop !== null) await api.pauseLoop(loop.id);
      if (action === 'resume' && loop !== null) await api.resumeLoop(loop.id);
      if (action === 'stop' && loop !== null) await api.stopLoop(loop.id);
      await onRefresh();
    } catch {
      setCommandFailed(true);
    } finally {
      pendingRef.current = false;
      setPendingAction(null);
    }
  };

  if (loading && loop === null) {
    return <LoadingState label="Loading search loop" minHeight={320} />;
  }

  const canStart =
    loop === null ||
    loop.status === LoopStatus.COMPLETED ||
    loop.status === LoopStatus.STOPPED_BY_USER ||
    loop.status === LoopStatus.FAILED;
  const canPause = loop?.status === LoopStatus.RUNNING;
  const canResume = loop?.status === LoopStatus.PAUSED;
  const canStop = canPause || canResume;
  const progressMaximum = loop?.maxCandidates ?? Math.max(loop?.testedCandidates ?? 0, 1);
  const progressValue = Math.min(loop?.testedCandidates ?? 0, progressMaximum);

  const statusBadgeClass =
    loop?.status === LoopStatus.RUNNING
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      : loop?.status === LoopStatus.PAUSED
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        : loop?.status === LoopStatus.FAILED || loop?.status === LoopStatus.STOPPED_BY_USER
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
          <h2 id="loop-status-title" className="text-lg font-semibold tracking-tight">
            Search Loop
          </h2>
          <p className="mt-0.5 text-xs text-muted-strong">
            Backend-authoritative orchestration status
          </p>
        </div>
        <span
          role="status"
          className={`rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ${statusBadgeClass}`}
        >
          {loop?.status ?? 'IDLE'}
        </span>
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
            The latest Loop status could not be refreshed. Last known data remains visible.
          </p>
        </div>
      )}

      {loop === null ? (
        <div className="mt-5 rounded-xl border border-dashed border-hairline-dark/80 bg-surface-elevated/40 p-5 text-center shadow-inner">
          <p className="text-xs text-muted-strong leading-relaxed font-medium">
            No active search loop. Start one to generate and evaluate bounded candidates.
          </p>
        </div>
      ) : (
        <>
          <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
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

      {commandFailed && (
        <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5">
          <p role="alert" className="text-xs font-medium text-rose-300">
            The command could not be completed. Refresh the authoritative state and retry.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2.5">
        {canStart && (
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void runCommand('start')}
            className="px-6 py-3 bg-[#FCD535] text-[#181a20] font-semibold rounded-md h-10 hover:bg-[#f0b90b] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
          >
            {pendingAction === 'start' ? 'Starting…' : 'Start Search Loop'}
          </button>
        )}
        {canPause && (
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void runCommand('pause')}
            className={`${BUTTON_CLASS} bg-surface-elevated border border-hairline-dark text-body hover:border-muted-strong`}
          >
            {pendingAction === 'pause' ? 'Pausing…' : 'Pause'}
          </button>
        )}
        {canResume && (
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void runCommand('resume')}
            className={`${BUTTON_CLASS} bg-surface-elevated border border-hairline-dark text-body hover:border-muted-strong`}
          >
            {pendingAction === 'resume' ? 'Resuming…' : 'Resume'}
          </button>
        )}
        {canStop && (
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void runCommand('stop')}
            className={`${BUTTON_CLASS} border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20`}
          >
            {pendingAction === 'stop' ? 'Stopping…' : 'Stop'}
          </button>
        )}
        {error && (
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void onRefresh()}
            className={`${BUTTON_CLASS} bg-[#FCD535] text-[#181a20] font-semibold hover:bg-[#f0b90b]`}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-hairline-dark/60 bg-surface-elevated/70 p-4 flex flex-col justify-between gap-2 transition-colors hover:border-hairline-dark">
      <dt className="text-xs font-medium uppercase tracking-wider text-[#707a8a]">{label}</dt>
      <dd className="break-all font-mono tabular-nums text-sm font-bold text-[#eaecef]">{value}</dd>
    </div>
  );
}
