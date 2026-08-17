'use client';

import { useEffect, useState } from 'react';
import { ApiClientError, apiClient, type LeaderboardDetail as LeaderboardDetailData } from '../../services/api-client';

interface LeaderboardDetailProps {
  strategyVersionId: string | null;
}

type DetailState =
  | { status: 'empty' }
  | { status: 'loading'; strategyVersionId: string }
  | { status: 'success'; strategyVersionId: string; detail: LeaderboardDetailData }
  | { status: 'not-found'; strategyVersionId: string }
  | { status: 'error'; strategyVersionId: string };

function formatPercent(value: number, showPositiveSign = false, normalized = false): string {
  const percent = normalized ? value * 100 : value;
  return `${showPositiveSign && percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
}

export function LeaderboardDetail({ strategyVersionId }: LeaderboardDetailProps) {
  const [retryGeneration, setRetryGeneration] = useState(0);
  const [state, setState] = useState<DetailState>(strategyVersionId ? { status: 'loading', strategyVersionId } : { status: 'empty' });

  useEffect(() => {
    if (!strategyVersionId) return;

    let active = true;
    void apiClient.getLeaderboardDetail(strategyVersionId).then((detail) => {
      if (active) setState({ status: 'success', strategyVersionId, detail });
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof ApiClientError && error.status === 404) {
        setState({ status: 'not-found', strategyVersionId });
        return;
      }
      setState({ status: 'error', strategyVersionId });
    });

    return () => { active = false; };
  }, [strategyVersionId, retryGeneration]);

  if (!strategyVersionId) {
    return <aside className="rounded-lg border border-hairline-dark bg-surface-card p-6 text-sm text-muted">Select a strategy to inspect its immutable version and published trades.</aside>;
  }
  if (state.status === 'empty' || state.strategyVersionId !== strategyVersionId || state.status === 'loading') {
    return (
      <aside role="status" aria-label="Loading strategy detail" style={{ minHeight: 320 }} className="min-h-[320px] animate-pulse rounded-lg border border-hairline-dark bg-surface-card p-6">
        <span className="sr-only">Loading strategy detail</span><div className="h-6 w-2/3 rounded bg-surface-elevated" /><div className="mt-5 h-32 rounded bg-surface-elevated/70" />
      </aside>
    );
  }
  if (state.status === 'not-found') {
    return <aside role="status" className="rounded-lg border border-hairline-dark bg-surface-card p-6 text-muted">Strategy version not found.</aside>;
  }
  if (state.status === 'error') {
    return (
      <aside role="alert" className="rounded-lg border border-hairline-dark bg-surface-card p-6">
        <p className="text-sm text-body">Strategy detail is temporarily unavailable.</p>
        <button type="button" className="mt-4 rounded bg-primary px-3 py-2 text-sm font-medium text-canvas-dark outline-none focus-visible:ring-2 focus-visible:ring-white" onClick={() => { setState({ status: 'loading', strategyVersionId }); setRetryGeneration((value) => value + 1); }}>Retry</button>
      </aside>
    );
  }

  const { strategyVersion, trades } = state.detail;
  return (
    <aside aria-labelledby="strategy-detail-heading" className="rounded-lg border border-hairline-dark bg-surface-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">Immutable strategy version</p>
      <h2 id="strategy-detail-heading" className="mt-1 text-xl font-semibold text-body">{strategyVersion.name}</h2>
      <p className="mt-1 text-sm text-muted">Version {strategyVersion.version} · {strategyVersion.strategyType}</p>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-muted">Score</dt><dd className="font-mono tabular-nums text-body">{state.detail.score.toFixed(4)}</dd></div>
        <div><dt className="text-muted">Return</dt><dd className="font-mono tabular-nums text-body">{formatPercent(state.detail.totalReturn, true)}</dd></div>
        <div><dt className="text-muted">Win rate</dt><dd className="font-mono tabular-nums text-body">{formatPercent(state.detail.winRate, false, true)}</dd></div>
        <div><dt className="text-muted">Max drawdown</dt><dd className="font-mono tabular-nums text-body">{formatPercent(state.detail.maxDrawdown)}</dd></div>
        <div><dt className="text-muted">Sharpe</dt><dd className="font-mono tabular-nums text-body">{state.detail.sharpeRatio.toFixed(2)}</dd></div>
        <div><dt className="text-muted">Trades</dt><dd className="font-mono tabular-nums text-body">{state.detail.totalTrades}</dd></div>
      </dl>
      <h3 className="mt-6 font-semibold text-body">Parameters</h3>
      <dl className="mt-2 space-y-2 text-sm">
        {Object.entries(strategyVersion.parameters).map(([name, value]) => (
          <div key={name} className="flex justify-between gap-4 border-b border-hairline-dark/70 pb-2"><dt className="text-muted">{name}</dt><dd className="font-mono text-body">{String(value)}</dd></div>
        ))}
      </dl>
      <h3 className="mt-6 font-semibold text-body">Published trades</h3>
      {trades.length === 0 ? <p className="mt-2 text-sm text-muted">No published trades for this version.</p> : (
        <div className="mt-2 overflow-x-auto">
          <table aria-label="Published trades" className="min-w-[560px] w-full text-left text-xs">
            <thead className="text-muted"><tr><th className="py-2">Side</th><th>Entry</th><th>Exit</th><th>Quantity</th><th>P&amp;L</th></tr></thead>
            <tbody>{trades.map((trade) => (
              <tr key={`${trade.entryDate.toISOString()}-${trade.exitDate.toISOString()}`} className="border-t border-hairline-dark"><td className="py-2 text-body">{trade.side}</td><td className="font-mono tabular-nums text-body">{trade.entryPrice.toFixed(2)}</td><td className="font-mono tabular-nums text-body">{trade.exitPrice.toFixed(2)}</td><td className="font-mono tabular-nums text-body">{trade.quantity}</td><td className="font-mono tabular-nums text-body">{`${trade.pnl > 0 ? '+' : ''}${trade.pnl.toFixed(2)}`}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </aside>
  );
}
