import { AtrStrategy } from '../atr.strategy';
import { StrategyRegistry } from '../../registry/strategy.registry';
import { Candle, SignalAction, StrategyType } from '@crypto-strategy-lab/shared';

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
});
