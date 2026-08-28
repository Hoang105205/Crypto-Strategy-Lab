// WebCrawlerProvider — Adaptive Web Crawler Adapter with Selector Caching & Self-Healing
// Owner: Thuan | See: ADR-0010, ADR-0014, kb/contracts/news.yaml, Section 28

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  RawArticle,
  DEFAULT_NEWS_FETCH_LIMIT,
  DEFAULT_CRAWLER_RULES,
} from '@crypto-strategy-lab/shared';
import { INewsProvider } from './news.provider.interface';
import { PrismaService } from '../../database/prisma.service';
import { CrawlerDiscoveryService } from '../services/crawler-discovery.service';
import { CrawlerRule } from '@prisma/client';

@Injectable()
export class WebCrawlerProvider implements INewsProvider {
  private readonly logger = new Logger(WebCrawlerProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discoveryService: CrawlerDiscoveryService,
  ) { }

  getName(): string {
    return 'Adaptive Web Crawler Provider';
  }

  /**
   * Fetches latest live news from registered web portals using cached CSS selectors (ADR-0014).
   * 100% separate from RSS sources (CoinDesk, CoinTelegraph, Decrypt).
   */
  async fetchLatest(
    limit: number = DEFAULT_NEWS_FETCH_LIMIT,
    coin?: string,
    activeCoins: string[] = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA'],
  ): Promise<RawArticle[]> {
    this.logger.log(
      `Executing adaptive web crawler for news portals (limit: ${limit}, coin: ${coin ?? 'ALL'})`,
    );
    const allCrawledArticles: RawArticle[] = [];

    try {
      // 1. Retrieve cached CrawlerRule configs from PostgreSQL DB (Selector Caching - Tier 2)
      let rules = await this.prisma.crawlerRule.findMany({
        where: { isActive: true },
      });

      if (rules.length === 0) {
        this.logger.warn(
          'No active CrawlerRule found in database. Initializing default target rules.',
        );
        rules = await this.seedDefaultRules();
      }

      // 2. Crawl all web portals concurrently using cached rules
      const crawlResults = await Promise.allSettled(
        rules.map(async (rule) => {
          try {
            const articles = await this.crawlDomain(rule, activeCoins);
            this.logger.log(
              `Successfully crawled ${articles.length} articles from [${rule.domain}]`,
            );
            return articles;
          } catch (domainErr) {
            const message =
              domainErr instanceof Error
                ? domainErr.message
                : String(domainErr);
            this.logger.warn(
              `Failed to crawl domain ${rule.domain}: ${message}. Fault isolation active.`,
            );
            return [];
          }
        }),
      );

      for (const res of crawlResults) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          allCrawledArticles.push(...res.value);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Critical error during adaptive web crawl: ${message}. Returning empty array.`,
      );
      return [];
    }

    let articles = allCrawledArticles;

    if (coin && coin.toUpperCase() !== 'ALL') {
      articles = articles.filter((a) =>
        a.relatedCoins?.some((c) => c.toUpperCase() === coin.toUpperCase()),
      );
    }

    // Sort by publication timestamp descending
    articles.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

    return articles.slice(0, limit);
  }

  /**
   * Fast HTML extraction using Cheerio & cached CrawlerRule (<50ms execution, 0 LLM token cost).
   */
  private async crawlDomain(
    rule: CrawlerRule,
    activeCoins: string[],
  ): Promise<RawArticle[]> {
    const startTime = Date.now();
    const response = await axios.get<string>(rule.targetUrl, {
      timeout: 8000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const html = response.data;
    if (typeof html !== 'string' || html.trim().length === 0) {
      return [];
    }

    let extracted = this.extractWithRule(html, rule, activeCoins);

    // Self-Healing Trigger: If cached selectors extracted 0 items from valid HTML, trigger LLM re-discovery (ADR-0014 Tier 3)
    if (extracted.length === 0 && html.length > 500) {
      this.logger.warn(
        `Zero articles extracted for ${rule.domain}. Triggering Self-Healing re-discovery...`,
      );
      try {
        const repairedRule = await this.discoveryService.repairSelectors(
          html,
          rule.domain,
          rule.targetUrl,
        );
        extracted = this.extractWithRule(html, repairedRule, activeCoins);
        this.logger.log(
          `Self-Healing completed for ${rule.domain}: extracted ${extracted.length} articles with new selectors.`,
        );
      } catch (repairErr) {
        const message = repairErr instanceof Error ? repairErr.message : String(repairErr);
        this.logger.error(
          `Self-Healing failed for ${rule.domain}: ${message}`,
        );
      }
    }

    const duration = Date.now() - startTime;
    this.logger.debug(
      `Extraction for ${rule.domain} took ${duration}ms (Cheerio fast parse)`,
    );
    return extracted;
  }

  /**
   * Pure Cheerio parser extracting and normalizing articles against a CrawlerRule.
   */
  extractWithRule(
    html: string,
    rule: CrawlerRule,
    activeCoins: string[],
  ): RawArticle[] {
    const $ = cheerio.load(html);
    const articles: RawArticle[] = [];
    const sourceName = this.formatSourceName(rule.domain);

    $(rule.containerSelector).each((_, element) => {
      try {
        const container = $(element);

        // 1. Extract Title
        const titleText = container
          .find(rule.titleSelector)
          .first()
          .text()
          .trim();
        if (!titleText) return;

        // 2. Extract Link & Resolve Relative URLs
        let linkHref =
          container.find(rule.linkSelector).first().attr('href') || '';
        if (!linkHref && container.is('a')) {
          linkHref = container.attr('href') || '';
        }
        if (!linkHref) return;

        const resolvedUrl = this.resolveUrl(rule.targetUrl, linkHref);

        // 3. Extract Content / Excerpt
        let contentText = container
          .find(rule.contentSelector)
          .first()
          .text()
          .trim();
        if (!contentText) {
          contentText = titleText;
        }
        contentText = contentText.slice(0, 300);

        // 4. Extract or Default Publication Date (Prioritize datetime attribute and relative time parsing)
        const publishedAt = this.parseDate(container, rule.dateSelector);

        // 5. Dynamic Coin Extraction & Tagging
        const fullText = `${titleText}. ${contentText}`;
        const relatedCoins = this.extractCoins(fullText, activeCoins);

        articles.push({
          source: sourceName,
          title: titleText,
          content: contentText,
          url: resolvedUrl,
          publishedAt,
          relatedCoins,
        });
      } catch {
        // Skip unparseable element
      }
    });

    return articles;
  }

  /**
   * Safely parses datetime attributes (ISO/timestamps) and relative text ('42 mins ago')
   */
  private parseDate(container: cheerio.Cheerio<any>, dateSelector: string): string {
    const el = container.find(dateSelector).first();
    const datetimeAttr = el.attr('datetime') || el.attr('data-time') || el.attr('data-timestamp') || '';
    if (datetimeAttr) {
      const d = new Date(datetimeAttr);
      if (!isNaN(d.getTime())) return d.toISOString();
    }

    const rawText = (el.text() || '').trim();
    if (rawText) {
      const directDate = new Date(rawText);
      if (!isNaN(directDate.getTime())) return directDate.toISOString();

      // Parse relative timestamps like "42 mins ago", "2 hours ago", "1 day ago"
      const relMatch = rawText.match(/(\d+)\s*(min|minute|hr|hour|day|sec|second)s?\s*ago/i);
      if (relMatch) {
        const value = parseInt(relMatch[1], 10);
        const unit = relMatch[2].toLowerCase();
        const now = Date.now();
        if (unit.startsWith('sec')) return new Date(now - value * 1000).toISOString();
        if (unit.startsWith('min')) return new Date(now - value * 60 * 1000).toISOString();
        if (unit.startsWith('hr') || unit.startsWith('hour')) return new Date(now - value * 3600 * 1000).toISOString();
        if (unit.startsWith('day')) return new Date(now - value * 86400 * 1000).toISOString();
      }
    }

    return new Date().toISOString();
  }

  private resolveUrl(targetUrl: string, href: string): string {
    try {
      return new URL(href, targetUrl).href;
    } catch {
      if (href.startsWith('http')) return href;
      return `${targetUrl.replace(/\/+$/, '')}/${href.replace(/^\/+/, '')}`;
    }
  }

  private formatSourceName(domain: string): string {
    if (domain.includes('theblock')) return 'The Block Web';
    if (domain.includes('cryptoslate')) return 'CryptoSlate Web';
    if (domain.includes('bitcoinmagazine')) return 'Bitcoin Magazine Web';
    return `${domain.charAt(0).toUpperCase() + domain.slice(1)} Web`;
  }

  /**
   * Data-Driven Coin Synonyms dictionary for accurate NLP Entity Recognition
   */
  private static readonly COIN_SYNONYMS: Record<string, string[]> = {
    BTC: ['BITCOIN', 'SATOSHI'],
    ETH: ['ETHEREUM', 'ETHER'],
    SOL: ['SOLANA'],
    BNB: ['BINANCE', 'BNB CHAIN'],
    XRP: ['RIPPLE'],
    DOGE: ['DOGECOIN', 'SHIBA'],
    ADA: ['CARDANO'],
    AVAX: ['AVALANCHE'],
    DOT: ['POLKADOT'],
    LINK: ['CHAINLINK'],
  };

  /**
   * Dynamic Coin extraction based on active TradingPair symbols (with GENERAL fallback)
   */
  private extractCoins(text: string, activeCoins: string[]): string[] {
    const uppercaseText = text.toUpperCase();
    const foundCoins: string[] = [];

    for (const coin of activeCoins) {
      const cleanCoin = coin.toUpperCase();
      const tickerMatch = new RegExp(`\\b${cleanCoin}\\b`, 'i').test(text);
      const synonyms = WebCrawlerProvider.COIN_SYNONYMS[cleanCoin] || [];
      const synonymMatch = synonyms.some((syn) => uppercaseText.includes(syn));

      if ((tickerMatch || synonymMatch) && !foundCoins.includes(cleanCoin)) {
        foundCoins.push(cleanCoin);
      }
    }

    // Default to 'GENERAL' if no active coin mentioned
    return foundCoins.length > 0 ? foundCoins : ['GENERAL'];
  }

  private async seedDefaultRules(): Promise<CrawlerRule[]> {
    const results: CrawlerRule[] = [];
    for (const d of DEFAULT_CRAWLER_RULES) {
      const saved = await this.prisma.crawlerRule.upsert({
        where: { domain: d.domain },
        create: d,
        update: d,
      });
      results.push(saved);
    }
    return results;
  }
}
