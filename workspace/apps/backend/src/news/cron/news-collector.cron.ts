// NewsCollectorCron — Cron job for periodic news collection
// Owner: Thuan | See: kb/modules/news-sentiment.md

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NEWS_COLLECTION_CRON_SCHEDULE } from '@crypto-strategy-lab/shared';
import { NewsService } from '../services/news.service';

@Injectable()
export class NewsCollectorCron implements OnApplicationBootstrap {
  private readonly logger = new Logger(NewsCollectorCron.name);

  constructor(private readonly newsService: NewsService) {}

  /**
   * Run initial news collection when application starts up
   */
  async onApplicationBootstrap() {
    this.logger.log('Application bootstrap: executing initial news collection...');
    await this.handleCron();
  }

  /**
   * Periodic cron job executing every 15 minutes
   */
  @Cron(NEWS_COLLECTION_CRON_SCHEDULE)
  async handleCron() {
    this.logger.log('Executing scheduled news collection cron job...');
    try {
      const articles = await this.newsService.collectAllNews();
      this.logger.log(`Scheduled news collection finished. Processed ${articles.length} articles.`);
    } catch (error) {
      this.logger.error(`Error during scheduled news collection: ${error.message}`);
    }
  }
}
