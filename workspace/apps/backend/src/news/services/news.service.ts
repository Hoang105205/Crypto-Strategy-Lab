// NewsService — News collection, normalization, deduplication, sentiment enrichment, and DB persistence
// Owner: Thuan | See: kb/modules/news-sentiment.md, Section 27 & 28

import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  RawArticle,
  NewsArticle,
  DEFAULT_NEWS_FETCH_LIMIT,
  SENTIMENT_NEUTRAL_SCORE,
  SentimentLabel,
  VADER_POSITIVE_THRESHOLD,
  VADER_NEGATIVE_THRESHOLD,
  AggregateSentiment,
  ManualCrawlResult,
} from '@crypto-strategy-lab/shared';
import {
  INewsProvider,
  INEWS_PROVIDER_TOKEN,
} from '../providers/news.provider.interface';
import { SentimentClient } from './sentiment.client';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  
  // Concurrency control: Mutex lock to prevent overlapping crawler jobs
  private isCrawling: boolean = false;

  // In-memory cache to prevent O(N) database queries during backtesting loops
  private backtestCache: Map<string, NewsArticle[]> = new Map();
  private cacheExpiresAt: number = 0;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(INEWS_PROVIDER_TOKEN)
    private readonly providers: INewsProvider[],
    private readonly sentimentClient: SentimentClient,
  ) {}

  /**
   * Check whether a crawling process is currently running
   */
  public isCrawlInProgress(): boolean {
    return this.isCrawling;
  }

  /**
   * Manual on-demand news collection trigger
   */
  /**
   * Manual on-demand news collection trigger
   */
  async triggerManualCrawl(): Promise<ManualCrawlResult> {
    if (this.isCrawling) {
      throw new Error('Crawl in progress. Please wait for current execution to finish.');
    }

    const { newlyInsertedCount, reAnalyzedCount, totalFetched } =
      await this.collectNewsWithMetrics();

    let message = 'Feeds are up to date. No new articles found.';
    if (newlyInsertedCount > 0 && reAnalyzedCount > 0) {
      message = `Ingestion complete! Added ${newlyInsertedCount} new & re-scored ${reAnalyzedCount} historical articles.`;
    } else if (newlyInsertedCount > 0) {
      message = `Ingestion successful! Added ${newlyInsertedCount} new articles.`;
    } else if (reAnalyzedCount > 0) {
      message = `Re-scored ${reAnalyzedCount} historical articles with real VADER ML.`;
    }

    return {
      success: true,
      count: newlyInsertedCount + reAnalyzedCount,
      message,
    };
  }

  /**
   * Collect all news from active INewsProvider instances, normalize, enrich with ML sentiment score, deduplicate, and persist to DB
   */
  async collectAllNews(): Promise<NewsArticle[]> {
    const { savedArticles } = await this.collectNewsWithMetrics();
    return savedArticles;
  }

  /**
   * Internal ingestion worker tracking detailed insertion & re-scoring metrics
   */
  async collectNewsWithMetrics(): Promise<{
    savedArticles: NewsArticle[];
    newlyInsertedCount: number;
    reAnalyzedCount: number;
    totalFetched: number;
  }> {
    if (this.isCrawling) {
      this.logger.warn('Crawl already in progress, skipping duplicate execution.');
      return {
        savedArticles: [],
        newlyInsertedCount: 0,
        reAnalyzedCount: 0,
        totalFetched: 0,
      };
    }

    this.isCrawling = true;
    try {
      this.logger.log(
        `Starting news collection across ${this.providers.length} registered providers...`,
      );
      const allRawArticles: RawArticle[] = [];

      // Query active trading pairs from PostgreSQL to extract matching coins dynamically
      let activeCoins: string[] = [
        'BTC',
        'ETH',
        'SOL',
        'BNB',
        'XRP',
        'DOGE',
        'ADA',
      ];
      try {
        const activePairs = await this.prisma.tradingPair.findMany({
          where: { isActive: true },
          select: { baseAsset: true },
        });
        if (activePairs.length > 0) {
          activeCoins = activePairs.map((p) => p.baseAsset.toUpperCase());
        }
      } catch (err) {
        this.logger.warn(
          `Failed to fetch active TradingPairs from DB: ${err.message}. Using default coin list.`,
        );
      }

      // Fetch from all provider adapters concurrently (Fault isolation per ADR-0010)
      const providerResults = await Promise.allSettled(
        this.providers.map((provider) =>
          provider.fetchLatest(20, undefined, activeCoins),
        ),
      );

      for (const res of providerResults) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          allRawArticles.push(...res.value);
        } else if (res.status === 'rejected') {
          this.logger.error(`Error in provider fetch: ${res.reason?.message || res.reason}`);
        }
      }

      const savedArticles: NewsArticle[] = [];
      let newlyInsertedCount = 0;
      let reAnalyzedCount = 0;
      const now = new Date();

      // Deduplicate, sentiment enrich, and persist
      for (const raw of allRawArticles) {
        try {
          // Deduplication by URL (Unique constraint in PostgreSQL DB)
          const existing = await this.prisma.newsArticle.findUnique({
            where: { url: raw.url },
          });

          if (existing) {
            this.logger.verbose(`Skipping existing article: ${raw.title}`);
            savedArticles.push(existing as unknown as NewsArticle);
            continue;
          }

          // Enrich with VADER Sentiment ML Score (Graceful degradation handled by SentimentClient)
          const textToAnalyze = `${raw.title}. ${raw.content}`;
          const sentimentResult =
            await this.sentimentClient.analyzeText(textToAnalyze);

          // Normalize and save with explicit GENERAL fallback tag
          const relatedCoins =
            raw.relatedCoins && raw.relatedCoins.length > 0
              ? raw.relatedCoins
              : ['GENERAL'];
          const article = await this.prisma.newsArticle.create({
            data: {
              source: raw.source,
              title: raw.title,
              content: raw.content,
              url: raw.url,
              publishedAt: new Date(raw.publishedAt),
              crawledAt: now,
              relatedCoins,
              sentimentScore: sentimentResult.score,
              sentimentLabel: sentimentResult.label,
            },
          });

          // Also persist SentimentScore audit record
          await this.prisma.sentimentScore.create({
            data: {
              articleId: article.id,
              score: sentimentResult.score,
              label: sentimentResult.label,
              model: 'VADER',
              scoredAt: now,
            },
          });

          this.logger.log(
            `Ingested article [${article.id}]: ${article.title} (Sentiment: ${sentimentResult.label} ${sentimentResult.score})`,
          );
          newlyInsertedCount++;
          savedArticles.push(article as unknown as NewsArticle);
        } catch (error) {
          this.logger.error(
            `Failed to persist article ${raw.url}: ${error.message}`,
          );
        }
      }

      // Batch Re-scoring: scan and re-analyze historical articles lacking a VADER audit record
      try {
        const historicalUnscored = await this.prisma.newsArticle.findMany({
          where: {
            OR: [
              { sentimentScores: { none: { model: 'VADER' } } },
              { sentimentScore: null },
            ],
          },
          take: 100, // Batch up to 100 historical articles per cycle
          orderBy: { publishedAt: 'desc' },
        });

        if (historicalUnscored.length > 0) {
          const CHUNK_SIZE = 20;
          for (let i = 0; i < historicalUnscored.length; i += CHUNK_SIZE) {
            const chunk = historicalUnscored.slice(i, i + CHUNK_SIZE);
            await Promise.all(
              chunk.map(async (item) => {
                try {
                  const textToAnalyze = `${item.title}. ${item.content}`;
                  const sentimentResult =
                    await this.sentimentClient.analyzeText(textToAnalyze);

                  await this.prisma.newsArticle.update({
                    where: { id: item.id },
                    data: {
                      sentimentScore: sentimentResult.score,
                      sentimentLabel: sentimentResult.label,
                    },
                  });

                  await this.prisma.sentimentScore.create({
                    data: {
                      articleId: item.id,
                      score: sentimentResult.score,
                      label: sentimentResult.label,
                      model: 'VADER',
                      scoredAt: now,
                    },
                  });

                  if (
                    sentimentResult.score !== 0.0 ||
                    sentimentResult.label !== SentimentLabel.NEUTRAL
                  ) {
                    reAnalyzedCount++;
                  }
                } catch {
                  // Graceful continue on single item failure
                }
              }),
            );
          }

          if (reAnalyzedCount > 0) {
            this.logger.log(
              `Successfully re-scored ${reAnalyzedCount} historical articles with real VADER ML compound scores.`,
            );
            // Invalidate in-memory cache to immediately reflect updated scores
            this.backtestCache.clear();
          }
        }
      } catch (err) {
        this.logger.warn(
          `Historical batch re-scoring encountered an error: ${err.message}`,
        );
      }

      return {
        savedArticles,
        newlyInsertedCount,
        reAnalyzedCount,
        totalFetched: allRawArticles.length,
      };
    } finally {
      this.isCrawling = false;
    }
  }

  /**
   * Get latest news articles from DB with optional offset-based pagination and coin/multi-coin filter
   */
  async getLatestNews(
    limit: number = DEFAULT_NEWS_FETCH_LIMIT,
    offset: number = 0,
    coin?: string,
    coins?: string[],
  ): Promise<{
    data: NewsArticle[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const whereCondition: any = {};

    if (coins && coins.length > 0) {
      whereCondition.relatedCoins = {
        hasSome: coins.map((c) => c.toUpperCase()),
      };
    } else if (coin) {
      whereCondition.relatedCoins = {
        has: coin.toUpperCase(),
      };
    }

    const [total, articles] = await Promise.all([
      this.prisma.newsArticle.count({ where: whereCondition }),
      this.prisma.newsArticle.findMany({
        where: whereCondition,
        orderBy: { publishedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    return {
      data: articles as unknown as NewsArticle[],
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + articles.length < total,
      },
    };
  }

  /**
   * Pre-loads and caches all sentiment-scored articles for a coin to avoid O(N) database
   * queries when a strategy is evaluated inside a large backtest loop.
   */
  private async getCachedArticlesForCoin(coin?: string, coins?: string[]): Promise<NewsArticle[]> {
    const now = Date.now();
    // Cache TTL of 1 minute (sufficient for a continuous backtest run)
    if (now > this.cacheExpiresAt) {
      this.backtestCache.clear();
      this.cacheExpiresAt = now + 60 * 1000;
    }

    const cacheKey = coins && coins.length > 0 ? coins.join(',') : (coin || 'ALL');
    
    if (!this.backtestCache.has(cacheKey)) {
      const whereCondition: any = { sentimentScore: { not: null } };
      if (coins && coins.length > 0) {
        whereCondition.relatedCoins = { hasSome: coins.map((c) => c.toUpperCase()) };
      } else if (coin) {
        whereCondition.relatedCoins = { has: coin.toUpperCase() };
      }

      // Fetch all historical sentiment data into memory once
      const allArticles = await this.prisma.newsArticle.findMany({
        where: whereCondition,
        orderBy: { publishedAt: 'desc' },
      });
      this.backtestCache.set(cacheKey, allArticles as unknown as NewsArticle[]);
    }
    
    return this.backtestCache.get(cacheKey) || [];
  }

  /**
   * Get aggregate sentiment score, label, and distribution breakdown for a coin / multi-coins over a timeframe ('1h', '24h', '7d')
   */
  async getAggregateSentiment(
    coin?: string,
    timeframe: string = '24h',
    coins?: string[],
    targetDate: Date = new Date(),
  ): Promise<AggregateSentiment> {
    let timeframeMs = 86400000; // 24h default
    if (timeframe === '1h') timeframeMs = 3600000;
    if (timeframe === '7d') timeframeMs = 604800000;

    const sinceDate = new Date(targetDate.getTime() - timeframeMs);
    // Load all historical articles from fast memory cache
    const allArticles = await this.getCachedArticlesForCoin(coin, coins);

    // Filter strictly by the current candle's time window
    let articles = allArticles.filter((a) => {
      const pubDate = new Date(a.publishedAt).getTime();
      return pubDate >= sinceDate.getTime() && pubDate <= targetDate.getTime();
    });

    // Fallback if no articles in strict window: query recent articles before targetDate
    if (articles.length === 0) {
      articles = allArticles
        .filter((a) => new Date(a.publishedAt).getTime() <= targetDate.getTime())
        .slice(0, 20);
    }

    if (articles.length === 0) {
      return {
        score: SENTIMENT_NEUTRAL_SCORE,
        label: SentimentLabel.NEUTRAL,
        articleCount: 0,
        positiveCount: 0,
        neutralCount: 0,
        negativeCount: 0,
        positiveRatio: 0,
        neutralRatio: 100,
        negativeRatio: 0,
        updatedAt: new Date().toISOString(),
      };
    }

    let positiveCount = 0;
    let neutralCount = 0;
    let negativeCount = 0;

    for (const a of articles) {
      if (
        a.sentimentLabel === SentimentLabel.POSITIVE ||
        (a.sentimentLabel as string) === 'POSITIVE'
      ) {
        positiveCount++;
      } else if (
        a.sentimentLabel === SentimentLabel.NEGATIVE ||
        (a.sentimentLabel as string) === 'NEGATIVE'
      ) {
        negativeCount++;
      } else {
        neutralCount++;
      }
    }

    const total = articles.length;
    const positiveRatio = Number(((positiveCount / total) * 100).toFixed(1));
    const neutralRatio = Number(((neutralCount / total) * 100).toFixed(1));
    const negativeRatio = Number(
      Math.max(0, 100 - positiveRatio - neutralRatio).toFixed(1),
    );

    const sumScore = articles.reduce(
      (acc, a) => acc + (a.sentimentScore ?? 0),
      0,
    );
    const avgScore = Number((sumScore / articles.length).toFixed(4));

    let label = SentimentLabel.NEUTRAL;
    if (avgScore >= VADER_POSITIVE_THRESHOLD) label = SentimentLabel.POSITIVE;
    else if (avgScore <= VADER_NEGATIVE_THRESHOLD)
      label = SentimentLabel.NEGATIVE;

    return {
      score: avgScore,
      label,
      articleCount: total,
      positiveCount,
      neutralCount,
      negativeCount,
      positiveRatio,
      neutralRatio,
      negativeRatio,
      updatedAt: new Date().toISOString(),
    };
  }
}

