// NewsModule — news providers, sentiment service client, sentiment strategy plugin
// Owner: Thuan
// See: kb/modules/news-sentiment.md, kb/contracts/news.yaml

import { Module, OnModuleInit, Optional } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';

import { INEWS_PROVIDER_TOKEN } from './providers/news.provider.interface';
import { RSSProvider } from './providers/rss.provider';
import { WebCrawlerProvider } from './providers/crawler.provider';
import { NewsService } from './services/news.service';
import { CrawlerDiscoveryService } from './services/crawler-discovery.service';
import { SentimentClient } from './services/sentiment.client';
import { NewsCollectorCron } from './cron/news-collector.cron';
import { NewsController } from './news.controller';
import { NewsSentimentStrategy } from './strategies/sentiment.strategy';
import { StrategyRegistry } from '../strategy/registry/strategy.registry';
import { StrategyRuntimeModule } from '../strategy/strategy-runtime.module';

@Module({
  imports: [DatabaseModule, ScheduleModule.forRoot(), StrategyRuntimeModule],
  providers: [
    CrawlerDiscoveryService,
    RSSProvider,
    WebCrawlerProvider,
    {
      provide: INEWS_PROVIDER_TOKEN,
      useFactory: (rss: RSSProvider, crawler: WebCrawlerProvider) => [
        rss,
        crawler,
      ],
      inject: [RSSProvider, WebCrawlerProvider],
    },
    SentimentClient,
    NewsService,
    NewsCollectorCron,
    NewsSentimentStrategy,
  ],
  controllers: [NewsController],
  exports: [
    NewsService,
    CrawlerDiscoveryService,
    SentimentClient,
    NewsSentimentStrategy,
  ],
})
export class NewsModule implements OnModuleInit {
  constructor(
    private readonly sentimentStrategy: NewsSentimentStrategy,
    @Optional() private readonly strategyRegistry?: StrategyRegistry,
  ) {}

  onModuleInit() {
    if (this.strategyRegistry) {
      this.strategyRegistry.register(this.sentimentStrategy);
    }
  }
}
