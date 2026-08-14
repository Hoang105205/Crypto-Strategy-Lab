import { CompositeStrategy } from '../composite.strategy';
import { StrategyRegistry } from '../../registry/strategy.registry';
import { MajorityVoteCombiner } from '../../combiners/majority-vote.combiner';
import { IStrategy, StrategyType, SignalAction } from '@crypto-strategy-lab/shared';

describe('CompositeStrategy', () => {
  let registry: StrategyRegistry;
  let child1: jest.Mocked<IStrategy>;
  let child2: jest.Mocked<IStrategy>;
  let child3: jest.Mocked<IStrategy>;

  beforeEach(() => {
    registry = new StrategyRegistry();

    child1 = {
      getName: jest.fn().mockReturnValue('Strat1'),
      getType: jest.fn().mockReturnValue(StrategyType.MA),
      getParameters: jest.fn().mockReturnValue({}),
      analyze: jest.fn().mockReturnValue({ action: SignalAction.BUY, confidence: 0.8 }),
    };

    child2 = {
      getName: jest.fn().mockReturnValue('Strat2'),
      getType: jest.fn().mockReturnValue(StrategyType.RSI),
      getParameters: jest.fn().mockReturnValue({}),
      analyze: jest.fn().mockReturnValue({ action: SignalAction.BUY, confidence: 0.9 }),
    };

    child3 = {
      getName: jest.fn().mockReturnValue('Strat3'),
      getType: jest.fn().mockReturnValue(StrategyType.BOLLINGER),
      getParameters: jest.fn().mockReturnValue({}),
      analyze: jest.fn().mockReturnValue({ action: SignalAction.SELL, confidence: 0.5 }),
    };
  });

  it('should register composite strategy in constructor', () => {
    const composite = new CompositeStrategy('TestComposite', [], undefined, registry);
    expect(registry.get('TestComposite')).toBeDefined();
  });

  it('should combine child strategy signals correctly using MajorityVote', () => {
    const combiner = new MajorityVoteCombiner();
    const composite = new CompositeStrategy('MyComposite', [child1, child2, child3], combiner, registry);

    const result = composite.analyze([]);
    expect(result.action).toBe(SignalAction.BUY);
    expect(result.confidence).toBeCloseTo(0.85); // (0.8 + 0.9)/2
    expect(child1.analyze).toHaveBeenCalled();
    expect(child2.analyze).toHaveBeenCalled();
    expect(child3.analyze).toHaveBeenCalled();
  });

  it('should return HOLD if no child strategies configured', () => {
    const composite = new CompositeStrategy('EmptyComposite', []);
    const result = composite.analyze([]);
    expect(result.action).toBe(SignalAction.HOLD);
  });
});
