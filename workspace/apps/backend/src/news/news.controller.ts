// NewsController — REST API endpoints for News Feed and Aggregate Sentiment
// Owner: Thuan | See: contracts/news-api.md & kb/contracts/news.yaml

import {
  Controller,
  Get,
  Post,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { NewsService } from './services/news.service';
import {
  DEFAULT_NEWS_FETCH_LIMIT,
  MANUAL_CRAWL_COOLDOWN_MS,
} from '@crypto-strategy-lab/shared';

@Controller('api')
export class NewsController {
  private lastManualCrawlTimestamp: number = 0;

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
    const rawLimit = limitStr
      ? parseInt(limitStr, 10)
      : DEFAULT_NEWS_FETCH_LIMIT;
    const limit = Math.min(
      Math.max(isNaN(rawLimit) ? DEFAULT_NEWS_FETCH_LIMIT : rawLimit, 1),
      50,
    );
    const offset = offsetStr ? Math.max(parseInt(offsetStr, 10) || 0, 0) : 0;
    const coins = coinsStr
      ? coinsStr
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : undefined;

    const targetCoin = coin && coin.toUpperCase() !== 'ALL' ? coin : undefined;
    const result = await this.newsService.getLatestNews(
      limit,
      offset,
      targetCoin,
      coins,
    );
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
      ? coinsStr
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : undefined;

    const validTimeframes = ['1h', '24h', '7d'];
    const activeTimeframe = validTimeframes.includes(timeframe)
      ? timeframe
      : '24h';

    const targetCoin = coin && coin.toUpperCase() !== 'ALL' ? coin : undefined;
    const result = await this.newsService.getAggregateSentiment(
      targetCoin,
      activeTimeframe,
      coins,
    );
    return result;
  }

  /**
   * POST /api/news/crawl
   * Manually trigger on-demand news collection across registered providers.
   * Rate limiting: 120s cooldown. Returns HTTP 429 if called during cooldown.
   * Concurrency: Mutex lock. Returns HTTP 409 if a crawl is currently active.
   */
  @Post('news/crawl')
  async triggerManualCrawl() {
    const now = Date.now();
    const elapsed = now - this.lastManualCrawlTimestamp;

    // 1. Rate-limiting Cooldown Check (120 seconds)
    if (this.lastManualCrawlTimestamp > 0 && elapsed < MANUAL_CRAWL_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil(
        (MANUAL_CRAWL_COOLDOWN_MS - elapsed) / 1000,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Rate limit exceeded. Please wait before crawling again.',
          retryAfterSeconds: remainingSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2. Mutex Lock Check
    if (this.newsService.isCrawlInProgress()) {
      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          error: 'Crawl in progress. Please wait for current execution to finish.',
        },
        HttpStatus.CONFLICT,
      );
    }

    // 3. Mark timestamp and execute crawl
    this.lastManualCrawlTimestamp = now;
    try {
      const result = await this.newsService.triggerManualCrawl();
      return result;
    } catch (error) {
      // If error occurred before or during execution, reset timestamp to allow immediate retry
      this.lastManualCrawlTimestamp = 0;
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `News collection failed: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/news/rescore
   * Re-score all historical articles that currently have score 0.0 or label NEUTRAL
   * (useful when Python Sentiment Service was started after initial ingestion).
   */
  @Post('news/rescore')
  async triggerRescore(@Query('limit') limitStr?: string) {
    const limit = limitStr ? parseInt(limitStr, 10) || 300 : 300;
    const result = await this.newsService.rescoreUnscoredNews(limit);
    return {
      success: true,
      message: `Successfully re-scored ${result.rescoredCount} of ${result.processedCount} articles with live VADER model.`,
      data: result,
    };
  }
}

