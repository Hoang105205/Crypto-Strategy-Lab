import { RandomGenerator } from '../random.generator';
import { DomainGuidedGenerator } from '../domain-guided.generator';
import { StrategyType } from '@crypto-strategy-lab/shared';

describe('Strategy Generators', () => {
  it('RandomGenerator should yield requested number of valid strategy instances', () => {
    const generator = new RandomGenerator();
    const strategies = generator.generate(5);
    expect(strategies).toHaveLength(5);
    for (const strat of strategies) {
      expect(strat.getName()).toBeDefined();
      expect(strat.getType()).toBeDefined();
    }
  });

  it('DomainGuidedGenerator should yield Composite strategy instances', () => {
    const generator = new DomainGuidedGenerator();
    const strategies = generator.generate(3);
    expect(strategies).toHaveLength(3);
    for (const strat of strategies) {
      expect(strat.getType()).toBe(StrategyType.COMPOSITE);
    }
  });
});
