// DashboardModule — BFF controllers for frontend, REST + WebSocket gateway
// Owner: Phuong
// See: kb/modules/event-infrastructure.md (Section 7 Dashboard API)

import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { LoopModule } from '../loop/loop.module';
import { QueueModule } from '../queue/queue.module';
import { InfrastructureErrorFilter } from '../shared/infrastructure-error.filter';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PushGateway } from './push.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    EventsModule,
    LeaderboardModule,
    LoopModule,
    QueueModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService, PushGateway, InfrastructureErrorFilter],
})
export class DashboardModule {}
