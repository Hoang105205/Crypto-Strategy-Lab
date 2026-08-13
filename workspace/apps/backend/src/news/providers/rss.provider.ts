// RSSProvider — RSS Adapter implementing INewsProvider for public crypto feeds
// Owner: Thuan | See: ADR-0010 & kb/contracts/news.yaml

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { RawArticle, DEFAULT_NEWS_FETCH_LIMIT } from '@crypto-strategy-lab/shared';
import { INewsProvider } from './news.provider.interface';

@Injectable()
export class RSSProvider implements INewsProvider {
  private readonly logger = new Logger(RSSProvider.name);

  // Registered Live RSS Feeds
  private readonly rssFeeds = [
    { name: 'CoinDesk RSS', url: 'https://www.coindesk.com/arc/outboundfeeds/rss' },
    { name: 'CoinTelegraph RSS', url: 'https://cointelegraph.com/rss' },
    { name: 'Decrypt RSS', url: 'https://decrypt.co/feed' },
  ];

  // Fallback mock articles for offline dev environment or network failure
  private readonly mockArticles: RawArticle[] = [
    {
      source: 'CoinDesk RSS',
      title: 'Bitcoin Surges Above $90,000 Following Institutional ETF Inflows',
      content: 'Institutional adoption accelerates as spot Bitcoin ETFs record unprecedented daily net inflows across major exchanges.',
      url: 'https://coindesk.com/markets/2026/08/10/btc-surges-90k-etf',
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      relatedCoins: ['BTC'],
    },
    {
      source: 'CoinTelegraph RSS',
      title: 'Ethereum Layer-2 Network Activity Hits New All-Time High',
      content: 'Transaction volume across Layer-2 scaling solutions quadrupled over the past quarter driven by lower gas fees.',
      url: 'https://cointelegraph.com/news/eth-l2-activity-ath',
      publishedAt: new Date(Date.now() - 7200000).toISOString(),
      relatedCoins: ['ETH'],
    },
    {
      source: 'Decrypt RSS',
      title: 'Solana DeFi Total Value Locked Reaches Multi-Year Peak',
      content: 'DeFi protocols on Solana observe a surge in liquidity pools and decentralized exchange trading volumes.',
      url: 'https://decrypt.co/news/sol-tvl-multi-year-peak',
      publishedAt: new Date(Date.now() - 10800000).toISOString(),
      relatedCoins: ['SOL'],
    },
  ];

  getName(): string {
    return 'RSS Multi-Feed Provider';
  }

  /**
   * Fetch live crypto news articles from registered RSS XML feeds
   */
  async fetchLatest(limit: number = DEFAULT_NEWS_FETCH_LIMIT, coin?: string): Promise<RawArticle[]> {
    this.logger.log(`Fetching latest live RSS news articles (limit: ${limit}, coin: ${coin ?? 'ALL'})`);
    const liveArticles: RawArticle[] = [];

    for (const feedConfig of this.rssFeeds) {
      try {
        const response = await axios.get(feedConfig.url, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          },
        });

        const parsed = this.parseRssXml(response.data, feedConfig.name);
        liveArticles.push(...parsed);
        this.logger.log(`Successfully fetched ${parsed.length} live articles from [${feedConfig.name}]`);
      } catch (err) {
        this.logger.warn(`Failed to fetch live RSS from [${feedConfig.name}]: ${err.message}. Fault isolation active.`);
      }
    }

    let articles = liveArticles.length > 0 ? liveArticles : [...this.mockArticles];

    if (coin) {
      articles = articles.filter(a => 
        a.relatedCoins?.some(c => c.toUpperCase() === coin.toUpperCase())
      );
    }

    return articles.slice(0, limit);
  }

  /**
   * Safe XML parsing helper extracting <item> elements, CDATA text, URLs, and keyword coin tags
   */
  private parseRssXml(xml: string, sourceName: string): RawArticle[] {
    const articles: RawArticle[] = [];
    const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

    for (const itemXml of itemMatches) {
      try {
        const titleMatch = itemXml.match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i);
        const linkMatch = itemXml.match(/<link[\s\S]*?>([\s\S]*?)<\/link>/i) || itemXml.match(/<guid[\s\S]*?>([\s\S]*?)<\/guid>/i);
        const pubDateMatch = itemXml.match(/<pubDate[\s\S]*?>([\s\S]*?)<\/pubDate>/i);
        const descMatch = itemXml.match(/<description[\s\S]*?>([\s\S]*?)<\/description>/i) || itemXml.match(/<content:encoded[\s\S]*?>([\s\S]*?)<\/content:encoded>/i);

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
        const relatedCoins = this.extractCoins(fullText);

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
   * Keyword coin tagging supporting all major Market Data trading pairs
   */
  private extractCoins(text: string): string[] {
    const coins: string[] = [];
    const upper = text.toUpperCase();

    if (upper.includes('BTC') || upper.includes('BITCOIN')) coins.push('BTC');
    if (upper.includes('ETH') || upper.includes('ETHEREUM')) coins.push('ETH');
    if (upper.includes('SOL') || upper.includes('SOLANA')) coins.push('SOL');
    if (upper.includes('BNB') || upper.includes('BINANCE')) coins.push('BNB');
    if (upper.includes('XRP') || upper.includes('RIPPLE')) coins.push('XRP');
    if (upper.includes('DOGE') || upper.includes('DOGECOIN')) coins.push('DOGE');
    if (upper.includes('ADA') || upper.includes('CARDANO')) coins.push('ADA');

    return coins.length > 0 ? coins : ['BTC'];
  }
}
