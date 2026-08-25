// NewsController Unit Tests — On-demand crawl, 120s cooldown, Mutex concurrency, and Sentiment Distribution Ratios
// Owner: Thuan | SSoT: kb/contracts/news.yaml & spec.md

import { Test, TestingModule } from '@nestjs/testing';
import { NewsController } from './news.controller';
import { NewsService } from './services/news.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SentimentLabel } from '@crypto-strategy-lab/shared';

describe('NewsController', () => {
  let controller: NewsController;
  let mockNewsService: Partial<NewsService>;

  beforeEach(async () => {
    mockNewsService = {
      getLatestNews: jest.fn().mockResolvedValue({
        data: [],
        pagination: { total: 0, limit: 10, offset: 0, hasMore: false },
      }),
      getAggregateSentiment: jest.fn().mockResolvedValue({
        score: 0.45,
        label: SentimentLabel.POSITIVE,
        articleCount: 10,
        positiveCount: 6,
        neutralCount: 3,
        negativeCount: 1,
        positiveRatio: 60.0,
        neutralRatio: 30.0,
        negativeRatio: 10.0,
        updatedAt: new Date().toISOString(),
      }),
      isCrawlInProgress: jest.fn().mockReturnValue(false),
      triggerManualCrawl: jest.fn().mockResolvedValue({
        success: true,
        count: 5,
        message: 'Successfully ingested and analyzed 5 news articles.',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NewsController],
      providers: [
        {
          provide: NewsService,
          useValue: mockNewsService,
        },
      ],
    }).compile();

    controller = module.get<NewsController>(NewsController);
  });

  describe('GET /api/sentiment/aggregate', () => {
    it('should return aggregate sentiment score along with 3-color distribution breakdown ratios', async () => {
      const result = await controller.getAggregateSentiment('BTC', undefined, '24h');

      expect(mockNewsService.getAggregateSentiment).toHaveBeenCalledWith('BTC', '24h', undefined);
      expect(result).toHaveProperty('score', 0.45);
      expect(result).toHaveProperty('label', SentimentLabel.POSITIVE);
      expect(result).toHaveProperty('positiveRatio', 60.0);
      expect(result).toHaveProperty('neutralRatio', 30.0);
      expect(result).toHaveProperty('negativeRatio', 10.0);
      expect(result).toHaveProperty('positiveCount', 6);
      expect(result).toHaveProperty('neutralCount', 3);
      expect(result).toHaveProperty('negativeCount', 1);
    });
  });

  describe('POST /api/news/crawl (On-Demand Ingestion & Cooldown)', () => {
    it('should trigger manual crawl and return success on first call', async () => {
      const result = await controller.triggerManualCrawl();

      expect(mockNewsService.triggerManualCrawl).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        count: 5,
        message: 'Successfully ingested and analyzed 5 news articles.',
      });
    });

    it('should throw HTTP 429 Too Many Requests when called within 120s cooldown', async () => {
      // First call succeeds
      await controller.triggerManualCrawl();

      // Immediate second call should be rejected with 429
      try {
        await controller.triggerManualCrawl();
        fail('Expected HttpException 429 to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        const res = (error as HttpException).getResponse() as Record<string, any>;
        expect(res.error).toBe('Rate limit exceeded. Please wait before crawling again.');
        expect(res.retryAfterSeconds).toBeGreaterThan(0);
        expect(res.retryAfterSeconds).toBeLessThanOrEqual(120);
      }
    });

    it('should throw HTTP 409 Conflict when a crawl execution is already in-flight', async () => {
      // Reset timestamp to bypass cooldown
      (controller as any).lastManualCrawlTimestamp = 0;
      (mockNewsService.isCrawlInProgress as jest.Mock).mockReturnValue(true);

      try {
        await controller.triggerManualCrawl();
        fail('Expected HttpException 409 to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
        const res = (error as HttpException).getResponse() as Record<string, any>;
        expect(res.error).toBe('Crawl in progress. Please wait for current execution to finish.');
      }
    });
  });
});
