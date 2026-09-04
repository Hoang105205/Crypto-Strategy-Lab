'use client';

// TimeframeSelector — per-panel timeframe dropdown.
// Owner: Hoang
// See: spec.md FR-6, DESIGN.md TimeframeSelector component

import { TIMEFRAMES, COLORS, type Timeframe } from '../lib/constants';

interface TimeframeSelectorProps {
  value: string;
  onChange: (timeframe: Timeframe) => void;
}

export function TimeframeSelector({ value, onChange }: TimeframeSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Timeframe)}
      className="rounded-md border px-2.5 py-1 text-xs font-medium text-body cursor-pointer transition-colors hover:border-muted-strong outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
      style={{
        backgroundColor: COLORS.surfaceCard,
        borderColor: COLORS.hairlineDark,
      }}
    >
      {TIMEFRAMES.map((tf) => (
        <option key={tf} value={tf}>
          {tf}
        </option>
      ))}
    </select>
  );
}
