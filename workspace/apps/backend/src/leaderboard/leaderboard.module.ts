// LeaderboardModule — top-K ranking, Observer pattern for BacktestCompleted
// Owner: Phuong
// See: kb/modules/event-infrastructure.md, kb/contracts/events.yaml

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import { EventsModule } from '../events/events.module';
import { StrategyRuntimeModule } from '../strategy/strategy-runtime.module';
import { LeaderboardController } from './leaderboard.controller';
import {
  DEFAULT_LEADERBOARD_TOP_K,
  LeaderboardRepository,
} from './leaderboard.repository';
import { LeaderboardService } from './leaderboard.service';
import { ScoringPolicy } from './scoring-policy';

@Module({
  imports: [ConfigModule, DatabaseModule, EventsModule, StrategyRuntimeModule],
  controllers: [LeaderboardController],
  providers: [
    ScoringPolicy,
    {
      provide: LeaderboardRepository,
      inject: [PrismaService, ConfigService],
      useFactory: (
        prisma: PrismaService,
        config: ConfigService,
      ): LeaderboardRepository =>
        new LeaderboardRepository(
          prisma,
          config.get<number>('LEADERBOARD_TOP_K', DEFAULT_LEADERBOARD_TOP_K),
        ),
    },
    LeaderboardService,
  ],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
