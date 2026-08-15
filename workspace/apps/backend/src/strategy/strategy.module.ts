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
  MacdStrategy,
  StochasticStrategy,
  AtrStrategy,
} from './strategies';

import { BacktesterService } from './backtester';
import { EvaluatorService } from './evaluator';
import { RandomGenerator, DomainGuidedGenerator, SearchEngine } from './search';
import { StrategyVersioningService } from './versioning';
import { StrategyController } from './controllers';

import { DatabaseModule } from '../database/database.module';
import { EventsModule } from '../events/events.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [DatabaseModule, EventsModule, QueueModule],
  controllers: [StrategyController],
  providers: [
    StrategyRegistry,
    MovingAverageStrategy,
    RsiStrategy,
    BollingerBandsStrategy,
    SupportResistanceStrategy,
    MacdStrategy,
    StochasticStrategy,
    AtrStrategy,
    BacktesterService,
    EvaluatorService,
    RandomGenerator,
    DomainGuidedGenerator,
    SearchEngine,
    StrategyVersioningService,
  ],
  exports: [
    StrategyRegistry,
    BacktesterService,
    EvaluatorService,
    RandomGenerator,
    DomainGuidedGenerator,
    SearchEngine,
    StrategyVersioningService,
  ],
})
export class StrategyModule {}
