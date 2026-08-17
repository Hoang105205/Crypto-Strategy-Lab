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
    return <aside className="rounded-xl border border-dashed border-hairline-dark bg-surface-card p-6 text-sm text-muted text-center shadow-sm">Select a strategy to inspect its immutable version and published trades.</aside>;
  }
  if (state.status === 'empty' || state.strategyVersionId !== strategyVersionId || state.status === 'loading') {
    return (
      <aside role="status" aria-label="Loading strategy detail" style={{ minHeight: 320 }} className="min-h-[320px] animate-pulse rounded-xl border border-hairline-dark/60 bg-surface-card p-6 shadow-sm">
        <span className="sr-only">Loading strategy detail</span>
        <div className="h-4 w-1/3 rounded bg-surface-elevated/90" />
        <div className="mt-2 h-7 w-2/3 rounded bg-surface-elevated/90" />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="h-16 rounded-lg bg-surface-elevated/70" />
          <div className="h-16 rounded-lg bg-surface-elevated/70" />
          <div className="h-16 rounded-lg bg-surface-elevated/70" />
          <div className="h-16 rounded-lg bg-surface-elevated/70" />
        </div>
      </aside>
    );
  }
  if (state.status === 'not-found') {
    return <aside role="status" className="rounded-xl border border-rose-500/30 bg-surface-card p-6 text-sm text-muted shadow-sm">Strategy version not found.</aside>;
  }
  if (state.status === 'error') {
    return (
      <aside role="alert" className="rounded-xl border border-rose-500/30 bg-surface-card p-6 shadow-sm">
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
          <p className="text-xs font-medium text-rose-400">Strategy detail is temporarily unavailable.</p>
        </div>
        <button type="button" className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark shadow-sm" onClick={() => { setState({ status: 'loading', strategyVersionId }); setRetryGeneration((value) => value + 1); }}>Retry</button>
      </aside>
    );
  }

  const { strategyVersion, trades } = state.detail;
  return (
    <aside aria-labelledby="strategy-detail-heading" className="rounded-2xl border border-hairline-dark/80 bg-surface-card p-6 flex flex-col gap-6 shadow-md h-full">
      <div className="inline-block self-start rounded bg-[#FCD535] text-[#181a20] px-2 py-1 text-xs font-bold shadow-sm">
        Immutable strategy version
      </div>
      <h2 id="strategy-detail-heading" title={strategyVersion.name} className="mt-3 text-xl font-bold tracking-tight text-[#eaecef] leading-snug truncate max-w-full">{strategyVersion.name}</h2>
      <p className="mt-1 text-xs font-medium text-[#707a8a]">Version {strategyVersion.version} · {strategyVersion.strategyType}</p>

      <dl className="mt-6 grid grid-cols-2 gap-3.5 text-sm">
        <div className="rounded-xl border border-hairline-dark/70 bg-surface-elevated/70 p-4 flex flex-col justify-between gap-2"><dt className="text-xs font-medium text-[#707a8a] uppercase tracking-wider">Score</dt><dd className="font-mono text-base font-bold tabular-nums text-[#eaecef]">{state.detail.score.toFixed(4)}</dd></div>
        <div className="rounded-xl border border-hairline-dark/70 bg-surface-elevated/70 p-4 flex flex-col justify-between gap-2"><dt className="text-xs font-medium text-[#707a8a] uppercase tracking-wider">Return</dt><dd className={`font-mono text-base font-bold tabular-nums ${state.detail.totalReturn > 0 ? 'text-trading-up' : state.detail.totalReturn < 0 ? 'text-trading-down' : 'text-[#eaecef]'}`}>{formatPercent(state.detail.totalReturn, true)}</dd></div>
        <div className="rounded-xl border border-hairline-dark/70 bg-surface-elevated/70 p-4 flex flex-col justify-between gap-2"><dt className="text-xs font-medium text-[#707a8a] uppercase tracking-wider">Win rate</dt><dd className="font-mono text-base font-bold tabular-nums text-[#eaecef]">{formatPercent(state.detail.winRate, false, true)}</dd></div>
        <div className="rounded-xl border border-hairline-dark/70 bg-surface-elevated/70 p-4 flex flex-col justify-between gap-2"><dt className="text-xs font-medium text-[#707a8a] uppercase tracking-wider">Max drawdown</dt><dd className="font-mono text-base font-bold tabular-nums text-[#eaecef]">{formatPercent(state.detail.maxDrawdown)}</dd></div>
        <div className="rounded-xl border border-hairline-dark/70 bg-surface-elevated/70 p-4 flex flex-col justify-between gap-2"><dt className="text-xs font-medium text-[#707a8a] uppercase tracking-wider">Sharpe</dt><dd className="font-mono text-base font-bold tabular-nums text-[#eaecef]">{state.detail.sharpeRatio.toFixed(2)}</dd></div>
        <div className="rounded-xl border border-hairline-dark/70 bg-surface-elevated/70 p-4 flex flex-col justify-between gap-2"><dt className="text-xs font-medium text-[#707a8a] uppercase tracking-wider">Trades</dt><dd className="font-mono text-base font-bold tabular-nums text-[#eaecef]">{state.detail.totalTrades}</dd></div>
      </dl>

      <h3 className="mt-7 text-sm font-bold tracking-tight text-[#eaecef]">Parameters</h3>
      <dl className="divide-y divide-hairline-dark/60 rounded-xl border border-hairline-dark/70 bg-surface-elevated/40 p-4 text-xs space-y-0">
        {Object.entries(strategyVersion.parameters).map(([name, value]) => (
          <div key={name} className="grid grid-cols-[120px_1fr] gap-4">
            <dt className="py-2.5 font-semibold text-[#707a8a]">{name}</dt>
            <dd className="min-w-0 py-2.5 font-mono text-[#eaecef] font-bold text-xs">
              <div className="truncate text-right" title={String(value)}>{String(value)}</div>
            </dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-7 text-sm font-bold tracking-tight text-[#eaecef]">Published trades</h3>
      {trades.length === 0 ? <p className="mt-2 text-xs text-[#707a8a]">No published trades for this version.</p> : (
        <div className="mt-3 overflow-x-auto max-h-[320px] overflow-y-auto rounded-xl border border-hairline-dark/70 shadow-inner">
          <table aria-label="Published trades" className="w-full min-w-[480px] table-fixed border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-canvas-dark text-[#707a8a] uppercase tracking-wider font-bold border-b border-hairline-dark/80">
              <tr>
                <th className="px-4 py-3 text-left text-muted font-normal whitespace-nowrap">Side</th>
                <th className="px-4 py-3 text-left text-muted font-normal whitespace-nowrap">Entry</th>
                <th className="px-4 py-3 text-left text-muted font-normal whitespace-nowrap">Exit</th>
                <th className="px-4 py-3 text-left text-muted font-normal whitespace-nowrap">Quantity</th>
                <th className="px-4 py-3 text-left text-muted font-normal whitespace-nowrap">P&amp;L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-dark/60">
              {trades.map((trade) => (
                <tr key={`${trade.entryDate.toISOString()}-${trade.exitDate.toISOString()}`} className="hover:bg-canvas-dark/60 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap"><span className="text-[#eaecef] font-semibold">{trade.side}</span></td>
                  <td className="px-4 py-3 whitespace-nowrap"><span className="font-mono tabular-nums text-[#eaecef]">{trade.entryPrice.toFixed(2)}</span></td>
                  <td className="px-4 py-3 whitespace-nowrap"><span className="font-mono tabular-nums text-[#eaecef]">{trade.exitPrice.toFixed(2)}</span></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="truncate max-w-[120px] font-mono tabular-nums text-[#eaecef]" title={String(trade.quantity)}>
                      {trade.quantity}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`font-mono font-bold tabular-nums ${trade.pnl > 0 ? 'text-trading-up' : trade.pnl < 0 ? 'text-trading-down' : 'text-[#eaecef]'}`}>
                      {`${trade.pnl > 0 ? '+' : ''}${trade.pnl.toFixed(2)}`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </aside>
  );
}
