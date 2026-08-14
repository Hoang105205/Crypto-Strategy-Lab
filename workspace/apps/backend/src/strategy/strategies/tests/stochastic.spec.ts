import { StochasticStrategy } from '../stochastic.strategy';
import { StrategyRegistry } from '../../registry/strategy.registry';
import { Candle, SignalAction, StrategyType } from '@crypto-strategy-lab/shared';

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
});
