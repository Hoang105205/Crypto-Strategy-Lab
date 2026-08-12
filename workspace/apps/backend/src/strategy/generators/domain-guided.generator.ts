import { Injectable } from '@nestjs/common';
import type { IStrategyGenerator, IStrategy } from '@crypto-strategy-lab/shared';
import { MovingAverageStrategy } from '../strategies/moving-average.strategy';
import { RsiStrategy } from '../strategies/rsi.strategy';
import { CompositeStrategy } from '../composite/composite.strategy';
import { MajorityVoteCombiner } from '../combiners/majority-vote.combiner';
import { WeightedScoreCombiner } from '../combiners/weighted-score.combiner';
import { StrategyRegistry } from '../registry/strategy.registry';

@Injectable()
export class DomainGuidedGenerator implements IStrategyGenerator {
  constructor(private readonly registry?: StrategyRegistry) {}

  generate(count: number): IStrategy[] {
    const strategies: IStrategy[] = [];
    const dummyRegistry = this.registry || new StrategyRegistry();

    for (let i = 0; i < count; i++) {
      const ma = new MovingAverageStrategy(dummyRegistry);
      const rsi = new RsiStrategy(dummyRegistry);

      // Alternating combiners based on domain knowledge (Trend + Momentum pairing)
      const combiner = i % 2 === 0
        ? new MajorityVoteCombiner()
        : new WeightedScoreCombiner({ 'MovingAverage': 1.5, 'RelativeStrengthIndex': 1.0 });

      const composite = new CompositeStrategy(
        `DomainComposite_${i + 1}`,
        [ma, rsi],
        combiner,
        dummyRegistry,
      );

      strategies.push(composite);
    }

    return strategies;
  }
}
