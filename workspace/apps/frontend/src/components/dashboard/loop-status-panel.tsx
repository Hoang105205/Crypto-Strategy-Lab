"use client";

import { LoopStatus, type SearchLoopRun } from "@crypto-strategy-lab/shared";
import { LoadingState } from "../common/loading-state";

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
  "inline-flex h-10 items-center justify-center rounded-md px-6 py-3 text-sm font-semibold transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark";

export function LoopStatusPanel({
  loop,
  loading = false,
  error = null,
  lastSuccessfulAt = null,
  isLeaderboardLive,
  onLeaderboardLiveChange,
  onRefresh,
}: LoopStatusPanelProps) {
  if (loading && loop === null) {
    return <LoadingState label="Loading search loop" minHeight={320} />;
  }

  const statusBadgeClass =
    loop?.status === LoopStatus.RUNNING
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : loop?.status === LoopStatus.PAUSED
        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
        : loop?.status === LoopStatus.FAILED ||
            loop?.status === LoopStatus.STOPPED_BY_USER
          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
          : "bg-surface-elevated text-muted-strong border-hairline-dark/80";

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
          {loop?.status ?? "IDLE"}
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
          title={
            isLeaderboardLive
              ? "Click to freeze leaderboard updates"
              : "Click to resume leaderboard updates"
          }
          className={`min-h-10 min-w-20 cursor-pointer rounded-full border px-3 py-2 text-xs font-bold transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_0_0_3px_rgba(252,213,53,0.12)] active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark ${
            isLeaderboardLive
              ? "border-primary bg-primary text-black"
              : "border-hairline-dark bg-canvas-dark text-muted-strong"
          }`}
        >
          <span aria-hidden="true" className="mr-1">
            {isLeaderboardLive ? "●" : "○"}
          </span>
          {isLeaderboardLive ? "ON" : "OFF"}
        </button>
      </div>

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
      ) : null}

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
