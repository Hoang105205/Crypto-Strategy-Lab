// BinanceAdapter — IMarketDataAdapter implementation for Binance (REST klines + WS kline stream)
// Owner: Hoang
// See: kb/modules/market-data.md, kb/contracts/market-data.yaml, ADR-0004, ADR-0007
//
// BR-5: Binance-specific field names (REST array indices, WS `k.t`/`k.o`/...) appear ONLY in this file.
// BR-6 / ADR-0007: reconnect is bounded (RECONNECT_DELAYS_MS, MAX_RECONNECT_ATTEMPTS) — no while(true).

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import WebSocket from 'ws';
import { Candle, IMarketDataAdapter } from '@crypto-strategy-lab/shared';

import {
  BINANCE_REST_BASE,
  BINANCE_WS_BASE,
  BINANCE_RETRY_AFTER_DEFAULT_MS,
  MAX_RECONNECT_ATTEMPTS,
  MAX_REST_RETRIES,
  CANDLE_MAX_LIMIT,
  RECONNECT_DELAYS_MS,
} from '../../shared/constants';

interface StreamState {
  ws: WebSocket;
  symbol: string;
  timeframe: string;
  lastCandleTime: Date | null;
}

@Injectable()
export class BinanceAdapter implements IMarketDataAdapter, OnModuleDestroy {
  private readonly logger = new Logger(BinanceAdapter.name);

  /** Active streams keyed `symbol:timeframe` (data-model.md §2). */
  private readonly streams = new Map<string, StreamState>();
  /** Keys closed on purpose via disconnectStream() — no reconnect for these. */
  private readonly intentionalCloses = new Set<string>();
  /** Keys currently inside the bounded reconnect loop. */
  private readonly reconnecting = new Set<string>();

  private readonly candleCallbacks: Array<(candle: Candle) => void> = [];
  private readonly disconnectCallbacks: Array<() => void> = [];
  private readonly reconnectCallbacks: Array<() => void> = [];

  /** Backoff schedule — overridable in tests, defaults to the contract retry_policy. */
  protected reconnectDelaysMs: number[] = RECONNECT_DELAYS_MS;

  // ──────────────────────────────────────────────
  // REST — historical klines (FR-1)
  // ──────────────────────────────────────────────

  async fetchKlines(
    symbol: string,
    timeframe: string,
    options: { startTime?: Date; endTime?: Date; limit?: number } = {},
  ): Promise<Candle[]> {
    return this.fetchKlinesWithRetry(symbol, timeframe, options, 0);
  }

  private async fetchKlinesWithRetry(
    symbol: string,
    timeframe: string,
    options: { startTime?: Date; endTime?: Date; limit?: number },
    attempt: number,
  ): Promise<Candle[]> {
    try {
      const params: Record<string, string | number> = {
        symbol,
        interval: timeframe,
      };
      if (options.limit !== undefined)
        params.limit = Math.min(options.limit, CANDLE_MAX_LIMIT);
      if (options.startTime) params.startTime = options.startTime.getTime();
      if (options.endTime) params.endTime = options.endTime.getTime();

      const response = await axios.get(`${BINANCE_REST_BASE}/api/v3/klines`, {
        params,
      });
      const rows = response.data as unknown[][];
      return rows.map((row) => this.parseKline(symbol, timeframe, row));
    } catch (error) {
      if (
        attempt < MAX_REST_RETRIES &&
        error instanceof AxiosError &&
        error.response
      ) {
        const status = error.response.status;
        if (status === 429) {
          // Rate-limited — honor Retry-After (default 60s per spec.md §5)
          const retryAfterS = Number(error.response.headers['retry-after']);
          const waitMs = Number.isFinite(retryAfterS)
            ? retryAfterS * 1000
            : BINANCE_RETRY_AFTER_DEFAULT_MS;
          this.logger.warn(`Binance 429 rate-limited; retrying in ${waitMs}ms`);
          await this.delay(waitMs);
          return this.fetchKlinesWithRetry(
            symbol,
            timeframe,
            options,
            attempt + 1,
          );
        }
        if (status >= 500) {
          const waitMs =
            this.reconnectDelaysMs[attempt % this.reconnectDelaysMs.length];
          this.logger.warn(
            `Binance ${status}; retrying in ${waitMs}ms (attempt ${attempt + 1})`,
          );
          await this.delay(waitMs);
          return this.fetchKlinesWithRetry(
            symbol,
            timeframe,
            options,
            attempt + 1,
          );
        }
      }
      throw error;
    }
  }

