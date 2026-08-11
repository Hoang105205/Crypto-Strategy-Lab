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
  VADER_NEGATIVE_THRESHOLD
} from '@crypto-strategy-lab/shared';
import { INewsProvider, INEWS_PROVIDER_TOKEN } from '../providers/news.provider.interface';
import { SentimentClient } from './sentiment.client';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(INEWS_PROVIDER_TOKEN)
    private readonly providers: INewsProvider[],
    private readonly sentimentClient: SentimentClient,
  ) {}

  /**
   * Collect all news from active INewsProvider instances, normalize, enrich with ML sentiment score, deduplicate, and persist to DB
   */
  async collectAllNews(): Promise<NewsArticle[]> {
    this.logger.log(`Starting news collection across ${this.providers.length} registered providers...`);
    const allRawArticles: RawArticle[] = [];

    // Fetch from all provider adapters concurrently (Fault isolation per ADR-0010)
    for (const provider of this.providers) {
      try {
        const rawList = await provider.fetchLatest(20);
        allRawArticles.push(...rawList);
      } catch (err) {
        this.logger.error(`Error in provider fetch: ${err.message}`);
      }
    }

    const savedArticles: NewsArticle[] = [];
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
        const sentimentResult = await this.sentimentClient.analyzeText(textToAnalyze);

        // Normalize and save
        const article = await this.prisma.newsArticle.create({
          data: {
            source: raw.source,
            title: raw.title,
            content: raw.content,
            url: raw.url,
            publishedAt: new Date(raw.publishedAt),
            crawledAt: now,
            relatedCoins: raw.relatedCoins ?? ['BTC'],
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
          `Ingested article [${article.id}]: ${article.title} (Sentiment: ${sentimentResult.label} ${sentimentResult.score})`
        );
        savedArticles.push(article as unknown as NewsArticle);
      } catch (error) {
        this.logger.error(`Failed to persist article ${raw.url}: ${error.message}`);
      }
    }

    return savedArticles;
  }

  /**
   * Get latest news articles from DB with optional coin and limit filter
   */
  async getLatestNews(limit: number = DEFAULT_NEWS_FETCH_LIMIT, coin?: string): Promise<NewsArticle[]> {
    const whereCondition: any = {};
    if (coin) {
      whereCondition.relatedCoins = {
        has: coin.toUpperCase(),
      };
    }

    const articles = await this.prisma.newsArticle.findMany({
      where: whereCondition,
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });

    return articles as unknown as NewsArticle[];
  }

  /**
   * Get aggregate sentiment score and label for a coin over a timeframe ('1h', '24h', '7d')
   */
  async getAggregateSentiment(coin?: string, timeframe: string = '1h'): Promise<{ score: number; label: SentimentLabel; articleCount: number; updatedAt: string }> {
    let timeframeMs = 3600000; // 1h default
    if (timeframe === '24h') timeframeMs = 86400000;
    if (timeframe === '7d') timeframeMs = 604800000;

    const sinceDate = new Date(Date.now() - timeframeMs);
    const whereCondition: any = {
      publishedAt: { gte: sinceDate },
      sentimentScore: { not: null },
    };

    if (coin) {
      whereCondition.relatedCoins = {
        has: coin.toUpperCase(),
      };
    }

    const articles = await this.prisma.newsArticle.findMany({
      where: whereCondition,
    });

    if (articles.length === 0) {
      return {
        score: SENTIMENT_NEUTRAL_SCORE,
        label: SentimentLabel.NEUTRAL,
        articleCount: 0,
        updatedAt: new Date().toISOString(),
      };
    }

    const sumScore = articles.reduce((acc, a) => acc + (a.sentimentScore ?? 0), 0);
    const avgScore = Number((sumScore / articles.length).toFixed(4));

    let label = SentimentLabel.NEUTRAL;
    if (avgScore >= VADER_POSITIVE_THRESHOLD) label = SentimentLabel.POSITIVE;
    else if (avgScore <= VADER_NEGATIVE_THRESHOLD) label = SentimentLabel.NEGATIVE;

    return {
      score: avgScore,
      label,
      articleCount: articles.length,
      updatedAt: new Date().toISOString(),
    };
  }
}
