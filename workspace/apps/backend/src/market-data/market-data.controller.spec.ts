// MarketDataController unit tests — endpoint delegation + flow 6d validation (400 shape).

import { BadRequestException } from '@nestjs/common';
import { Candle } from '@crypto-strategy-lab/shared';

import { MarketDataController } from './market-data.controller';
import { IMarketDataApiService } from './services/market-data.service';

const makeCandle = (): Candle => ({
  symbol: 'BTCUSDT',
  timeframe: '5m',
  openTime: new Date(1754560800000),
  closeTime: new Date(1754561099999),
  open: 118000,
  high: 118200,
  low: 117900,
  close: 118150,
  volume: 125.5,
  isClosed: true,
});

describe('MarketDataController', () => {
  let service: jest.Mocked<
    Pick<
      IMarketDataApiService,
      | 'getCandles'
      | 'getCandlesRange'
      | 'subscribe'
      | 'unsubscribe'
      | 'getTradingPairs'
      | 'listSubscriptions'
      | 'isValidSubscription'
    >
  >;
  let controller: MarketDataController;

  beforeEach(() => {
    service = {
      getCandles: jest.fn(),
      getCandlesRange: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      getTradingPairs: jest.fn(),
      listSubscriptions: jest.fn(),
      isValidSubscription: jest.fn(),
    };
    controller = new MarketDataController(service);
  });

  describe('GET /candles', () => {
    it('returns Candle[] for a valid symbol/timeframe', async () => {
      service.isValidSubscription.mockResolvedValue(true);
      service.getCandles.mockResolvedValue([makeCandle()]);

      const result = await controller.getCandles('BTCUSDT', '5m', '100');

      expect(service.getCandles).toHaveBeenCalledWith('BTCUSDT', '5m', 100);
      expect(result).toHaveLength(1);
    });

    it('returns 400 { error: "Invalid symbol or timeframe" } for an unknown symbol', async () => {
      service.isValidSubscription.mockResolvedValue(false);

      const error: unknown = await controller
        .getCandles('FAKESYMBOL', '5m', undefined)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      const httpError = error as BadRequestException;
      expect(httpError.getStatus()).toBe(400);
      expect(httpError.getResponse()).toEqual({
        error: 'Invalid symbol or timeframe',
      });
    });

    it('returns 400 when symbol or timeframe is missing', async () => {
      await expect(
        controller.getCandles(undefined, '5m', undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        controller.getCandles('BTCUSDT', undefined, undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(service.isValidSubscription).not.toHaveBeenCalled();
    });
  });

  describe('GET /pairs + /subscriptions (FR-8)', () => {
    it('delegates to the service', async () => {
      service.getTradingPairs.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          isActive: true,
        },
      ]);
      service.listSubscriptions.mockReturnValue([]);

      await expect(controller.getPairs()).resolves.toHaveLength(1);
      expect(controller.getSubscriptions()).toEqual([]);
    });
  });

  describe('POST /subscribe + /unsubscribe (flow 6d)', () => {
    it('subscribes and responds with the contract shape', async () => {
      service.isValidSubscription.mockResolvedValue(true);

      const result = await controller.subscribe({
        symbol: 'BTCUSDT',
        timeframe: '5m',
      });

      expect(service.subscribe).toHaveBeenCalledWith('BTCUSDT', '5m');
      expect(result).toEqual({
        status: 'subscribed',
        symbol: 'BTCUSDT',
        timeframe: '5m',
      });
    });

    it('rejects an inactive pair with the contract 400 body', async () => {
      service.isValidSubscription.mockResolvedValue(false);

      const error: unknown = await controller
        .subscribe({ symbol: 'FAKESYMBOL', timeframe: '5m' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual({
        error: 'Invalid symbol or timeframe',
      });
      expect(service.subscribe).not.toHaveBeenCalled();
    });

    it('unsubscribes and responds with { status: "unsubscribed" }', async () => {
      service.isValidSubscription.mockResolvedValue(true);

      const result = await controller.unsubscribe({
        symbol: 'BTCUSDT',
        timeframe: '5m',
      });

      expect(service.unsubscribe).toHaveBeenCalledWith('BTCUSDT', '5m');
      expect(result).toEqual({ status: 'unsubscribed' });
    });
  });
});
