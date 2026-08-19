'use client';

import { useState } from 'react';
import type { Trade } from '@crypto-strategy-lab/shared';

interface TradeDetailTableProps {
  trades: Trade[];
}

/**
 * Trade detail table — displays all trade fields from todo #4.
 * Req §26 (Trade Detail), §37 (MVP: Buy/Sell, Entry/Exit).
 *
 * See: kb/contracts/strategy.yaml §Trade
 */
export function TradeDetailTable({ trades }: TradeDetailTableProps) {
  if (!trades || trades.length === 0) {
    return (
      <div className="rounded-lg bg-surface-card p-6 text-center text-body-secondary">
        No trades to display
      </div>
    );
  }

  const [currentPage, setCurrentPage] = useState(1);
  const TRADES_PER_PAGE = 10;

  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl <= 0).length;
  const totalProfit = trades.reduce((sum, t) => sum + t.pnl, 0);

  const totalPages = Math.ceil(trades.length / TRADES_PER_PAGE);
  const startIndex = (currentPage - 1) * TRADES_PER_PAGE;
  const currentTrades = trades.slice(startIndex, startIndex + TRADES_PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-surface-card p-4">
          <div className="text-sm text-body-secondary">Win Rate</div>
          <div className="text-xl font-bold text-body">
            {((wins / trades.length) * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-body-secondary">
            {wins} wins / {losses} losses
          </div>
        </div>
        <div className="rounded-lg bg-surface-card p-4">
          <div className="text-sm text-body-secondary">Total Profit</div>
          <div className={`text-xl font-bold ${totalProfit >= 0 ? 'text-trading-up' : 'text-trading-down'}`}>
            {totalProfit >= 0 ? '+$' : '-$'}{Math.abs(totalProfit).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-body-secondary">
            Cumulative Return
          </div>
        </div>
        <div className="rounded-lg bg-surface-card p-4">
          <div className="text-sm text-body-secondary">Total Trades</div>
          <div className="text-xl font-bold text-body">{trades.length}</div>
        </div>
      </div>

      {/* Trade table */}
      <div className="overflow-x-auto rounded-lg bg-surface-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-body-secondary">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Entry Time</th>
              <th className="px-4 py-3">Exit Time</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3 text-right">Volume (USD)</th>
              <th className="px-4 py-3 text-right">Entry Price</th>
              <th className="px-4 py-3 text-right">Exit Price</th>
              <th className="px-4 py-3 text-right">Stop Loss</th>
              <th className="px-4 py-3 text-right">Take Profit</th>
              <th className="px-4 py-3 text-right">Tx Cost</th>
              <th className="px-4 py-3 text-right">Slippage</th>
              <th className="px-4 py-3 text-right">Profit</th>
            </tr>
          </thead>
          <tbody>
            {currentTrades.map((trade, index) => (
              <tr key={startIndex + index} className="border-b border-border/50 hover:bg-canvas-dark/50">
                <td className="px-4 py-3 text-body-secondary">{startIndex + index + 1}</td>
                <td className="px-4 py-3 text-body">
                  {new Date(trade.entryDate).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-body">
                  {new Date(trade.exitDate).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-semibold ${trade.side === 'LONG' ? 'text-trading-up' : 'text-trading-down'}`}>
                    {trade.side}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-body">
                  {trade.volumeUsd != null ? `$${trade.volumeUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-body">
                  {trade.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right font-mono text-body">
                  {trade.exitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right font-mono text-body-secondary">
                  {trade.stopLoss != null ? trade.stopLoss.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-body-secondary">
                  {trade.takeProfit != null ? trade.takeProfit.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-body-secondary">
                  {trade.transactionCost != null ? `$${trade.transactionCost.toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-body-secondary">
                  {trade.slippage != null ? trade.slippage.toFixed(2) : '—'}
                </td>
                <td className={`px-4 py-3 text-right font-mono font-semibold ${trade.pnl >= 0 ? 'text-trading-up' : 'text-trading-down'}`}>
                  {trade.pnl >= 0 ? '+$' : '-$'}{Math.abs(trade.pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-[#1e2329] p-4 rounded-lg border border-[#2b3139]">
          <div className="text-sm text-gray-400 font-mono">
            Showing {startIndex + 1}-{Math.min(startIndex + TRADES_PER_PAGE, trades.length)} of {trades.length} trades
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-[#0b0e11] border border-[#2b3139] rounded-md text-sm text-[#fcd535] hover:bg-[#2b3139] disabled:opacity-30 disabled:hover:bg-[#0b0e11] transition-colors"
            >
              PREVIOUS
            </button>
            <span className="text-sm text-gray-300 font-mono">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-[#0b0e11] border border-[#2b3139] rounded-md text-sm text-[#fcd535] hover:bg-[#2b3139] disabled:opacity-30 disabled:hover:bg-[#0b0e11] transition-colors"
            >
              NEXT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
