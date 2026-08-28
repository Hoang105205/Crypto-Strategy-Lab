// LoopModule — strategy search loop controller, bounded stop conditions
// Owner: Phuong
// See: kb/flows/strategy-search-loop.md, kb/contracts/events.yaml

import {
  Inject,
  Logger,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  EventType,
  type EventSubscription,
  type IEventBus,
} from '@crypto-strategy-lab/shared';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { EventsModule } from '../events/events.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { QueueModule } from '../queue/queue.module';
import { IEVENT_BUS } from '../shared/tokens';
import { StrategyModule } from '../strategy/strategy.module';
import { LoopController } from './loop.controller';
import { LoopRepository } from './loop.repository';
import { LoopStatusService } from './loop-status.service';
import { StrategyLoopService } from './strategy-loop.service';
import { SearchLoopControlRepository } from './search-loop-control.repository';
import { SearchLoopControlService } from './search-loop-control.service';
import { SearchLoopSupervisorService } from './search-loop-supervisor.service';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    EventsModule,
    QueueModule,
    StrategyModule,
    LeaderboardModule,
  ],
  controllers: [LoopController],
  providers: [
    LoopRepository,
    LoopStatusService,
    StrategyLoopService,
    SearchLoopControlRepository,
    SearchLoopControlService,
    SearchLoopSupervisorService,
  ],
  exports: [
    LoopStatusService,
    StrategyLoopService,
    SearchLoopControlService,
  ],
})
export class LoopModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LoopModule.name);
  private readonly subscriptions: EventSubscription[] = [];
  private initialized = false;

  constructor(
    @Inject(IEVENT_BUS) private readonly eventBus: IEventBus,
    private readonly loop: StrategyLoopService,
    private readonly status: LoopStatusService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    this.subscriptions.push(
      this.eventBus.subscribe(EventType.BacktestCompleted, (envelope) =>
        this.loop.handleBacktestCompleted(envelope),
      ),
      this.eventBus.subscribe(EventType.BacktestFailed, (envelope) =>
        this.loop.handleBacktestFailed(envelope),
      ),
    );

    try {
      await this.status.reconcileAfterRestart();
    } catch (error: unknown) {
      if (hasErrorCode(error, 'QUEUE_UNAVAILABLE')) {
        this.logger.warn(
          'Search Loop restart reconciliation deferred: queue unavailable',
        );
        return;
      }

      this.cleanupSubscriptions();
      this.initialized = false;
      throw error;
    }
  }

  onModuleDestroy(): void {
    this.cleanupSubscriptions();
  }

  private cleanupSubscriptions(): void {
    for (const subscription of this.subscriptions.splice(0)) {
      try {
        this.eventBus.unsubscribe(subscription);
      } catch (error: unknown) {
        this.logger.error(
          'Failed to clean Search Loop event subscription',
          error,
        );
      }
    }
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
