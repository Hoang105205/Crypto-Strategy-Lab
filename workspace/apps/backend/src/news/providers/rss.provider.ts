// RSSProvider — RSS Adapter implementing INewsProvider for public crypto feeds
// Owner: Thuan | See: ADR-0010 & kb/contracts/news.yaml

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  RawArticle,
  DEFAULT_NEWS_FETCH_LIMIT,
  DEFAULT_RSS_FEEDS,
} from '@crypto-strategy-lab/shared';
import { INewsProvider } from './news.provider.interface';

@Injectable()
export class RSSProvider implements INewsProvider {
  private readonly logger = new Logger(RSSProvider.name);

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

  getName(): string {
    return 'RSS Multi-Feed Provider';
  }

  /**
   * Dynamically loads RSS Feeds from process.env.NEWS_RSS_FEEDS (12-Factor Config)
   * with fallback to standard default crypto RSS feeds.
   */
  private getRssFeeds(): { name: string; url: string }[] {
    const envFeeds = process.env.NEWS_RSS_FEEDS;
    if (envFeeds) {
      const urls = envFeeds
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
      if (urls.length > 0) {
        return urls.map((url) => {
          let name = 'RSS Feed';
          if (url.includes('coindesk')) name = 'CoinDesk RSS';
          else if (url.includes('cointelegraph')) name = 'CoinTelegraph RSS';
          else if (url.includes('decrypt')) name = 'Decrypt RSS';
          else {
            try {
              const hostname = new URL(url).hostname.replace('www.', '');
              name = `${hostname.charAt(0).toUpperCase() + hostname.slice(1)} RSS`;
            } catch {
              name = 'Custom RSS';
            }
          }
          return { name, url };
        });
      }
    }

    return DEFAULT_RSS_FEEDS;
  }

  /**
   * Fetch live crypto news articles from registered RSS XML feeds
   */
  async fetchLatest(
    limit: number = DEFAULT_NEWS_FETCH_LIMIT,
    coin?: string,
    activeCoins: string[] = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA'],
  ): Promise<RawArticle[]> {
    this.logger.log(
      `Fetching latest live RSS news articles (limit: ${limit}, coin: ${coin ?? 'ALL'})`,
    );
    const liveArticles: RawArticle[] = [];
    const feeds = this.getRssFeeds();

    for (const feedConfig of feeds) {
      try {
        const response = await axios.get<string>(feedConfig.url, {
          timeout: 5000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/rss+xml, application/xml, text/xml, */*',
          },
        });

        const parsed = this.parseRssXml(
          response.data,
          feedConfig.name,
          activeCoins,
        );
        liveArticles.push(...parsed);
        this.logger.log(
          `Successfully fetched ${parsed.length} live articles from [${feedConfig.name}]`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to fetch live RSS from [${feedConfig.name}]: ${err.message}. Fault isolation active.`,
        );
      }
    }

    let articles = liveArticles;

    if (coin && coin.toUpperCase() !== 'ALL') {
      articles = articles.filter((a) =>
        a.relatedCoins?.some((c) => c.toUpperCase() === coin.toUpperCase()),
      );
    }

    // Sort by publication timestamp descending (newest articles first from all feeds)
    articles.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

    return articles.slice(0, limit);
  }

  /**
   * Safe XML parsing helper extracting <item> elements, CDATA text, URLs, and keyword coin tags
   */
  private parseRssXml(
    xml: string,
    sourceName: string,
    activeCoins: string[],
  ): RawArticle[] {
    const articles: RawArticle[] = [];
    const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

    for (const itemXml of itemMatches) {
      try {
        const titleMatch = itemXml.match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i);
        const linkMatch =
          itemXml.match(/<link[\s\S]*?>([\s\S]*?)<\/link>/i) ||
          itemXml.match(/<guid[\s\S]*?>([\s\S]*?)<\/guid>/i);
        const pubDateMatch = itemXml.match(
          /<pubDate[\s\S]*?>([\s\S]*?)<\/pubDate>/i,
        );
        const descMatch =
          itemXml.match(/<description[\s\S]*?>([\s\S]*?)<\/description>/i) ||
          itemXml.match(
            /<content:encoded[\s\S]*?>([\s\S]*?)<\/content:encoded>/i,
          );

        const rawTitle = titleMatch ? titleMatch[1] : '';
        const rawLink = linkMatch ? linkMatch[1] : '';
        const rawPubDate = pubDateMatch ? pubDateMatch[1] : '';
        const rawDesc = descMatch ? descMatch[1] : '';

        const title = this.cleanXml(rawTitle);
        const url = this.cleanXml(rawLink);
        const content = this.cleanXml(rawDesc).slice(0, 300);

        if (!title || !url) continue;

        let publishedAt = new Date().toISOString();
        if (rawPubDate) {
          const parsedDate = new Date(rawPubDate);
          if (!isNaN(parsedDate.getTime())) {
            publishedAt = parsedDate.toISOString();
          }
        }

        const fullText = `${title}. ${content}`;
        const relatedCoins = this.extractCoins(fullText, activeCoins);

        articles.push({
          source: sourceName,
          title,
          content,
          url,
          publishedAt,
          relatedCoins,
        });
      } catch (err) {
        // Skip individual unparseable item
      }
    }

    return articles;
  }

  private cleanXml(text: string): string {
    if (!text) return '';
    return text
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Dynamic keyword coin tagging supporting all active database TradingPairs.
   * If no active trading pair matches the article, tags as ['GENERAL'].
   */
  private extractCoins(text: string, activeCoins: string[]): string[] {
    const uppercaseText = text.toUpperCase();
    const foundCoins: string[] = [];

    for (const coin of activeCoins) {
      const cleanCoin = coin.toUpperCase();
      const tickerMatch = new RegExp(`\\b${cleanCoin}\\b`, 'i').test(text);
      const synonyms = RSSProvider.COIN_SYNONYMS[cleanCoin] || [];
      const synonymMatch = synonyms.some((syn) => uppercaseText.includes(syn));

      if ((tickerMatch || synonymMatch) && !foundCoins.includes(cleanCoin)) {
        foundCoins.push(cleanCoin);
      }
    }

    // Default to 'GENERAL' if no active coin mentioned
    return foundCoins.length > 0 ? foundCoins : ['GENERAL'];
  }
}
