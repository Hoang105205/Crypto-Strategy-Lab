import { MovingAverageStrategy } from '../moving-average.strategy';
import { StrategyRegistry } from '../../registry/strategy.registry';
import { SignalAction } from '@crypto-strategy-lab/shared';
import * as ti from 'technicalindicators';

jest.mock('technicalindicators', () => ({
  SMA: {
    calculate: jest.fn(),
  },
}));

describe('MovingAverageStrategy', () => {
  let strategy: MovingAverageStrategy;
  let registry: StrategyRegistry;

  beforeEach(() => {
    registry = new StrategyRegistry();
    strategy = new MovingAverageStrategy(registry);
  });

  it('should register itself onModuleInit', () => {
    strategy.onModuleInit();
    expect(registry.get('MovingAverage')).toBeDefined();
  });

  it('should return HOLD if not enough candles', () => {
    const signal = strategy.analyze([{ close: 100 } as any]);
    expect(signal.action).toBe(SignalAction.HOLD);
  });

  it('should return BUY when crossing above SMA', () => {
    (ti.SMA.calculate as jest.Mock).mockReturnValue([100, 100]);
    const mockCandles = Array(14).fill({}).map((_, i) => ({
      close: i === 12 ? 99 : (i === 13 ? 105 : 100)
    })) as any;

    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.BUY);
    expect(signal.metadata?.sma).toBe(100);
  });

  it('should return SELL when crossing below SMA', () => {
    (ti.SMA.calculate as jest.Mock).mockReturnValue([100, 100]);
    const mockCandles = Array(14).fill({}).map((_, i) => ({
      close: i === 12 ? 101 : (i === 13 ? 95 : 100)
    })) as any;

    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.SELL);
  });
});
