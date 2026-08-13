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
import { RandomGenerator, DomainGuidedGenerator, SearchEngine } from './search';
import { StrategyVersioningService } from './versioning';
import { EventBusService } from './events';
import { StrategyController } from './controllers';

import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
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
    SearchEngine,
    StrategyVersioningService,
    EventBusService,
  ],
  exports: [
    StrategyRegistry,
    BacktesterService,
    EvaluatorService,
    RandomGenerator,
    DomainGuidedGenerator,
    SearchEngine,
    StrategyVersioningService,
    EventBusService,
  ],
})
export class StrategyModule {}
