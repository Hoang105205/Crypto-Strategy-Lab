import { StochasticStrategy } from '../stochastic.strategy';
import { StrategyRegistry } from '../../registry/strategy.registry';
import { Candle, SignalAction, StrategyType } from '@crypto-strategy-lab/shared';
import * as ti from 'technicalindicators';

jest.mock('technicalindicators', () => ({
  Stochastic: {
    calculate: jest.fn(),
  },
}));

describe('StochasticStrategy', () => {
  let registry: StrategyRegistry;
  let strategy: StochasticStrategy;

  beforeEach(() => {
    registry = new StrategyRegistry();
    strategy = new StochasticStrategy(registry);
  });

  it('should register itself on module init', () => {
    strategy.onModuleInit();
    expect(registry.get('Stochastic')).toBeDefined();
  });

  it('should have correct name and type', () => {
    expect(strategy.getName()).toBe('Stochastic');
    expect(strategy.getType()).toBe(StrategyType.STOCHASTIC);
  });

  it('should return HOLD if not enough candles', () => {
    const signal = strategy.analyze([{ close: 10, high: 12, low: 8 }] as Candle[]);
    expect(signal.action).toBe(SignalAction.HOLD);
  });

  it('should return BUY on bullish K/D crossover in oversold region', () => {
    // previous: k < d, latest: k > d, and k < 20 (oversold) → BUY
    (ti.Stochastic.calculate as jest.Mock).mockReturnValue([
      { k: 12, d: 15 },   // previous: k below d in oversold zone
      { k: 18, d: 15 },   // latest: k crosses above d, still in oversold (< 20)
    ]);
    const mockCandles = Array(20).fill({}).map(() => ({
      close: 100, high: 105, low: 95,
    })) as Candle[];
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.BUY);
    expect(signal.confidence).toBe(0.8);
    expect(signal.metadata?.k).toBe(18);
  });

  it('should return SELL on bearish K/D crossover in overbought region', () => {
    // previous: k > d, latest: k < d, and k > 80 (overbought) → SELL
    (ti.Stochastic.calculate as jest.Mock).mockReturnValue([
      { k: 88, d: 85 },   // previous: k above d in overbought zone
      { k: 82, d: 85 },   // latest: k crosses below d, still in overbought (> 80)
    ]);
    const mockCandles = Array(20).fill({}).map(() => ({
      close: 100, high: 105, low: 95,
    })) as Candle[];
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.SELL);
    expect(signal.confidence).toBe(0.8);
  });

  it('should return HOLD when crossover is outside overbought/oversold zones', () => {
    // Bullish crossover but NOT in oversold zone (k=55 > 20) → HOLD
    (ti.Stochastic.calculate as jest.Mock).mockReturnValue([
      { k: 50, d: 55 },
      { k: 55, d: 50 },
    ]);
    const mockCandles = Array(20).fill({}).map(() => ({
      close: 100, high: 105, low: 95,
    })) as Candle[];
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.HOLD);
  });

  it('should return HOLD when K or D values are undefined', () => {
    (ti.Stochastic.calculate as jest.Mock).mockReturnValue([
      { k: undefined, d: undefined },
      { k: undefined, d: undefined },
    ]);
    const mockCandles = Array(20).fill({}).map(() => ({
      close: 100, high: 105, low: 95,
    })) as Candle[];
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.HOLD);
  });
});
