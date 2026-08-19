// StrategyModule — plugin registry, strategies, composite, backtester, evaluator, search
// Owner: Huy
// See: kb/modules/strategy-engine.md, kb/contracts/strategy.yaml, ADR-0003, ADR-0008

import { Module } from '@nestjs/common';
import { RandomGenerator, DomainGuidedGenerator, SearchEngine } from './search';
import { StrategyController } from './controllers';

import { EventsModule } from '../events/events.module';
import { QueueModule } from '../queue/queue.module';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { ISTRATEGY_CANDIDATE_PORT, ISTRATEGY_GENERATOR } from '../shared/tokens';
import { StrategyCandidatePort } from './ports';
import { StrategyRuntimeModule } from './strategy-runtime.module';

@Module({
  imports: [DatabaseModule, StrategyRuntimeModule, EventsModule, QueueModule, AuthModule],
  controllers: [StrategyController],
  providers: [
    RandomGenerator,
    DomainGuidedGenerator,
    {
      provide: ISTRATEGY_GENERATOR,
      useFactory: (random: RandomGenerator, domain: DomainGuidedGenerator) => {
        return new Map<string, any>([
          ['RANDOM', random],
          ['DOMAIN_GUIDED', domain],
        ]);
      },
      inject: [RandomGenerator, DomainGuidedGenerator],
    },
    SearchEngine,
    StrategyCandidatePort,
    {
      provide: ISTRATEGY_CANDIDATE_PORT,
      useExisting: StrategyCandidatePort,
    },
  ],
  exports: [
    StrategyRuntimeModule,
    RandomGenerator,
    DomainGuidedGenerator,
    SearchEngine,
    ISTRATEGY_CANDIDATE_PORT,
  ],
})
export class StrategyModule {}
