// MarketDataService unit tests — cache, subscription dedup, persistence, events, range queries.
// Adapter, Prisma, gateway, and event bus are all mocked — no network, no DB.

import { EventType, Candle } from '@crypto-strategy-lab/shared';

import { MarketDataService } from './market-data.service';
import { CANDLE_CACHE_TTL_MS } from '../../shared/constants';

const makeCandle = (overrides: Partial<Candle> = {}): Candle => ({
  symbol: 'BTCUSDT',
  timeframe: '5m',
  openTime: new Date(1754560800000),
  closeTime: new Date(1754561099999),
  open: 118000,
  high: 118200,
  low: 117900,
  close: 118150,
  volume: 125.5,
  isClosed: false,
  ...overrides,
});

describe('MarketDataService', () => {
  let adapter: {
    fetchKlines: jest.Mock;
    connectStream: jest.Mock;
    disconnectStream: jest.Mock;
    onCandle: jest.Mock;
    onDisconnect: jest.Mock;
    onReconnect: jest.Mock;
  };
  let prisma: {
    candle: { findMany: jest.Mock; upsert: jest.Mock };
    tradingPair: { findMany: jest.Mock; findUnique: jest.Mock };
  };
  let gateway: { emitCandle: jest.Mock; emitStatus: jest.Mock };
  let eventBus: { publish: jest.Mock };
  let service: MarketDataService;

  beforeEach(() => {
    adapter = {
      fetchKlines: jest.fn(),
      connectStream: jest.fn(),
      disconnectStream: jest.fn(),
      onCandle: jest.fn(),
      onDisconnect: jest.fn(),
      onReconnect: jest.fn(),
    };
    prisma = {
      candle: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      tradingPair: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
    };
    gateway = { emitCandle: jest.fn(), emitStatus: jest.fn() };
    eventBus = { publish: jest.fn() };
    service = new MarketDataService(
      adapter,
      prisma as never,
      gateway,
      eventBus as never,
    );
  });

  const registeredCandleHandler = (): ((candle: Candle) => void) =>
    (
      adapter.onCandle.mock.calls as unknown as Array<
        [(candle: Candle) => void]
      >
    )[0][0];

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  describe('getCandles caching (T0.6)', () => {
    it('fetches from the adapter on miss and serves from cache on hit within TTL', async () => {
      adapter.fetchKlines.mockResolvedValue([makeCandle({ isClosed: true })]);

      const first = await service.getCandles('BTCUSDT', '5m', 100);
      const second = await service.getCandles('BTCUSDT', '5m', 100);

      expect(adapter.fetchKlines).toHaveBeenCalledTimes(1);
      expect(first).toEqual(second);
    });

    it('re-fetches after the TTL expires', async () => {
      adapter.fetchKlines.mockResolvedValue([makeCandle({ isClosed: true })]);
      const nowSpy = jest.spyOn(Date, 'now');
      const start = Date.now();
      nowSpy.mockReturnValue(start);

      await service.getCandles('BTCUSDT', '5m', 100);
      nowSpy.mockReturnValue(start + CANDLE_CACHE_TTL_MS + 1);
      await service.getCandles('BTCUSDT', '5m', 100);

      expect(adapter.fetchKlines).toHaveBeenCalledTimes(2);
    });

    it('clamps limit to the contract maximum of 1000', async () => {
      adapter.fetchKlines.mockResolvedValue([]);
      await service.getCandles('BTCUSDT', '5m', 5000);
      expect(adapter.fetchKlines).toHaveBeenCalledWith('BTCUSDT', '5m', {
        limit: 1000,
      });
    });
  });

  describe('getCandlesRange DB-first + backfill (T0.7)', () => {
    it('returns DB candles merged with adapter backfill for gaps, sorted', async () => {
      const t = (minutes: number) => new Date(1754560800000 + minutes * 60_000);
      // DB holds the first two 5m candles; minutes 10–20 are missing
      prisma.candle.findMany.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          timeframe: '5m',
          openTime: t(0),
          closeTime: t(5),
          open: 1,
          high: 2,
          low: 0.5,
          close: 1.5,
          volume: 10,
          isClosed: true,
        },
        {
          symbol: 'BTCUSDT',
          timeframe: '5m',
          openTime: t(5),
          closeTime: t(10),
          open: 1.5,
          high: 2.5,
          low: 1,
          close: 2,
          volume: 12,
          isClosed: true,
        },
      ]);
      adapter.fetchKlines.mockResolvedValue([
        makeCandle({ openTime: t(10), closeTime: t(15), isClosed: true }),
        makeCandle({ openTime: t(15), closeTime: t(20), isClosed: true }),
      ]);

      const result = await service.getCandlesRange(
        'BTCUSDT',
        '5m',
        t(0),
        t(20),
      );

      // Adapter only fills the gap — a single call starting at the first missing slot
      expect(adapter.fetchKlines).toHaveBeenCalledTimes(1);
      expect(adapter.fetchKlines).toHaveBeenCalledWith(
        'BTCUSDT',
        '5m',
        expect.objectContaining({ startTime: t(10) }),
      );

      expect(result).toHaveLength(4);
      expect(result.map((c) => c.openTime.getTime())).toEqual(
        [0, 5, 10, 15].map((m) => t(m).getTime()),
      );
    });

    it('does not call the adapter when the DB covers the whole range', async () => {
      const t = (minutes: number) => new Date(1754560800000 + minutes * 60_000);
      prisma.candle.findMany.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          timeframe: '5m',
          openTime: t(0),
          closeTime: t(5),
          open: 1,
          high: 2,
          low: 0.5,
          close: 1.5,
          volume: 10,
          isClosed: true,
        },
        {
          symbol: 'BTCUSDT',
          timeframe: '5m',
          openTime: t(5),
          closeTime: t(10),
          open: 1.5,
          high: 2.5,
          low: 1,
          close: 2,
          volume: 12,
          isClosed: true,
        },
      ]);

      const result = await service.getCandlesRange('BTCUSDT', '5m', t(0), t(5));

      expect(adapter.fetchKlines).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('subscription dedup (T1.3, BR-1)', () => {
    it('opens one stream for duplicate subscribes and counts subscribers', () => {
      service.subscribe('BTCUSDT', '5m');
      service.subscribe('BTCUSDT', '5m');

      expect(adapter.connectStream).toHaveBeenCalledTimes(1);
      const subs = service.listSubscriptions();
      expect(subs).toHaveLength(1);
      expect(subs[0].subscriberCount).toBe(2);
    });

    it('closes the stream only when the last subscriber unsubscribes', () => {
      service.subscribe('BTCUSDT', '5m');
      service.subscribe('BTCUSDT', '5m');

      service.unsubscribe('BTCUSDT', '5m');
      expect(adapter.disconnectStream).not.toHaveBeenCalled();
      expect(service.listSubscriptions()[0].subscriberCount).toBe(1);

      service.unsubscribe('BTCUSDT', '5m');
      expect(adapter.disconnectStream).toHaveBeenCalledTimes(1);
      expect(service.listSubscriptions()).toHaveLength(0);
    });
  });

  describe('candle pipeline (T1.4 + T1.7)', () => {
    it('persists closed candles via upsert, invalidates cache, publishes and relays', async () => {
      adapter.fetchKlines.mockResolvedValue([makeCandle()]);
      await service.getCandles('BTCUSDT', '5m', 100); // populate cache

      const closed = makeCandle({ isClosed: true });
      registeredCandleHandler()(closed);
      await flush();

      expect(prisma.candle.upsert).toHaveBeenCalledTimes(1);
      const upsertCalls = prisma.candle.upsert.mock.calls as unknown as Array<
        [{ where: Record<string, unknown> }]
      >;
      expect(upsertCalls[0][0].where).toEqual({
        symbol_timeframe_openTime: {
          symbol: 'BTCUSDT',
          timeframe: '5m',
          openTime: closed.openTime,
        },
      });

      // FR-7: published on the event bus
      expect(eventBus.publish).toHaveBeenCalledWith(
        EventType.MarketDataUpdated,
        {
          symbol: 'BTCUSDT',
          timeframe: '5m',
          candle: closed,
        },
      );

      // FR-5: relayed to the gateway
      expect(gateway.emitCandle).toHaveBeenCalledWith('BTCUSDT', '5m', closed);

      // Cache invalidated on close → next read hits the adapter again
      await service.getCandles('BTCUSDT', '5m', 100);
      expect(adapter.fetchKlines).toHaveBeenCalledTimes(2);
    });

    it('never persists forming candles but still relays and publishes', async () => {
      const forming = makeCandle({ isClosed: false });
      registeredCandleHandler()(forming);
      await flush();

      expect(prisma.candle.upsert).not.toHaveBeenCalled();
      expect(gateway.emitCandle).toHaveBeenCalledWith('BTCUSDT', '5m', forming);
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('relays adapter disconnect/reconnect to gateway status', () => {
      const disconnectCalls = adapter.onDisconnect.mock
        .calls as unknown as Array<[() => void]>;
      const reconnectCalls = adapter.onReconnect.mock.calls as unknown as Array<
        [() => void]
      >;
      const onDisconnect = disconnectCalls[0][0];
      const onReconnect = reconnectCalls[0][0];

      onDisconnect();
      onReconnect();

      expect(gateway.emitStatus).toHaveBeenNthCalledWith(1, 'disconnected');
      expect(gateway.emitStatus).toHaveBeenNthCalledWith(2, 'reconnected');
    });
  });

  describe('reference data (FR-8)', () => {
    it('returns active trading pairs from the DB', async () => {
      prisma.tradingPair.findMany.mockResolvedValue([
        { symbol: 'BTCUSDT', isActive: true },
      ]);
      await expect(service.getTradingPairs()).resolves.toHaveLength(1);
      expect(prisma.tradingPair.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });

    it('rejects unknown timeframes and inactive pairs', async () => {
      prisma.tradingPair.findUnique.mockResolvedValue({
        symbol: 'BTCUSDT',
        isActive: true,
      });
      await expect(service.isValidSubscription('BTCUSDT', '5m')).resolves.toBe(
        true,
      );
      await expect(service.isValidSubscription('BTCUSDT', '7m')).resolves.toBe(
        false,
      );

      prisma.tradingPair.findUnique.mockResolvedValue(null);
      await expect(service.isValidSubscription('FAKEUSDT', '5m')).resolves.toBe(
        false,
      );
    });
  });
});
