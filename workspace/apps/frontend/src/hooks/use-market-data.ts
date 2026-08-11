'use client';

// useMarketData — per-chart-panel data hook.
// Fetches historical candles, manages REST + socket subscriptions,
// and invokes callbacks on real-time candle updates.
// Owner: Hoang
// See: sdd_artifacts/market-data-frontend/contracts/frontend-api.md, research.md D6

import { useEffect, useRef, useState } from 'react';
import type { Candle } from '@crypto-strategy-lab/shared';
import { apiClient } from '../services/api-client';
import { getSocket } from '../services/socket-client';
import { CANDLE_LIMIT, WS_EVENTS } from '../lib/constants';

interface WsCandlePayload {
  symbol: string;
  timeframe: string;
  candle: {
    openTime: string;
    closeTime: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    isClosed: boolean;
  };
}

function parsePayload(payload: WsCandlePayload): Candle {
  return {
    symbol: payload.symbol,
    timeframe: payload.timeframe,
    openTime: new Date(payload.candle.openTime),
    closeTime: new Date(payload.candle.closeTime),
    open: payload.candle.open,
    high: payload.candle.high,
    low: payload.candle.low,
    close: payload.candle.close,
    volume: payload.candle.volume,
    isClosed: payload.candle.isClosed,
  };
}

interface UseMarketDataCallbacks {
  onUpdate?: (candle: Candle) => void;
  onClose?: (candle: Candle) => void;
}

export function useMarketData(
  symbol: string,
  timeframe: string,
  callbacks: UseMarketDataCallbacks,
) {
  const cbRef = useRef(callbacks);
  useEffect(() => {
    cbRef.current = callbacks;
  });

  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset state on dependency change is a valid pattern
    setLoading(true);
    setError(null);

    // 1. Fetch historical candles (flow 5c)
    apiClient
      .getCandles(symbol, timeframe, CANDLE_LIMIT)
      .then((history) => {
        if (cancelled) return;
        setCandles(history);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch candles');
        setLoading(false);
      });

    // 2. REST subscribe — opens/increments the Binance stream (flow step 1)
    apiClient.subscribe(symbol, timeframe).catch((err: unknown) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'Failed to subscribe');
    });

    // 3. Socket room join — receive candle:update / candle:close (research D6)
    const socket = getSocket();

    const handleUpdate = (payload: WsCandlePayload) => {
      if (payload.symbol !== symbol || payload.timeframe !== timeframe) return;
      const candle = parsePayload(payload);
      cbRef.current.onUpdate?.(candle);
    };

    const handleClose = (payload: WsCandlePayload) => {
      if (payload.symbol !== symbol || payload.timeframe !== timeframe) return;
      const candle = parsePayload(payload);
      // Update candles array for overlays (flow step 15)
      setCandles((prev) => {
        const idx = prev.findIndex(
          (c) => c.openTime.getTime() === candle.openTime.getTime(),
        );
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = candle;
          return copy;
        }
        return [...prev, candle];
      });
      cbRef.current.onClose?.(candle);
    };

    socket.on(WS_EVENTS.candleUpdate, handleUpdate);
    socket.on(WS_EVENTS.candleClose, handleClose);
    socket.emit('subscribe', { symbol, timeframe });

    // Cleanup — unsubscribe from both REST and socket (flow 6c)
    return () => {
      cancelled = true;
      socket.off(WS_EVENTS.candleUpdate, handleUpdate);
      socket.off(WS_EVENTS.candleClose, handleClose);
      socket.emit('unsubscribe', { symbol, timeframe });
      apiClient.unsubscribe(symbol, timeframe).catch(() => {});
    };
  }, [symbol, timeframe]);

  return { candles, loading, error };
}
