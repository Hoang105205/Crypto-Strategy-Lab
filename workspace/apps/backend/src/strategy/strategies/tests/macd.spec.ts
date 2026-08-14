import { MacdStrategy } from '../macd.strategy';
import { StrategyRegistry } from '../../registry/strategy.registry';
import { Candle, SignalAction, StrategyType } from '@crypto-strategy-lab/shared';

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
});
