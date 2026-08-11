// WebCrawlerProvider — Custom Web Crawler Adapter implementing INewsProvider
// Owner: Thuan | See: ADR-0010, Section 28 compliance

import { Injectable, Logger } from '@nestjs/common';
import { RawArticle, DEFAULT_NEWS_FETCH_LIMIT } from '@crypto-strategy-lab/shared';
import { INewsProvider } from './news.provider.interface';

@Injectable()
export class WebCrawlerProvider implements INewsProvider {
  private readonly logger = new Logger(WebCrawlerProvider.name);

  // Mock web crawler payloads for news portal crawling
  private readonly crawlerArticles: RawArticle[] = [
    {
      source: 'Crypto Portal WebCrawler',
      title: 'Federal Reserve Monetary Policy Outlook Drives Crypto Volatility',
      content: 'Traders closely analyze central bank interest rate projections as digital asset markets adjust risk exposure.',
      url: 'https://cryptoportal.io/news/fed-rate-projections-2026',
      publishedAt: new Date(Date.now() - 5400000).toISOString(),
      relatedCoins: ['BTC', 'ETH'],
    },
    {
      source: 'Crypto Portal WebCrawler',
      title: 'Major Exchange Announces Institutional Staking Infrastructure Upgrade',
      content: 'Security enhancements and zero-knowledge proof verification deployed for enterprise staking clients.',
      url: 'https://cryptoportal.io/news/exchange-staking-upgrade',
      publishedAt: new Date(Date.now() - 9000000).toISOString(),
      relatedCoins: ['ETH'],
    },
  ];

  async fetchLatest(limit: number = DEFAULT_NEWS_FETCH_LIMIT, coin?: string): Promise<RawArticle[]> {
    try {
      this.logger.log(`Executing web crawler for news portals (limit: ${limit}, coin: ${coin ?? 'ALL'})`);

      let articles = [...this.crawlerArticles];

      if (coin) {
        articles = articles.filter(a =>
          a.relatedCoins?.some(c => c.toUpperCase() === coin.toUpperCase())
        );
      }

      return articles.slice(0, limit);
    } catch (error) {
      this.logger.error(`Failed to crawl web news portals: ${error.message}`);
      // Fault Isolation per ADR-0010: Return empty array on error
      return [];
    }
  }
}
