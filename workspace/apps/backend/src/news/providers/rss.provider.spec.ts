// RSSProvider Unit Tests — Dynamic coin extraction, GENERAL fallback & Fault Isolation (ADR-0010)
// Owner: Thuan

import axios from 'axios';
import { RSSProvider } from './rss.provider';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RSSProvider', () => {
  let provider: RSSProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new RSSProvider();
  });

  it('should return the provider name', () => {
    expect(provider.getName()).toBe('RSS Multi-Feed Provider');
  });

  it('should parse live RSS XML and extract matching coins dynamically', async () => {
    const mockXml = `
      <rss version="2.0">
        <channel>
          <title>CoinDesk</title>
          <item>
            <title>Bitcoin Reaches New Record High</title>
            <link>https://coindesk.com/article-1</link>
            <description>Institutional inflows drive BTC past 90k.</description>
            <pubDate>Mon, 17 Aug 2026 08:00:00 GMT</pubDate>
          </item>
          <item>
            <title>Ethereum Layer-2 Activity Triples</title>
            <link>https://coindesk.com/article-2</link>
            <description>Gas fees decrease on ETH networks.</description>
            <pubDate>Mon, 17 Aug 2026 09:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;

    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.includes('coindesk')) {
        return { data: mockXml };
      }
      return { data: '<rss></rss>' };
    });

    const articles = await provider.fetchLatest(10, undefined, ['BTC', 'ETH', 'SOL']);

    expect(articles).toHaveLength(2);
    expect(articles[0].title).toBe('Bitcoin Reaches New Record High');
    expect(articles[0].relatedCoins).toContain('BTC');
    expect(articles[1].title).toBe('Ethereum Layer-2 Activity Triples');
    expect(articles[1].relatedCoins).toContain('ETH');
  });

  it('should tag unrecognized / macro articles with GENERAL instead of BTC', async () => {
    const mockXml = `
      <rss version="2.0">
        <channel>
          <item>
            <title>Federal Reserve Signals Monetary Policy Shift</title>
            <link>https://coindesk.com/fed-rates-2026</link>
            <description>Interest rate projections affect global market liquidity.</description>
            <pubDate>Mon, 17 Aug 2026 10:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;

    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.includes('coindesk')) {
        return { data: mockXml };
      }
      return { data: '<rss></rss>' };
    });

    const articles = await provider.fetchLatest(10, undefined, ['BTC', 'ETH', 'SOL']);

    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('Federal Reserve Signals Monetary Policy Shift');
    expect(articles[0].relatedCoins).toEqual(['GENERAL']);
  });

  it('should filter articles by coin correctly', async () => {
    const mockXml = `
      <rss version="2.0">
        <channel>
          <item>
            <title>Bitcoin Hits 95K</title>
            <link>https://coindesk.com/btc-95k</link>
            <description>BTC market cap reaches new high.</description>
          </item>
          <item>
            <title>Solana Ecosystem Growth</title>
            <link>https://coindesk.com/sol-growth</link>
            <description>SOL decentralized exchanges record volume surge.</description>
          </item>
        </channel>
      </rss>
    `;

    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.includes('coindesk')) {
        return { data: mockXml };
      }
      return { data: '<rss></rss>' };
    });

    const btcArticles = await provider.fetchLatest(10, 'BTC', ['BTC', 'ETH', 'SOL']);
    expect(btcArticles).toHaveLength(1);
    expect(btcArticles[0].title).toBe('Bitcoin Hits 95K');

    const allArticles = await provider.fetchLatest(10, 'ALL', ['BTC', 'ETH', 'SOL']);
    expect(allArticles).toHaveLength(2);
  });

  it('should implement Fault Isolation returning empty array [] on feed network failure', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network connection timeout'));

    const articles = await provider.fetchLatest(10);

    expect(articles).toEqual([]);
    expect(articles).toHaveLength(0);
  });
});
