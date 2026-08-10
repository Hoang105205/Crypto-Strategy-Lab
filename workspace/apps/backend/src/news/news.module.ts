// NewsModule — news providers, sentiment service client, sentiment strategy plugin
// Owner: Thuan
// See: kb/modules/news-sentiment.md, kb/contracts/news.yaml

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';

import { INEWS_PROVIDER_TOKEN } from './providers/news.provider.interface';
import { RSSProvider } from './providers/rss.provider';
import { WebCrawlerProvider } from './providers/crawler.provider';
import { NewsService } from './services/news.service';
import { SentimentClient } from './services/sentiment.client';
import { NewsCollectorCron } from './cron/news-collector.cron';

@Module({
  imports: [
    DatabaseModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    RSSProvider,
    WebCrawlerProvider,
    {
      provide: INEWS_PROVIDER_TOKEN,
      useFactory: (rss: RSSProvider, crawler: WebCrawlerProvider) => [rss, crawler],
      inject: [RSSProvider, WebCrawlerProvider],
    },
    SentimentClient,
    NewsService,
    NewsCollectorCron,
  ],
  controllers: [],
  exports: [NewsService, SentimentClient],
})
export class NewsModule {}
