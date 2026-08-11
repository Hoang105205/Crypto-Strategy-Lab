// NewsController — REST API endpoints for News Feed and Aggregate Sentiment
// Owner: Thuan | See: contracts/news-api.md & kb/contracts/news.yaml

import { Controller, Get, Query } from '@nestjs/common';
import { NewsService } from './services/news.service';
import { DEFAULT_NEWS_FETCH_LIMIT } from '@crypto-strategy-lab/shared';

@Controller('api')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  /**
   * GET /api/news
   * Query params: limit (number, default: 10), coin (string, e.g. 'BTC')
   */
  @Get('news')
  async getNews(
    @Query('limit') limitStr?: string,
    @Query('coin') coin?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : DEFAULT_NEWS_FETCH_LIMIT;
    const articles = await this.newsService.getLatestNews(limit, coin);
    return {
      success: true,
      data: articles,
    };
  }

  /**
   * GET /api/sentiment/aggregate
   * Query params: coin (string, e.g. 'BTC'), timeframe (string, default: '1h', enum: ['1h', '24h', '7d'])
   */
  @Get('sentiment/aggregate')
  async getAggregateSentiment(
    @Query('coin') coin?: string,
    @Query('timeframe') timeframe: string = '1h',
  ) {
    const result = await this.newsService.getAggregateSentiment(coin, timeframe);
    return result;
  }
}
