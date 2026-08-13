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
   * Query params:
   *   - limit (number, default: 10)
   *   - offset (number, default: 0) — for offset-based pagination / Load More
   *   - coin (string, e.g. 'BTC') — single coin filter
   *   - coins (string, e.g. 'BTC,ETH') — comma-separated multi-coin filter
   */
  @Get('news')
  async getNews(
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Query('coin') coin?: string,
    @Query('coins') coinsStr?: string,
  ) {
    const rawLimit = limitStr ? parseInt(limitStr, 10) : DEFAULT_NEWS_FETCH_LIMIT;
    const limit = Math.min(Math.max(isNaN(rawLimit) ? DEFAULT_NEWS_FETCH_LIMIT : rawLimit, 1), 50);
    const offset = offsetStr ? Math.max(parseInt(offsetStr, 10) || 0, 0) : 0;
    const coins = coinsStr
      ? coinsStr.split(',').map((c) => c.trim()).filter(Boolean)
      : undefined;

    const targetCoin = coin && coin.toUpperCase() !== 'ALL' ? coin : undefined;
    const result = await this.newsService.getLatestNews(limit, offset, targetCoin, coins);
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  /**
   * GET /api/sentiment/aggregate
   * Query params:
   *   - coin (string, e.g. 'BTC') — single coin filter
   *   - coins (string, e.g. 'BTC,ETH') — multi-coin filter
   *   - timeframe (string, default: '1h', enum: ['1h', '24h', '7d'])
   */
  @Get('sentiment/aggregate')
  async getAggregateSentiment(
    @Query('coin') coin?: string,
    @Query('coins') coinsStr?: string,
    @Query('timeframe') timeframe: string = '24h',
  ) {
    const coins = coinsStr
      ? coinsStr.split(',').map((c) => c.trim()).filter(Boolean)
      : undefined;

    const validTimeframes = ['1h', '24h', '7d'];
    const activeTimeframe = validTimeframes.includes(timeframe) ? timeframe : '24h';

    const targetCoin = coin && coin.toUpperCase() !== 'ALL' ? coin : undefined;
    const result = await this.newsService.getAggregateSentiment(targetCoin, activeTimeframe, coins);
    return result;
  }
}
