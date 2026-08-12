'use client';

import React from 'react';

export interface TradeItem {
  entryDate: string | Date;
  exitDate: string | Date;
  entryPrice: number;
  exitPrice: number;
  side: string;
  pnl: number;
  quantity: number;
}

export interface TradeTableProps {
  trades: TradeItem[];
}

export const TradeTable: React.FC<TradeTableProps> = ({ trades }) => {
  if (!trades || trades.length === 0) {
    return (
      <div className="bg-[#1e2329] border border-[#2b3139] rounded-xl p-8 text-center text-gray-500 italic text-sm">
        No executed trades found in backtest results.
      </div>
    );
  }

  return (
    <div className="bg-[#1e2329] border border-[#2b3139] rounded-xl overflow-hidden shadow-xl">
      <div className="p-4 border-b border-[#2b3139] flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">Executed Trade History</h3>
        <span className="text-xs px-2.5 py-1 rounded bg-gray-800 text-gray-400 font-mono">
          Total: {trades.length} Trades
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="bg-[#0b0e11] text-gray-400 uppercase text-[10px] tracking-wider border-b border-[#2b3139]">
              <th className="p-3">#</th>
              <th className="p-3">Side</th>
              <th className="p-3">Entry Date</th>
              <th className="p-3">Exit Date</th>
              <th className="p-3 text-right">Entry Price</th>
              <th className="p-3 text-right">Exit Price</th>
              <th className="p-3 text-right">Quantity</th>
              <th className="p-3 text-right">PnL ($)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2b3139] text-gray-200">
            {trades.map((t, idx) => {
              const isProfit = t.pnl >= 0;
              return (
                <tr key={idx} className="hover:bg-[#2b3139]/40 transition-colors">
                  <td className="p-3 text-gray-500">{idx + 1}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        t.side === 'LONG'
                          ? 'bg-[#0ecb81]/20 text-[#0ecb81]'
                          : 'bg-[#f6465d]/20 text-[#f6465d]'
                      }`}
                    >
                      {t.side}
                    </span>
                  </td>
                  <td className="p-3 text-gray-400">{new Date(t.entryDate).toLocaleString()}</td>
                  <td className="p-3 text-gray-400">{new Date(t.exitDate).toLocaleString()}</td>
                  <td className="p-3 text-right text-gray-300 font-semibold">{t.entryPrice.toFixed(2)}</td>
                  <td className="p-3 text-right text-gray-300 font-semibold">{t.exitPrice.toFixed(2)}</td>
                  <td className="p-3 text-right text-gray-400">{t.quantity.toFixed(4)}</td>
                  <td
                    className={`p-3 text-right font-bold ${
                      isProfit ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                    }`}
                  >
                    {isProfit ? `+${t.pnl.toFixed(2)}` : t.pnl.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
