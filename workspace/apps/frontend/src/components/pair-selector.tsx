'use client';

// PairSelector — global trading pair dropdown.
// Owner: Hoang
// See: spec.md FR-8, DESIGN.md PairSelector component

import { useEffect, useState } from 'react';
import type { TradingPair } from '@crypto-strategy-lab/shared';
import { apiClient } from '../services/api-client';
import { COLORS } from '../lib/constants';

interface PairSelectorProps {
  value: string;
  onChange: (symbol: string) => void;
}

export function PairSelector({ value, onChange }: PairSelectorProps) {
  const [pairs, setPairs] = useState<TradingPair[]>([]);

  useEffect(() => {
    apiClient
      .getPairs()
      .then((data) => setPairs(data.filter((p) => p.isActive)))
      .catch(() => setPairs([]));
  }, []);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border px-3 py-1.5 text-sm font-medium text-body cursor-pointer transition-colors hover:border-muted-strong outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
      style={{
        backgroundColor: COLORS.surfaceCard,
        borderColor: COLORS.hairlineDark,
      }}
    >
      {pairs.map((pair) => (
        <option key={pair.symbol} value={pair.symbol}>
          {pair.baseAsset}/{pair.quoteAsset}
        </option>
      ))}
    </select>
  );
}
