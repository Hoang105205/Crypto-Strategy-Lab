// WebCrawlerProvider — Custom Web Crawler Adapter implementing INewsProvider
// Owner: Thuan | See: ADR-0010, Section 28 compliance

import { Injectable, Logger } from '@nestjs/common';
import { RawArticle, DEFAULT_NEWS_FETCH_LIMIT } from '@crypto-strategy-lab/shared';
import { INewsProvider } from './news.provider.interface';

@Injectable()
export class WebCrawlerProvider implements INewsProvider {
  private readonly logger = new Logger(WebCrawlerProvider.name);

  async fetchLatest(limit: number = DEFAULT_NEWS_FETCH_LIMIT, coin?: string): Promise<RawArticle[]> {
    try {
      this.logger.log(`Executing web crawler for news portals (limit: ${limit}, coin: ${coin ?? 'ALL'})`);

      // Web crawler integration placeholder: return [] cleanly when no external crawler daemon is running
      // Fault Isolation per ADR-0010: Return empty array on empty/error
      return [];
    } catch (error) {
      this.logger.error(`Failed to crawl web news portals: ${error.message}`);
      return [];
    }
  }
}
