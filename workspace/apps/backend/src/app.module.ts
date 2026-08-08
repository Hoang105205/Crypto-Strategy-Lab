import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

import { DatabaseModule } from './database/database.module';
import { SharedModule } from './shared/shared.module';
import { MarketDataModule } from './market-data/market-data.module';
import { StrategyModule } from './strategy/strategy.module';
import { NewsModule } from './news/news.module';
import { EventsModule } from './events/events.module';
import { QueueModule } from './queue/queue.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { LoopModule } from './loop/loop.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DatabaseModule,
    SharedModule,
    MarketDataModule,
    StrategyModule,
    NewsModule,
    EventsModule,
    QueueModule,
    LeaderboardModule,
    LoopModule,
    DashboardModule,
  ],
})
export class AppModule {}
