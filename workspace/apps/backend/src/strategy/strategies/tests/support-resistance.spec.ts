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
    // 10 historical candles: low is 100, high is 150
    const historical = Array(10).fill({}).map((_, i) => ({ low: 100 + i, high: 150 + i, close: 110, open: 110 }));
    // Current candle: touches 100, closes at 100.5 (bounce up), open at 100
    const current = { low: 100, high: 110, close: 100.5, open: 100 };
    
    const signal = strategy.analyze([...historical, current] as any);
    expect(signal.action).toBe(SignalAction.BUY);
  });

  it('should return SELL on resistance bounce', () => {
    const historical = Array(10).fill({}).map((_, i) => ({ low: 100, high: 150 - i, close: 120, open: 120 }));
    // Current candle: touches 150, closes at 149.5 (rejects down), open at 150
    const current = { low: 130, high: 150, close: 149.5, open: 150 };
    
    const signal = strategy.analyze([...historical, current] as any);
    expect(signal.action).toBe(SignalAction.SELL);
  });

  it('should return SELL on support breakout', () => {
    const historical = Array(10).fill({}).map((_, i) => ({ low: 100, high: 150, close: 120, open: 120 }));
    // Current candle: decisively breaks below 100 (99 is < 99.5)
    const current = { low: 90, high: 105, close: 95, open: 105 };
    
    const signal = strategy.analyze([...historical, current] as any);
    expect(signal.action).toBe(SignalAction.SELL);
  });
});
