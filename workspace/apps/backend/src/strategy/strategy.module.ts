// StrategyModule — plugin registry, strategies, composite, backtester, evaluator, search
// Owner: Huy
// See: kb/modules/strategy-engine.md, kb/contracts/strategy.yaml, ADR-0003, ADR-0008

import { Module } from '@nestjs/common';
import { RandomGenerator, DomainGuidedGenerator, SearchEngine } from './search';
import { StrategyController } from './controllers';

import { EventsModule } from '../events/events.module';
import { QueueModule } from '../queue/queue.module';
import { DatabaseModule } from '../database/database.module';
import { StrategyRuntimeModule } from './strategy-runtime.module';

@Module({
  imports: [DatabaseModule, StrategyRuntimeModule, EventsModule, QueueModule],
  controllers: [StrategyController],
  providers: [
    RandomGenerator,
    DomainGuidedGenerator,
    SearchEngine,
  ],
  exports: [
    StrategyRuntimeModule,
    RandomGenerator,
    DomainGuidedGenerator,
    SearchEngine,
  ],
})
export class StrategyModule {}
