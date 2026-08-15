import { BollingerBandsStrategy } from '../bollinger-bands.strategy';
import { StrategyRegistry } from '../../registry/strategy.registry';
import { SignalAction } from '@crypto-strategy-lab/shared';
import * as ti from 'technicalindicators';

jest.mock('technicalindicators', () => ({
  BollingerBands: {
    calculate: jest.fn(),
  },
}));

describe('BollingerBandsStrategy', () => {
  let strategy: BollingerBandsStrategy;
  let registry: StrategyRegistry;

  beforeEach(() => {
    registry = new StrategyRegistry();
    strategy = new BollingerBandsStrategy(registry);
  });

  it('should return BUY when price drops below lower band', () => {
    (ti.BollingerBands.calculate as jest.Mock).mockReturnValue([{ lower: 95, middle: 100, upper: 105 }]); 
    const mockCandles = Array(20).fill({}).map((_, i) => ({ close: i === 19 ? 90 : 100 })) as any;
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.BUY);
  });

  it('should return SELL when price rises above upper band', () => {
    (ti.BollingerBands.calculate as jest.Mock).mockReturnValue([{ lower: 95, middle: 100, upper: 105 }]); 
    const mockCandles = Array(20).fill({}).map((_, i) => ({ close: i === 19 ? 110 : 100 })) as any;
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.SELL);
  });

  it('should return HOLD when price is inside bands', () => {
    (ti.BollingerBands.calculate as jest.Mock).mockReturnValue([{ lower: 95, middle: 100, upper: 105 }]); 
    const mockCandles = Array(20).fill({}).map((_, i) => ({ close: i === 19 ? 102 : 100 })) as any;
    const signal = strategy.analyze(mockCandles);
    expect(signal.action).toBe(SignalAction.HOLD);
  });
});
