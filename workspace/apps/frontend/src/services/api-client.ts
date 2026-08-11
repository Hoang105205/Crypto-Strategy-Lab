'use client';

// API client — typed fetch wrappers for the Market Data REST endpoints.
// Owner: Hoang
// See: sdd_artifacts/market-data-frontend/contracts/frontend-api.md (SSoT)

import type { Candle, TradingPair, Subscription } from '@crypto-strategy-lab/shared';
import { API_BASE_URL } from '../lib/constants';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/** Parse ISO8601 date strings from the backend into Date objects. */
function parseCandle(raw: Candle): Candle {
  return {
    ...raw,
    openTime: new Date(raw.openTime),
    closeTime: new Date(raw.closeTime),
  };
}

export const apiClient = {
  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number = 500,
  ): Promise<Candle[]> {
    const params = new URLSearchParams({ symbol, timeframe, limit: String(limit) });
    const raw = await request<Candle[]>(`/api/market-data/candles?${params}`);
    return raw.map(parseCandle);
  },

  async getPairs(): Promise<TradingPair[]> {
    return request<TradingPair[]>('/api/market-data/pairs');
  },

  async getSubscriptions(): Promise<Subscription[]> {
    const raw = await request<Subscription[]>('/api/market-data/subscriptions');
    return raw.map((s) => ({
      ...s,
      subscribedAt: new Date(s.subscribedAt),
    }));
  },

  async subscribe(symbol: string, timeframe: string): Promise<void> {
    await request('/api/market-data/subscribe', {
      method: 'POST',
      body: JSON.stringify({ symbol, timeframe }),
    });
  },

  async unsubscribe(symbol: string, timeframe: string): Promise<void> {
    await request('/api/market-data/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ symbol, timeframe }),
    });
  },
};
