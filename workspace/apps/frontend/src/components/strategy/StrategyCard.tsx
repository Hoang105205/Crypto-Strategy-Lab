'use client';

import React from 'react';

export interface StrategyCardProps {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  isSelected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
}

export const StrategyCard: React.FC<StrategyCardProps> = ({
  name,
  type,
  parameters,
  isSelected = false,
  onSelect,
  onDelete,
}) => {
  const getTypeBadgeColor = (t: string) => {
    switch (t.toUpperCase()) {
      case 'MA':
        return 'bg-blue-900/50 text-blue-300 border-blue-700/50';
      case 'RSI':
        return 'bg-purple-900/50 text-purple-300 border-purple-700/50';
      case 'BOLLINGER':
        return 'bg-amber-900/50 text-amber-300 border-amber-700/50';
      case 'SR':
        return 'bg-teal-900/50 text-teal-300 border-teal-700/50';
      case 'COMPOSITE':
        return 'bg-yellow-900/50 text-[#fcd535] border-yellow-700/50';
      default:
        return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  const formatParamValue = (val: unknown): string => {
    if (Array.isArray(val)) {
      return val
        .map((item) =>
          typeof item === 'object' && item !== null && 'name' in item
            ? (item as { name: string }).name
            : String(item),
        )
        .join(', ');
    }
    if (typeof val === 'object' && val !== null) {
      return Object.entries(val)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    }
    return String(val);
  };

  return (
    <div
      onClick={onSelect}
      className={`p-6 rounded-2xl border transition-all cursor-pointer shadow-md ${
        isSelected
          ? 'bg-[#1e2329] border-[#fcd535] shadow-xl shadow-[#fcd535]/15 ring-1 ring-[#fcd535]'
          : 'bg-[#1e2329]/90 border-[#2b3139] hover:border-gray-500 hover:bg-[#1e2329]'
      }`}
      style={{ padding: '1.5rem' }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-100 tracking-wide">{name}</h3>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-md border shadow-sm ${getTypeBadgeColor(
              type,
            )}`}
            style={{ padding: '0.25rem 0.625rem' }}
          >
            {type}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete strategy"
              className="text-[10px] font-extrabold text-[#f6465d] bg-[#f6465d]/10 hover:bg-[#f6465d]/20 border border-[#f6465d]/30 rounded-md uppercase tracking-wider transition-colors"
              style={{ padding: '0.25rem 0.5rem' }}
            >
              DELETE
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 text-sm text-gray-300 pt-2 border-t border-[#2b3139]/50">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Parameters
        </div>
        <div className="flex flex-wrap gap-4">
          {Object.entries(parameters || {}).map(([key, val]) => (
            <span
              key={key}
              className="rounded-xl bg-[#0b0e11] text-gray-200 font-mono text-xs border border-[#2b3139] shadow-sm flex items-center gap-1.5"
              style={{ padding: '0.5rem 1rem' }}
            >
              <span className="text-gray-400 capitalize">{key}:</span> <span className="text-[#fcd535] font-bold">{formatParamValue(val)}</span>
            </span>
          ))}
          {Object.keys(parameters || {}).length === 0 && (
            <span className="italic text-gray-500 text-xs px-2">No parameters</span>
          )}
        </div>
      </div>
    </div>
  );
};
