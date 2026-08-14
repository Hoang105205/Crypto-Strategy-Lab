import { AtrStrategy } from '../atr.strategy';
import { StrategyRegistry } from '../../registry/strategy.registry';
import { Candle, SignalAction, StrategyType } from '@crypto-strategy-lab/shared';
import * as ti from 'technicalindicators';

jest.mock('technicalindicators', () => ({
  ATR: {
    calculate: jest.fn(),
  },
}));

describe('AtrStrategy', () => {
  let registry: StrategyRegistry;
  let strategy: AtrStrategy;

  beforeEach(() => {
    registry = new StrategyRegistry();
    strategy = new AtrStrategy(registry);
  });

  it('should register itself on module init', () => {
    strategy.onModuleInit();
    expect(registry.get('ATR')).toBeDefined();
  });

  it('should have correct name and type', () => {
    expect(strategy.getName()).toBe('ATR');
    expect(strategy.getType()).toBe(StrategyType.ATR);
  });

  it('should return HOLD if not enough candles', () => {
    const signal = strategy.analyze([{ close: 10, high: 12, low: 8 }] as Candle[]);
    expect(signal.action).toBe(SignalAction.HOLD);
  });

  it('should return BUY on bullish breakout (price change > 1.5x ATR)', () => {
    // ATR = 2, price change = +5 (5 > 2*1.5=3) → bullish breakout → BUY
    (ti.ATR.calculate as jest.Mock).mockReturnValue([2, 2]);
    const mockCandles = Array(16).fill({}).map((_, i) => ({
      close: i === 15 ? 105 : (i === 14 ? 100 : 100),
      high: 106,
      low: 99,
    })) as Candle[];
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.BUY);
    expect(signal.confidence).toBe(0.7);
    expect(signal.metadata?.atr).toBe(2);
  });

  it('should return SELL on bearish breakout (price change < -1.5x ATR)', () => {
    // ATR = 2, price change = -5 (-5 < -2*1.5=-3) → bearish breakout → SELL
    (ti.ATR.calculate as jest.Mock).mockReturnValue([2, 2]);
    const mockCandles = Array(16).fill({}).map((_, i) => ({
      close: i === 15 ? 95 : (i === 14 ? 100 : 100),
      high: 101,
      low: 94,
    })) as Candle[];
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.SELL);
    expect(signal.confidence).toBe(0.7);
  });

  it('should return HOLD when price change is within normal ATR range', () => {
    // ATR = 10, price change = +1 (1 < 10*1.5=15) → no breakout → HOLD
    (ti.ATR.calculate as jest.Mock).mockReturnValue([10, 10]);
    const mockCandles = Array(16).fill({}).map((_, i) => ({
      close: i === 15 ? 101 : (i === 14 ? 100 : 100),
      high: 105,
      low: 95,
    })) as Candle[];
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.HOLD);
  });
});
