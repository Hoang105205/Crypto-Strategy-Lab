import { Injectable } from '@nestjs/common';
import type { IStrategyGenerator, IStrategy } from '@crypto-strategy-lab/shared';
import { MovingAverageStrategy } from '../strategies/moving-average.strategy';
import { RsiStrategy } from '../strategies/rsi.strategy';
import { BollingerBandsStrategy } from '../strategies/bollinger-bands.strategy';
import { SupportResistanceStrategy } from '../strategies/support-resistance.strategy';
import { StrategyRegistry } from '../registry/strategy.registry';

@Injectable()
export class RandomGenerator implements IStrategyGenerator {
  constructor(private readonly registry?: StrategyRegistry) {}

  generate(count: number): IStrategy[] {
    const strategies: IStrategy[] = [];
    const dummyRegistry = this.registry || new StrategyRegistry();

    for (let i = 0; i < count; i++) {
      const choice = Math.floor(Math.random() * 4);
      switch (choice) {
        case 0:
          strategies.push(new MovingAverageStrategy(dummyRegistry));
          break;
        case 1:
          strategies.push(new RsiStrategy(dummyRegistry));
          break;
        case 2:
          strategies.push(new BollingerBandsStrategy(dummyRegistry));
          break;
        case 3:
          strategies.push(new SupportResistanceStrategy(dummyRegistry));
          break;
      }
    }

    return strategies;
  }
}
