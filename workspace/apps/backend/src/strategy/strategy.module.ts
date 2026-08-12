// StrategyModule — plugin registry, strategies, composite, backtester, evaluator, search
// Owner: Huy
// See: kb/modules/strategy-engine.md, kb/contracts/strategy.yaml, ADR-0003, ADR-0008

import { Module } from '@nestjs/common';
import { StrategyRegistry } from './registry/strategy.registry';

import {
  MovingAverageStrategy,
  RsiStrategy,
  BollingerBandsStrategy,
  SupportResistanceStrategy,
} from './strategies';

import { BacktesterService } from './backtester';
import { EvaluatorService } from './evaluator';
import { RandomGenerator, DomainGuidedGenerator } from './generators';
import { StrategyVersioningService } from './versioning';
import { EventBusService } from './events';
import { StrategyController } from './controllers';

@Module({
  controllers: [StrategyController],
  providers: [
    StrategyRegistry,
    MovingAverageStrategy,
    RsiStrategy,
    BollingerBandsStrategy,
    SupportResistanceStrategy,
    BacktesterService,
    EvaluatorService,
    RandomGenerator,
    DomainGuidedGenerator,
    StrategyVersioningService,
    EventBusService,
  ],
  exports: [
    StrategyRegistry,
    BacktesterService,
    EvaluatorService,
    RandomGenerator,
    DomainGuidedGenerator,
    StrategyVersioningService,
    EventBusService,
  ],
})
export class StrategyModule {}
