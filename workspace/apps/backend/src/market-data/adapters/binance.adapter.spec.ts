// BinanceAdapter unit tests — parseKline (REST), WS kline parsing, dedup, bounded reconnect.
// All external I/O mocked (axios.get, fake ws) — never hits real Binance (tasks.md §Notes).

import axios, { AxiosError } from 'axios';
import WebSocket from 'ws';
import { Candle } from '@crypto-strategy-lab/shared';

import { BinanceAdapter } from './binance.adapter';

jest.mock('ws', () => {
  class FakeWebSocket {
    static OPEN = 1;
    static instances: FakeWebSocket[] = [];
    /** Number of upcoming instances that fail to open (reconnect-failure tests). */
    static failOpenCount = 0;
    url: string;
    readyState = 1;
    closed = false;
    private listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

    constructor(url: string) {
      this.url = url;
      FakeWebSocket.instances.push(this);
      if (FakeWebSocket.failOpenCount > 0) {
        FakeWebSocket.failOpenCount -= 1;
        this.readyState = 3;
        // Fire 'close' (not 'error') — openStream registers the 'close' listener
        // synchronously, so waitForOpen always observes the failure.
        setTimeout(() => {
          if (!this.closed) {
            this.closed = true;
            this.trigger('close');
          }
        }, 0);
      } else {
        // Successful handshake completes on the next tick.
        setTimeout(() => {
          if (!this.closed) this.trigger('open');
        }, 0);
      }
    }

    on(event: string, cb: (...args: unknown[]) => void): this {
      (this.listeners[event] ??= []).push(cb);
      return this;
    }

    once(event: string, cb: (...args: unknown[]) => void): this {
      return this.on(event, cb);
    }

    close(): void {
      if (this.closed) return;
      this.closed = true;
      this.readyState = 3;
      this.trigger('close');
    }

    trigger(event: string, ...args: unknown[]): void {
      [...(this.listeners[event] ?? [])].forEach((cb) => cb(...args));
    }
  }
  return { __esModule: true, default: FakeWebSocket, WebSocket: FakeWebSocket };
});

type FakeWebSocketType = {
  new (url: string): {
    url: string;
    readyState: number;
    closed: boolean;
    trigger: (event: string, ...args: unknown[]) => void;
  };
  instances: Array<{
    url: string;
    readyState: number;
    closed: boolean;
    trigger: (event: string, ...args: unknown[]) => void;
  }>;
  failOpenCount: number;
};

const FakeWS = WebSocket as unknown as FakeWebSocketType;

// Fast backoff for tests (production default is RECONNECT_DELAYS_MS).
const FAST_DELAYS = [1, 1, 1];

const makeAdapter = (): BinanceAdapter => {
  const adapter = new BinanceAdapter();
  (adapter as unknown as { reconnectDelaysMs: number[] }).reconnectDelaysMs =
    FAST_DELAYS;
  return adapter;
};

