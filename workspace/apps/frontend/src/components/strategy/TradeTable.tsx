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
    <div className="bg-[#0b0e11] rounded-2xl overflow-hidden shadow-2xl">
      <div 
        className="bg-[#1e2329] border-b border-[#2b3139]/40 flex items-center justify-between"
        style={{ padding: '1.25rem 1.5rem' }}
      >
        <h3 className="text-sm font-black text-gray-100 uppercase tracking-wider">Executed Trade History</h3>
        <span 
          className="text-xs rounded-lg bg-[#0b0e11] text-gray-300 font-mono border border-[#2b3139]/50"
          style={{ padding: '0.375rem 0.75rem' }}
        >
          Total: {trades.length} Trades
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm font-mono">
          <thead>
            <tr className="bg-[#14181d] text-gray-400 uppercase text-xs tracking-wider border-b border-[#2b3139]/40">
              <th className="px-6 py-4" style={{ padding: '1rem 1.5rem' }}>#</th>
              <th className="px-6 py-4" style={{ padding: '1rem 1.5rem' }}>Side</th>
              <th className="px-6 py-4" style={{ padding: '1rem 1.5rem' }}>Entry Date</th>
              <th className="px-6 py-4" style={{ padding: '1rem 1.5rem' }}>Exit Date</th>
              <th className="px-6 py-4 text-right" style={{ padding: '1rem 1.5rem' }}>Entry Price</th>
              <th className="px-6 py-4 text-right" style={{ padding: '1rem 1.5rem' }}>Exit Price</th>
              <th className="px-6 py-4 text-right" style={{ padding: '1rem 1.5rem' }}>Quantity</th>
              <th className="px-6 py-4 text-right" style={{ padding: '1rem 1.5rem' }}>PnL ($)</th>
            </tr>
          </thead>
          <tbody className="text-gray-200">
            {trades.map((t, idx) => {
              const pnl = t.pnl ?? 0;
              const isProfit = pnl >= 0;
              return (
                <tr 
                  key={idx} 
                  className={`transition-colors hover:bg-[#1e2329] ${
                    idx % 2 === 0 ? 'bg-[#0b0e11]' : 'bg-[#14181d]/50'
                  }`}
                >
                  <td className="px-6 py-4 text-gray-500 font-bold" style={{ padding: '1rem 1.5rem' }}>{idx + 1}</td>
                  <td className="px-6 py-4" style={{ padding: '1rem 1.5rem' }}>
                    <span
                      className={`px-2.5 py-1 rounded-md font-bold text-xs uppercase tracking-wider shadow-sm ${
                        t.side === 'LONG'
                          ? 'bg-[#0ecb81]/20 text-[#0ecb81] border border-[#0ecb81]/30'
                          : 'bg-[#f6465d]/20 text-[#f6465d] border border-[#f6465d]/30'
                      }`}
                    >
                      {t.side}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-300" style={{ padding: '1rem 1.5rem' }}>{new Date(t.entryDate).toLocaleString()}</td>
                  <td className="px-6 py-4 text-gray-300" style={{ padding: '1rem 1.5rem' }}>{new Date(t.exitDate).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-gray-200 font-bold" style={{ padding: '1rem 1.5rem' }}>{t.entryPrice?.toFixed(2) ?? '0.00'}</td>
                  <td className="px-6 py-4 text-right text-gray-200 font-bold" style={{ padding: '1rem 1.5rem' }}>{t.exitPrice?.toFixed(2) ?? '0.00'}</td>
                  <td className="px-6 py-4 text-right text-gray-400" style={{ padding: '1rem 1.5rem' }}>{t.quantity?.toFixed(4) ?? '0.0000'}</td>
                  <td
                    className={`px-6 py-4 text-right font-black text-base ${
                      isProfit ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                    }`}
                    style={{ padding: '1rem 1.5rem' }}
                  >
                    {isProfit ? `+${pnl.toFixed(2)}` : pnl.toFixed(2)}
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
