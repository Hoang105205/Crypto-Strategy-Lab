import { SupportResistanceStrategy } from '../support-resistance.strategy';
import { StrategyRegistry } from '../../registry/strategy.registry';
import { SignalAction } from '@crypto-strategy-lab/shared';

describe('SupportResistanceStrategy', () => {
  let strategy: SupportResistanceStrategy;
  let registry: StrategyRegistry;

  beforeEach(() => {
    registry = new StrategyRegistry();
    strategy = new SupportResistanceStrategy(registry);
  });

  it('should return BUY on support bounce', () => {
    // 5 historical candles: low is 100, high is 150
    const historical = Array(5).fill({}).map((_, i) => ({ low: 100 + i, high: 150 + i, close: 110 }));
    // Current candle: touches 100, closes at 105 (bounce)
    const current = { low: 100, high: 110, close: 105, open: 102 };
    
    const signal = strategy.analyze([...historical, current] as any);
    expect(signal.action).toBe(SignalAction.BUY);
  });

  it('should return SELL on resistance bounce', () => {
    const historical = Array(5).fill({}).map((_, i) => ({ low: 100, high: 150 - i, close: 120 }));
    // Current candle: touches 150, closes at 145 (rejects)
    const current = { low: 130, high: 150, close: 145, open: 148 };
    
    const signal = strategy.analyze([...historical, current] as any);
    expect(signal.action).toBe(SignalAction.SELL);
  });

  it('should return SELL on support breakout', () => {
    const historical = Array(5).fill({}).map((_, i) => ({ low: 100, high: 150, close: 120 }));
    // Current candle: decisively breaks below 100
    const current = { low: 90, high: 105, close: 95, open: 105 };
    
    const signal = strategy.analyze([...historical, current] as any);
    expect(signal.action).toBe(SignalAction.SELL);
  });
});
