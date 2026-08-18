// NewsSentimentStrategy Unit Tests — Signal generation, thresholds & fallback HOLD
// Owner: Thuan

import { SignalAction, StrategyType, Candle } from '@crypto-strategy-lab/shared';
import { NewsSentimentStrategy } from './sentiment.strategy';
import { NewsService } from '../services/news.service';

describe('NewsSentimentStrategy', () => {
  let strategy: NewsSentimentStrategy;
  let mockNewsService: Partial<NewsService>;

  const mockCandles: Candle[] = [
    {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      openTime: new Date(1700000000000),
      closeTime: new Date(1700003600000),
      open: 90000,
      high: 91000,
      low: 89500,
      close: 90800,
      volume: 1500,
      isClosed: true,
    },
  ];

  beforeEach(() => {
    mockNewsService = {
      getAggregateSentiment: jest.fn(),
    };
    strategy = new NewsSentimentStrategy(
      mockNewsService as NewsService,
      { buyThreshold: 0.5, sellThreshold: -0.5, timeframe: '1h' }
    );
  });

  it('should return correct metadata and strategy type', () => {
    expect(strategy.getName()).toBe('NewsSentimentStrategy');
    expect(strategy.getType()).toBe(StrategyType.SENTIMENT);
    expect(strategy.getParameters()).toEqual({
      buyThreshold: 0.5,
      sellThreshold: -0.5,
      timeframe: '1h',
    });
  });

  it('should return HOLD if candles array is empty', async () => {
    const syncSignal = strategy.analyze([]);
    expect(syncSignal).toEqual({ action: SignalAction.HOLD, confidence: 0 });

    const asyncSignal = await strategy.analyzeAsync([]);
    expect(asyncSignal).toEqual({ action: SignalAction.HOLD, confidence: 0 });
  });

  it('should generate BUY signal when aggregate sentiment >= buyThreshold', async () => {
    (mockNewsService.getAggregateSentiment as jest.Mock).mockResolvedValueOnce({
      score: 0.75,
      label: 'POSITIVE',
      articleCount: 5,
      updatedAt: new Date().toISOString(),
    });

    const signal = await strategy.analyzeAsync(mockCandles);

    expect(signal.action).toBe(SignalAction.BUY);
    expect(signal.confidence).toBe(0.75);
    expect(signal.metadata?.symbol).toBe('BTC');
    expect(mockNewsService.getAggregateSentiment).toHaveBeenCalledWith('BTC', '1h');
  });

  it('should generate SELL signal when aggregate sentiment <= sellThreshold', async () => {
    (mockNewsService.getAggregateSentiment as jest.Mock).mockResolvedValueOnce({
      score: -0.65,
      label: 'NEGATIVE',
      articleCount: 4,
      updatedAt: new Date().toISOString(),
    });

    const signal = await strategy.analyzeAsync(mockCandles);

    expect(signal.action).toBe(SignalAction.SELL);
    expect(signal.confidence).toBe(0.65);
    expect(signal.metadata?.symbol).toBe('BTC');
  });

  it('should generate HOLD signal when aggregate sentiment is between thresholds', async () => {
    (mockNewsService.getAggregateSentiment as jest.Mock).mockResolvedValueOnce({
      score: 0.15,
      label: 'NEUTRAL',
      articleCount: 2,
      updatedAt: new Date().toISOString(),
    });

    const signal = await strategy.analyzeAsync(mockCandles);

    expect(signal.action).toBe(SignalAction.HOLD);
    expect(signal.confidence).toBe(0);
  });

  it('should return HOLD signal if NewsService throws an error', async () => {
    (mockNewsService.getAggregateSentiment as jest.Mock).mockRejectedValueOnce(
      new Error('Database query connection timeout')
    );

    const signal = await strategy.analyzeAsync(mockCandles);

    expect(signal.action).toBe(SignalAction.HOLD);
    expect(signal.confidence).toBe(0);
  });
});