  /**
   * Maps a Binance REST kline row to the normalized Candle.
   * Binance row layout: [openTime, open, high, low, close, volume, closeTime, ...] — BR-5.
   * Historical REST klines are always finalized.
   */
  private parseKline(
    symbol: string,
    timeframe: string,
    row: unknown[],
  ): Candle {
    return {
      symbol,
      timeframe,
      openTime: new Date(Number(row[0])),
      open: parseFloat(row[1] as string),
      high: parseFloat(row[2] as string),
      low: parseFloat(row[3] as string),
      close: parseFloat(row[4] as string),
      volume: parseFloat(row[5] as string),
      closeTime: new Date(Number(row[6])),
      isClosed: true,
    };
  }

  // ──────────────────────────────────────────────
  // WebSocket — realtime kline stream (FR-2)
  // ──────────────────────────────────────────────

  connectStream(symbol: string, timeframe: string): void {
    const key = streamKey(symbol, timeframe);
    if (this.streams.has(key) || this.reconnecting.has(key)) {
      return; // BR-1: one Binance stream per symbol:timeframe
    }
    this.openStream(key, symbol, timeframe, null);
  }

  disconnectStream(symbol: string, timeframe: string): void {
    const key = streamKey(symbol, timeframe);
    const state = this.streams.get(key);
    if (!state) return;
    this.intentionalCloses.add(key);
    this.streams.delete(key);
    state.ws.close();
    this.logger.log(`Stream closed: ${key}`);
  }

