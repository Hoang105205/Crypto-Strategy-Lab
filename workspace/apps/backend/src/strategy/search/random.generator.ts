import { Injectable } from '@nestjs/common';
import type { IStrategyGenerator, IStrategy } from '@crypto-strategy-lab/shared';
import { StrategyRegistry } from '../registry/strategy.registry';
import { CompositeStrategy } from '../composite/composite.strategy';
import { MajorityVoteCombiner } from '../combiners/majority-vote.combiner';
import { WeightedScoreCombiner } from '../combiners/weighted-score.combiner';

@Injectable()
export class RandomGenerator implements IStrategyGenerator {
  constructor(private readonly registry?: StrategyRegistry) {}

  /**
   * Generate random composite strategy candidates from ALL registered strategies.
   * Uses the StrategyRegistry to discover available strategies dynamically,
   * so newly registered strategies (MACD, Stochastic, ATR, etc.) are included
   * without any code changes — demonstrating the Plugin Architecture (ADR-0003).
   */
  generate(count: number): IStrategy[] {
    const strategies: IStrategy[] = [];
    const dummyRegistry = this.registry || new StrategyRegistry();

    // Dynamically discover all registered strategies from the registry
    const allStrategies = dummyRegistry.getAll();
    if (allStrategies.length === 0) {
      return [];
    }

    for (let i = 0; i < count; i++) {
      // Pick 2-3 random strategies to combine into a composite
      const numChildren = Math.min(allStrategies.length, Math.floor(Math.random() * 2) + 2);
      const shuffled = [...allStrategies].sort(() => 0.5 - Math.random());
      const children = shuffled.slice(0, numChildren);

      // Alternate between combiner types
      const combinerWeights: Record<string, number> = {};
      children.forEach((child) => {
        combinerWeights[child.getName()] = 1 + Math.random();
      });

      const combiner = i % 2 === 0
        ? new MajorityVoteCombiner()
        : new WeightedScoreCombiner(combinerWeights);

      const compositeName = `RandomComposite_${children.map((c) => c.getName()).join('_')}_${i + 1}`;
      const composite = new CompositeStrategy(compositeName, children, combiner, dummyRegistry);
      strategies.push(composite);
    }

    return strategies;
  }
}