const flush = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls until the predicate holds (bounded) — avoids fixed-sleep races with the reconnect loop. */
const waitFor = async (
  predicate: () => boolean,
  timeoutMs = 2000,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

// Sample Binance REST kline row: [openTime, open, high, low, close, volume, closeTime, ...]
const SAMPLE_REST_ROW = [
  1754560800000, // 2026-08-07T10:00:00Z
  '118000.00',
  '118200.50',
  '117900.10',
  '118150.25',
  '125.5',
  1754561099999,
  '14821000.0',
  4500,
  '60.1',
  '7100000.0',
  '0',
];

describe('BinanceAdapter', () => {
  let getSpy: jest.SpyInstance;

  beforeEach(() => {
    FakeWS.instances = [];
    FakeWS.failOpenCount = 0;
    getSpy = jest.spyOn(axios, 'get');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchKlines + parseKline (T0.5)', () => {
    it('maps a Binance REST kline row to a normalized Candle with correct types', async () => {
      getSpy.mockResolvedValue({ data: [SAMPLE_REST_ROW] });
      const adapter = makeAdapter();

      const candles = await adapter.fetchKlines('BTCUSDT', '5m', { limit: 10 });

      expect(getSpy).toHaveBeenCalledTimes(1);
      const [url, config] = getSpy.mock.calls[0] as [
        string,
        { params: Record<string, unknown> },
      ];
      expect(url).toContain('/api/v3/klines');
      expect(config.params).toMatchObject({
        symbol: 'BTCUSDT',
        interval: '5m',
        limit: 10,
      });

      expect(candles).toHaveLength(1);
      const candle = candles[0];
      expect(candle.symbol).toBe('BTCUSDT');
      expect(candle.timeframe).toBe('5m');
      expect(candle.openTime).toEqual(new Date(1754560800000));
      expect(candle.closeTime).toEqual(new Date(1754561099999));
      expect(candle.open).toBe(118000);
      expect(candle.high).toBe(118200.5);
      expect(candle.low).toBe(117900.1);
      expect(candle.close).toBe(118150.25);
      expect(candle.volume).toBe(125.5);
      expect(candle.isClosed).toBe(true);
    });

    it('retries on 5xx and succeeds within MAX_REST_RETRIES', async () => {
      const serverError = new AxiosError(
        'server error',
        '500',
        undefined,
        undefined,
        {
          status: 500,
        } as never,
      );
      getSpy
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({ data: [SAMPLE_REST_ROW] });
      const adapter = makeAdapter();

      const candles = await adapter.fetchKlines('BTCUSDT', '5m', {});

      expect(getSpy).toHaveBeenCalledTimes(2);
      expect(candles).toHaveLength(1);
    });
  });

  describe('WebSocket stream (T1.1)', () => {
    it('opens the kline stream URL for symbol@kline_interval', () => {
      const adapter = makeAdapter();
      adapter.connectStream('BTCUSDT', '5m');

      expect(FakeWS.instances).toHaveLength(1);
      expect(FakeWS.instances[0].url).toBe(
        'wss://stream.binance.com:9443/ws/btcusdt@kline_5m',
      );
    });

    it('does NOT open a second stream for the same symbol:timeframe (BR-1)', () => {
      const adapter = makeAdapter();
      adapter.connectStream('BTCUSDT', '5m');
      adapter.connectStream('BTCUSDT', '5m');

      expect(FakeWS.instances).toHaveLength(1);
    });

    it('delivers a normalized Candle from a WS kline message (forming)', () => {
      const adapter = makeAdapter();
      const received: Candle[] = [];
      adapter.onCandle((candle) => received.push(candle));
      adapter.connectStream('BTCUSDT', '5m');

      FakeWS.instances[0].trigger(
        'message',
        JSON.stringify({
          e: 'kline',
          s: 'BTCUSDT',
          k: {
            t: 1754560800000,
            T: 1754561099999,
            o: '118000.00',
            h: '118200.50',
            l: '117900.10',
            c: '118150.25',
            v: '125.5',
            x: false,
          },
        }),
      );

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        symbol: 'BTCUSDT',
        timeframe: '5m',
        open: 118000,
        close: 118150.25,
        volume: 125.5,
        isClosed: false,
      });
    });

    it('marks the candle closed when k.x is true', () => {
      const adapter = makeAdapter();
      const received: Candle[] = [];
      adapter.onCandle((candle) => received.push(candle));
      adapter.connectStream('BTCUSDT', '5m');

      FakeWS.instances[0].trigger(
        'message',
        JSON.stringify({
          e: 'kline',
          k: {
            t: 1754560800000,
            T: 1754561099999,
            o: '1',
            h: '2',
            l: '0.5',
            c: '1.5',
            v: '10',
            x: true,
          },
        }),
      );

      expect(received[0].isClosed).toBe(true);
    });

    it('disconnectStream closes the socket intentionally without reconnecting', async () => {
      const adapter = makeAdapter();
      adapter.connectStream('BTCUSDT', '5m');
      adapter.disconnectStream('BTCUSDT', '5m');

      expect(FakeWS.instances[0].closed).toBe(true);
      await flush();
      expect(FakeWS.instances).toHaveLength(1); // no reconnect after intentional close
    });
  });

  describe('bounded auto-reconnect + gap recovery (T1.2, ADR-0007)', () => {
    it('reconnects after a drop, replays missed candles, and fires onReconnect', async () => {
      const adapter = makeAdapter();
      const received: Candle[] = [];
      let reconnected = 0;
      adapter.onCandle((candle) => received.push(candle));
      adapter.onReconnect(() => reconnected++);

      adapter.connectStream('BTCUSDT', '5m');
      const first = FakeWS.instances[0];

      // A live candle arrives → lastCandleTime drives gap recovery
      first.trigger(
        'message',
        JSON.stringify({
          e: 'kline',
          k: {
            t: 1754560800000,
            T: 1754561099999,
            o: '1',
            h: '2',
            l: '0.5',
            c: '1.5',
            v: '10',
            x: false,
          },
        }),
      );

      const missedCandle: Candle = {
        symbol: 'BTCUSDT',
        timeframe: '5m',
        openTime: new Date(1754561100000),
        closeTime: new Date(1754561399999),
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 10,
        isClosed: true,
      };
      const fetchSpy = jest
        .spyOn(adapter, 'fetchKlines')
        .mockResolvedValue([missedCandle]);

      first.trigger('close'); // simulate the drop
      await waitFor(() => reconnected === 1);

      expect(FakeWS.instances).toHaveLength(2); // exactly one reconnect
      expect(fetchSpy).toHaveBeenCalledWith('BTCUSDT', '5m', {
        startTime: new Date(1754560800000),
      });
      expect(received).toContainEqual(missedCandle); // gap candles through onCandle pipeline
      expect(reconnected).toBe(1);
    });

    it('stops after MAX_RECONNECT_ATTEMPTS and fires terminal onDisconnect (no while(true))', async () => {
      const adapter = makeAdapter();
      let disconnected = 0;
      adapter.onDisconnect(() => disconnected++);

      adapter.connectStream('BTCUSDT', '5m');
      FakeWS.failOpenCount = 3; // every reconnect attempt fails to open

      FakeWS.instances[0].trigger('close');
      await waitFor(() => disconnected === 1);

      // 1 original + 3 failed attempts = 4 instances, then terminal state
      expect(FakeWS.instances).toHaveLength(4);
      expect(disconnected).toBe(1);
    });
  });
});
