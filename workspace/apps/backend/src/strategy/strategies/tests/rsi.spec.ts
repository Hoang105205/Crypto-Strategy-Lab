import { RsiStrategy } from '../rsi.strategy';
import { StrategyRegistry } from '../../registry/strategy.registry';
import { SignalAction } from '@crypto-strategy-lab/shared';
import * as ti from 'technicalindicators';

jest.mock('technicalindicators', () => ({
  RSI: {
    calculate: jest.fn(),
  },
}));

describe('RsiStrategy', () => {
  let strategy: RsiStrategy;
  let registry: StrategyRegistry;

  beforeEach(() => {
    registry = new StrategyRegistry();
    strategy = new RsiStrategy(registry);
  });

  it('should return BUY when crossing above oversold', () => {
    (ti.RSI.calculate as jest.Mock).mockReturnValue([25, 35]);
    const mockCandles = Array(14).fill({ close: 100 }) as any;
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.BUY);
  });

  it('should return SELL when crossing below overbought', () => {
    (ti.RSI.calculate as jest.Mock).mockReturnValue([75, 65]);
    const mockCandles = Array(14).fill({ close: 100 }) as any;
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.SELL);
  });

  it('should return HOLD when in middle', () => {
    (ti.RSI.calculate as jest.Mock).mockReturnValue([50, 50]);
    const mockCandles = Array(14).fill({ close: 100 }) as any;
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.HOLD);
  });
});