  onCandle(callback: (candle: Candle) => void): void {
    this.candleCallbacks.push(callback);
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback);
  }

  onReconnect(callback: () => void): void {
    this.reconnectCallbacks.push(callback);
  }

  onModuleDestroy(): void {
    for (const [key, state] of this.streams) {
      this.intentionalCloses.add(key);
      state.ws.close();
    }
    this.streams.clear();
  }

  /** Opens the socket for `{BINANCE_WS_BASE}/<symbol-lower>@kline_<interval>` and wires events. */
  private openStream(
    key: string,
    symbol: string,
    timeframe: string,
    previousLastCandleTime: Date | null,
  ): void {
    const url = `${BINANCE_WS_BASE}/${symbol.toLowerCase()}@kline_${timeframe}`;
    const ws = new WebSocket(url);
    const state: StreamState = {
      ws,
      symbol,
      timeframe,
      lastCandleTime: previousLastCandleTime,
    };
    this.streams.set(key, state);

    ws.on('open', () => this.logger.log(`Stream connected: ${key}`));

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        // Buffer handles all RawData variants (Buffer | ArrayBuffer | Buffer[])
        const message = JSON.parse(
          Buffer.from(raw as Buffer).toString('utf8'),
        ) as {
          e?: string;
          k?: BinanceWsKline;
        };
        if (message.e !== 'kline' || !message.k) return;
        const candle = this.parseWsKline(symbol, timeframe, message.k);
        state.lastCandleTime = candle.openTime;
        for (const callback of this.candleCallbacks) callback(candle);
      } catch (error) {
        this.logger.warn(
          `Failed to parse kline message on ${key}: ${String(error)}`,
        );
      }
    });

    // 'error' is always followed by 'close' — reconnect logic lives in handleStreamClosed only.
    ws.on('error', (error: Error) =>
      this.logger.warn(`Stream error on ${key}: ${error.message}`),
    );
    ws.on('close', () => void this.handleStreamClosed(key));
  }

  /**
   * Maps a Binance WS kline object (`k`) to the normalized Candle — BR-5.
   * Fields: k.t→openTime, k.T→closeTime, k.o→open, k.h→high, k.l→low, k.c→close, k.v→volume, k.x→isClosed.
   */
  private parseWsKline(
    symbol: string,
    timeframe: string,
    k: BinanceWsKline,
  ): Candle {
    return {
      symbol,
      timeframe,
      openTime: new Date(Number(k.t)),
      closeTime: new Date(Number(k.T)),
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v),
      isClosed: Boolean(k.x),
    };
  }

  private async handleStreamClosed(key: string): Promise<void> {
    const state = this.streams.get(key);
    if (!state) return;
    this.streams.delete(key);
    if (this.intentionalCloses.delete(key)) return; // deliberate close — no reconnect
    await this.reconnect(key, state);
  }

  // ──────────────────────────────────────────────
  // Auto-reconnect + gap recovery (FR-3, ADR-0007)
  // ──────────────────────────────────────────────

  /** Bounded exponential backoff over RECONNECT_DELAYS_MS — NO while(true). */
  private async reconnect(key: string, previous: StreamState): Promise<void> {
    if (this.reconnecting.has(key)) return;
    this.reconnecting.add(key);
    const attempts = Math.min(
      MAX_RECONNECT_ATTEMPTS,
      this.reconnectDelaysMs.length,
    );
    try {
      for (let attempt = 0; attempt < attempts; attempt++) {
        await this.delay(this.reconnectDelaysMs[attempt]);
        try {
          this.openStream(
            key,
            previous.symbol,
            previous.timeframe,
            previous.lastCandleTime,
          );
          const state = this.streams.get(key);
          if (!state) throw new Error('stream state missing');
          await this.waitForOpen(state.ws);
          this.logger.log(
            `Stream reconnected: ${key} (attempt ${attempt + 1})`,
          );
          await this.recoverGap(key, previous);
          for (const callback of this.reconnectCallbacks) callback();
          return;
        } catch {
          this.streams.delete(key); // failed attempt — drop the dead socket state
        }
      }
      this.logger.error(
        `Reconnect exhausted for ${key} after ${attempts} attempts`,
      );
      for (const callback of this.disconnectCallbacks) callback(); // terminal
    } finally {
      this.reconnecting.delete(key);
    }
  }

  private waitForOpen(ws: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      // Wait for the real lifecycle event — readyState alone can be stale while
      // the handshake is in flight.
      ws.on('open', () => resolve());
      ws.on('error', (error: Error) => reject(error));
      ws.on('close', () => reject(new Error('stream closed before open')));
    });
  }

  /** REST backfill of candles missed during the outage, emitted through the normal onCandle pipeline. */
  private async recoverGap(key: string, state: StreamState): Promise<void> {
    if (!state.lastCandleTime) return;
    try {
      const missed = await this.fetchKlines(state.symbol, state.timeframe, {
        startTime: state.lastCandleTime,
      });
      for (const candle of missed) {
        for (const callback of this.candleCallbacks) callback(candle);
      }
      this.logger.log(
        `Gap recovery on ${key}: replayed ${missed.length} candle(s)`,
      );
    } catch (error) {
      this.logger.warn(`Gap recovery failed on ${key}: ${String(error)}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/** Binance WS kline object — BR-5: never exported outside this file. */
interface BinanceWsKline {
  t: number; // openTime
  T: number; // closeTime
  o: string; // open
  h: string; // high
  l: string; // low
  c: string; // close
  v: string; // volume
  x: boolean; // isClosed
}

export function streamKey(symbol: string, timeframe: string): string {
  return `${symbol}:${timeframe}`;
}
