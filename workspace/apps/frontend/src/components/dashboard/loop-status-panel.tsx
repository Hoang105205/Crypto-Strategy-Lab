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
  'min-h-10 rounded-md px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-50';

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

  return (
    <section
      aria-labelledby="loop-status-title"
      className="rounded-xl border border-hairline-dark bg-surface-card p-4 text-body"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="loop-status-title" className="text-lg font-semibold">
            Search Loop
          </h2>
          <p className="mt-1 text-xs text-muted-strong">
            Backend-authoritative orchestration status
          </p>
        </div>
        <span
          role="status"
          className="rounded-md border border-hairline-dark px-2 py-1 text-xs font-semibold"
        >
          {loop?.status ?? 'IDLE'}
        </span>
      </div>

      {isStale && (
        <p className="mt-3 text-sm text-primary">
          Reconnecting — showing the last successful Loop data.
        </p>
      )}
      {lastSuccessfulAt && (
        <p className="mt-1 text-xs text-muted-strong">
          Last updated: {lastSuccessfulAt.toLocaleString()}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-muted-strong">
          The latest Loop status could not be refreshed. Last known data remains visible.
        </p>
      )}

      {loop === null ? (
        <p className="mt-5 text-sm text-muted-strong">
          No active search loop. Start one to generate and evaluate bounded candidates.
        </p>
      ) : (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
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
            <div className="mb-1 flex justify-between text-xs text-muted-strong">
              <span>Progress</span>
              <span className="font-mono">
                {loop.testedCandidates}/{loop.maxCandidates ?? 'unbounded'}
              </span>
            </div>
            <progress
              aria-label="Search Loop progress"
              aria-valuemin={0}
              aria-valuemax={progressMaximum}
              aria-valuenow={progressValue}
              className="h-2 w-full accent-primary"
              max={progressMaximum}
              value={progressValue}
            />
          </div>
        </>
      )}

      {commandFailed && (
        <p role="alert" className="mt-3 text-sm text-muted-strong">
          The command could not be completed. Refresh the authoritative state and retry.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {canStart && (
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void runCommand('start')}
            className={`${BUTTON_CLASS} bg-primary text-black`}
          >
            {pendingAction === 'start' ? 'Starting…' : 'Start Search Loop'}
          </button>
        )}
        {canPause && (
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void runCommand('pause')}
            className={`${BUTTON_CLASS} bg-surface-elevated text-body`}
          >
            {pendingAction === 'pause' ? 'Pausing…' : 'Pause'}
          </button>
        )}
        {canResume && (
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void runCommand('resume')}
            className={`${BUTTON_CLASS} bg-surface-elevated text-body`}
          >
            {pendingAction === 'resume' ? 'Resuming…' : 'Resume'}
          </button>
        )}
        {canStop && (
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void runCommand('stop')}
            className={`${BUTTON_CLASS} border border-hairline-dark bg-transparent text-body`}
          >
            {pendingAction === 'stop' ? 'Stopping…' : 'Stop'}
          </button>
        )}
        {error && (
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void onRefresh()}
            className={`${BUTTON_CLASS} bg-primary text-black`}
          >
            Retry
          </button>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-surface-elevated p-3">
      <dt className="text-xs text-muted-strong">{label}</dt>
      <dd className="mt-1 break-all font-mono text-sm text-body">{value}</dd>
    </div>
  );
}
