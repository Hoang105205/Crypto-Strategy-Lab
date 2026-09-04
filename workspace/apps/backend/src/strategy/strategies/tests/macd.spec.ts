import { MacdStrategy } from '../macd.strategy';
import { StrategyRegistry } from '../../registry/strategy.registry';
import { Candle, SignalAction, StrategyType } from '@crypto-strategy-lab/shared';
import * as ti from 'technicalindicators';

jest.mock('technicalindicators', () => ({
  MACD: {
    calculate: jest.fn(),
  },
}));

describe('MacdStrategy', () => {
  let registry: StrategyRegistry;
  let strategy: MacdStrategy;

  beforeEach(() => {
    registry = new StrategyRegistry();
    strategy = new MacdStrategy(registry);
  });

  it('should register itself on module init', () => {
    strategy.onModuleInit();
    expect(registry.get('MACD')).toBeDefined();
  });

  it('should have correct name and type', () => {
    expect(strategy.getName()).toBe('MACD');
    expect(strategy.getType()).toBe(StrategyType.MACD);
  });

  it('should return HOLD if not enough candles', () => {
    const signal = strategy.analyze([{ close: 10 }] as Candle[]);
    expect(signal.action).toBe(SignalAction.HOLD);
  });

  it('should return BUY on bullish MACD crossover (MACD crosses above Signal)', () => {
    // previous: MACD <= signal, latest: MACD > signal → bullish crossover
    (ti.MACD.calculate as jest.Mock).mockReturnValue([
      { MACD: -1, signal: 0, histogram: -1 },  // previous: MACD below signal
      { MACD: 1, signal: 0, histogram: 1 },     // latest: MACD above signal
    ]);
    const mockCandles = Array(40).fill({}).map((_, i) => ({ close: 100 + i * 0.1 })) as Candle[];
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.BUY);
    expect(signal.confidence).toBe(0.8);
    expect(signal.metadata?.macd).toBe(1);
  });

  it('should return SELL on bearish MACD crossover (MACD crosses below Signal)', () => {
    // previous: MACD >= signal, latest: MACD < signal → bearish crossover
    (ti.MACD.calculate as jest.Mock).mockReturnValue([
      { MACD: 1, signal: 0, histogram: 1 },     // previous: MACD above signal
      { MACD: -1, signal: 0, histogram: -1 },    // latest: MACD below signal
    ]);
    const mockCandles = Array(40).fill({}).map((_, i) => ({ close: 100 - i * 0.1 })) as Candle[];
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.SELL);
    expect(signal.confidence).toBe(0.8);
  });

  it('should return HOLD when no crossover occurs', () => {
    // Both periods: MACD above signal (no crossover)
    (ti.MACD.calculate as jest.Mock).mockReturnValue([
      { MACD: 2, signal: 1, histogram: 1 },
      { MACD: 3, signal: 1, histogram: 2 },
    ]);
    const mockCandles = Array(40).fill({}).map(() => ({ close: 100 })) as Candle[];
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.HOLD);
  });

  it('should return HOLD when MACD values are undefined', () => {
    (ti.MACD.calculate as jest.Mock).mockReturnValue([
      { MACD: undefined, signal: undefined, histogram: undefined },
      { MACD: undefined, signal: undefined, histogram: undefined },
    ]);
    const mockCandles = Array(40).fill({}).map(() => ({ close: 100 })) as Candle[];
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.HOLD);
  });
});
