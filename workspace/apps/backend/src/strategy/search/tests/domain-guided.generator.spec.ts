import { DomainGuidedGenerator } from '../domain-guided.generator';
import { StrategyRegistry } from '../../registry/strategy.registry';
import { IStrategy, StrategyType, SignalAction } from '@crypto-strategy-lab/shared';
import { CompositeStrategy } from '../../composite/composite.strategy';

describe('DomainGuidedGenerator', () => {
  let registry: StrategyRegistry;
  let generator: DomainGuidedGenerator;

  beforeEach(() => {
    registry = new StrategyRegistry();
    generator = new DomainGuidedGenerator(registry);
  });

  it('should return empty array if no strategies registered', () => {
    const result = generator.generate(5);
    expect(result).toEqual([]);
  });

  it('should generate composites combining diverse domains', () => {
    // Register fake strategies across different domains
    const createMockStrategy = (name: string, type: StrategyType): IStrategy => ({
      getName: jest.fn().mockReturnValue(name),
      getType: jest.fn().mockReturnValue(type),
      getParameters: jest.fn().mockReturnValue({}),
      analyze: jest.fn().mockReturnValue({ action: SignalAction.HOLD, confidence: 0 }),
    });

    registry.register(createMockStrategy('MockMA', StrategyType.MA));             // Trend
    registry.register(createMockStrategy('MockRSI', StrategyType.RSI));           // Momentum
    registry.register(createMockStrategy('MockBoll', StrategyType.BOLLINGER));    // Volatility
    registry.register(createMockStrategy('MockSR', StrategyType.SR));             // Structure
    registry.register(createMockStrategy('MockSent', StrategyType.SENTIMENT));    // Information

    const count = 10;
    const composites = generator.generate(count) as CompositeStrategy[];

    expect(composites.length).toBe(count);

    composites.forEach(composite => {
      expect(composite.getType()).toBe(StrategyType.COMPOSITE);
      const params = composite.getParameters();
      const childCount = params.childCount as number;
      // It should combine 2 to 3 domains
      expect(childCount).toBeGreaterThanOrEqual(2);
      expect(childCount).toBeLessThanOrEqual(3);
    });
  });

  it('should alternate between MajorityVote and WeightedScore combiners', () => {
    const createMockStrategy = (name: string, type: StrategyType): IStrategy => ({
      getName: jest.fn().mockReturnValue(name),
      getType: jest.fn().mockReturnValue(type),
      getParameters: jest.fn().mockReturnValue({}),
      analyze: jest.fn().mockReturnValue({ action: SignalAction.HOLD, confidence: 0 }),
    });

    registry.register(createMockStrategy('MockMA', StrategyType.MA));
    registry.register(createMockStrategy('MockRSI', StrategyType.RSI));

    const composites = generator.generate(4) as CompositeStrategy[];
    expect(composites.length).toBe(4);

    expect(composites[0].getParameters().combinerType).toBe('MajorityVote');
    expect(composites[1].getParameters().combinerType).toBe('WeightedScore');
    expect(composites[2].getParameters().combinerType).toBe('MajorityVote');
    expect(composites[3].getParameters().combinerType).toBe('WeightedScore');
  });
});
