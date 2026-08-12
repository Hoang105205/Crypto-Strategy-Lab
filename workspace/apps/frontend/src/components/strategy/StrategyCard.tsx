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
      className={`p-4 rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'bg-[#1e2329] border-[#fcd535] shadow-lg shadow-[#fcd535]/10'
          : 'bg-[#1e2329]/80 border-[#2b3139] hover:border-gray-500 hover:bg-[#1e2329]'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-100 tracking-wide">{name}</h3>
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${getTypeBadgeColor(
              type,
            )}`}
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
              title="Xóa chiến lược"
              className="p-1 rounded text-gray-400 hover:text-[#f6465d] hover:bg-[#f6465d]/10 transition-colors text-xs"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-gray-400">
        <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          Parameters
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(parameters || {}).map(([key, val]) => (
            <span
              key={key}
              className="px-2 py-1 rounded bg-[#0b0e11] text-gray-300 font-mono text-[11px]"
            >
              {key}: <span className="text-[#fcd535]">{formatParamValue(val)}</span>
            </span>
          ))}
          {Object.keys(parameters || {}).length === 0 && (
            <span className="italic text-gray-500">No parameters</span>
          )}
        </div>
      </div>
    </div>
  );
};
