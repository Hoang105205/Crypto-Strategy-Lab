import { Injectable } from '@nestjs/common';
import type { IStrategyGenerator, IStrategy } from '@crypto-strategy-lab/shared';
import { StrategyType } from '@crypto-strategy-lab/shared';
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

    // Lấy toàn bộ các strategy đã được đăng ký
    const allStrategies = dummyRegistry.getAll();
    if (allStrategies.length === 0) {
      return [];
    }

    // Phân loại chiến lược theo Domain
    const domainMap: Record<string, IStrategy[]> = {
      Trend: [],
      Momentum: [],
      Volatility: [],
      Structure: [],
      Information: [],
    };

    allStrategies.forEach((strategy) => {
      const type = strategy.getType();
      if ([StrategyType.MA, StrategyType.MACD].includes(type)) {
        domainMap.Trend.push(strategy);
      } else if ([StrategyType.RSI, StrategyType.STOCHASTIC].includes(type)) {
        domainMap.Momentum.push(strategy);
      } else if ([StrategyType.BOLLINGER, StrategyType.ATR].includes(type)) {
        domainMap.Volatility.push(strategy);
      } else if ([StrategyType.SR].includes(type)) {
        domainMap.Structure.push(strategy);
      } else if ([StrategyType.SENTIMENT].includes(type)) {
        domainMap.Information.push(strategy);
      }
    });

    const activeDomains = Object.keys(domainMap).filter((d) => domainMap[d].length > 0);
    
    if (activeDomains.length === 0) {
      return [];
    }

    // Sinh ngẫu nhiên các chiến lược kết hợp
    for (let i = 0; i < count; i++) {
      // Chọn ngẫu nhiên 2 đến 3 domain khác nhau để kết hợp
      const numDomainsToCombine = Math.min(activeDomains.length, Math.floor(Math.random() * 2) + 2); 
      
      const shuffledDomains = [...activeDomains].sort(() => 0.5 - Math.random());
      const selectedDomains = shuffledDomains.slice(0, numDomainsToCombine);
      
      const childStrategies: IStrategy[] = [];
      const combinerWeights: Record<string, number> = {};

      selectedDomains.forEach((domain, idx) => {
        const domainStrats = domainMap[domain];
        const randomStrategy = domainStrats[Math.floor(Math.random() * domainStrats.length)];
        childStrategies.push(randomStrategy);
        
        // Gán trọng số ngẫu nhiên cho WeightedScore
        combinerWeights[randomStrategy.getName()] = 1 + Math.random();
      });

      // Alternating combiners
      const combiner = i % 2 === 0
        ? new MajorityVoteCombiner()
        : new WeightedScoreCombiner(combinerWeights);

      const compositeName = `DomainComposite_${selectedDomains.join('_')}_${i + 1}`;
      
      const composite = new CompositeStrategy(
        compositeName,
        childStrategies,
        combiner,
        dummyRegistry,
      );

      strategies.push(composite);
    }

    return strategies;
  }
}
