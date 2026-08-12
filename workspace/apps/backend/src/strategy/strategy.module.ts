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

import { CompositeStrategy } from './composite';
import { BacktesterService } from './backtester';
import { EvaluatorService } from './evaluator';
import { RandomGenerator, DomainGuidedGenerator } from './generators';
import { StrategyVersioningService } from './versioning';

@Module({
  providers: [
    StrategyRegistry,
    MovingAverageStrategy,
    RsiStrategy,
    BollingerBandsStrategy,
    SupportResistanceStrategy,
    CompositeStrategy,
    BacktesterService,
    EvaluatorService,
    RandomGenerator,
    DomainGuidedGenerator,
    StrategyVersioningService,
  ],
  exports: [
    StrategyRegistry,
    CompositeStrategy,
    BacktesterService,
    EvaluatorService,
    RandomGenerator,
    DomainGuidedGenerator,
    StrategyVersioningService,
  ],
})
export class StrategyModule {}
