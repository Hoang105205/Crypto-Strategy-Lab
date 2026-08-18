// WebCrawlerProvider Unit Tests — Fast Cheerio Parsing, Dynamic Coins, Fault Isolation & Self-Healing
// Owner: Thuan | See: ADR-0010, ADR-0014

import { WebCrawlerProvider } from './crawler.provider';
import { PrismaService } from '../../database/prisma.service';
import { CrawlerDiscoveryService } from '../services/crawler-discovery.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WebCrawlerProvider', () => {
  let provider: WebCrawlerProvider;
  let mockPrisma: Partial<PrismaService>;
  let mockDiscoveryService: Partial<CrawlerDiscoveryService>;

  const sampleRule = {
    id: 'rule-uuid-1',
    domain: 'theblock.co',
    targetUrl: 'https://www.theblock.co/latest',
    containerSelector: 'article.post-card',
    titleSelector: 'h2.headline a',
    contentSelector: 'p.excerpt',
    linkSelector: 'a',
    dateSelector: 'time',
    isActive: true,
    lastDiscoveredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    const mockPrisma = {
      crawlerRule: {
        findMany: jest.fn().mockResolvedValue([sampleRule]),
        upsert: jest.fn(),
      },
    } as unknown as PrismaService;

    mockDiscoveryService = {
      repairSelectors: jest.fn(),
    } as unknown as CrawlerDiscoveryService;

    provider = new WebCrawlerProvider(mockPrisma, mockDiscoveryService as CrawlerDiscoveryService);
  });

  it('should return correct provider name', () => {
    expect(provider.getName()).toBe('Adaptive Web Crawler Provider');
  });

  it('should fast parse HTML markup using cached rule selectors via Cheerio in <50ms', () => {
    const mockHtml = `
      <div class="news-list">
        <article class="post-card">
          <h2 class="headline"><a href="/news/ethereum-layer2-growth">Ethereum Layer-2 Volume Surges to New All-Time High</a></h2>
          <p class="excerpt">Total value locked across major rollups surpasses previous milestones.</p>
          <time datetime="2026-08-18T09:00:00Z">Aug 18, 2026</time>
        </article>
      </div>
    `;

    const start = performance.now();
    const articles = provider.extractWithRule(mockHtml, sampleRule, [
      'BTC',
      'ETH',
      'SOL',
    ]);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50); // <50ms execution
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe(
      'Ethereum Layer-2 Volume Surges to New All-Time High',
    );
    expect(articles[0].url).toBe(
      'https://www.theblock.co/news/ethereum-layer2-growth',
    );
    expect(articles[0].source).toBe('The Block Web');
    expect(articles[0].relatedCoins).toContain('ETH');
  });

  it('should assign [GENERAL] tag when article content does not match any active coin', () => {
    const mockHtml = `
      <article class="post-card">
        <h2 class="headline"><a href="/news/federal-reserve-monetary-policy">Federal Reserve Signals Cautious Rate Stance</a></h2>
        <p class="excerpt">Global central banking symposium concludes with discussion on inflation targets.</p>
        <time>2026-08-18T10:00:00Z</time>
      </article>
    `;

    const articles = provider.extractWithRule(mockHtml, sampleRule, [
      'BTC',
      'ETH',
      'SOL',
    ]);

    expect(articles).toHaveLength(1);
    expect(articles[0].relatedCoins).toEqual(['GENERAL']);
  });

  it('should format source name according to domain (The Block Web, CryptoSlate Web)', () => {
    const cryptoslateRule = {
      ...sampleRule,
      domain: 'cryptoslate.com',
      targetUrl: 'https://cryptoslate.com/news/',
    };

    const mockHtml = `
      <article class="post-card">
        <h2 class="headline"><a href="/news/bitcoin-etf-inflows">Bitcoin ETF Inflows Accelerate</a></h2>
        <p class="excerpt">Institutional demand continues across spot funds.</p>
        <time>2026-08-18T11:00:00Z</time>
      </article>
    `;

    const articles = provider.extractWithRule(mockHtml, cryptoslateRule, [
      'BTC',
      'ETH',
    ]);

    expect(articles[0].source).toBe('CryptoSlate Web');
    expect(articles[0].url).toBe(
      'https://cryptoslate.com/news/bitcoin-etf-inflows',
    );
  });

  it('should trigger Self-Healing when cached selectors extract 0 items from valid HTML (ADR-0014)', async () => {
    // Modified HTML where classes changed from 'article.post-card' to 'div.redesigned-card'
    const redesignedHtml = `
      <div class="articles-grid">
        <div class="redesigned-card">
          <h3 class="story-title"><a href="/news/solana-upgrade">Solana Network Upgrade Deployed</a></h3>
          <div class="story-desc">Validators confirm consensus throughput improvements.</div>
          <span class="date">2026-08-18</span>
        </div>
      </div>
    `.repeat(10); // make it > 500 chars

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: redesignedHtml,
    });

    const repairedRule = {
      ...sampleRule,
      containerSelector: 'div.redesigned-card',
      titleSelector: 'h3.story-title a',
      contentSelector: 'div.story-desc',
      linkSelector: 'a',
      dateSelector: 'span.date',
    };

    (mockDiscoveryService.repairSelectors as jest.Mock).mockResolvedValueOnce(
      repairedRule,
    );

    const articles = await provider.fetchLatest(10, undefined, [
      'BTC',
      'ETH',
      'SOL',
    ]);

    expect(mockDiscoveryService.repairSelectors).toHaveBeenCalledWith(
      redesignedHtml,
      sampleRule.domain,
      sampleRule.targetUrl,
    );
    expect(articles).toHaveLength(10);
    expect(articles[0].title).toBe('Solana Network Upgrade Deployed');
    expect(articles[0].relatedCoins).toContain('SOL');
  });

  it('should provide fault isolation and return empty array [] on network failure (ADR-0010)', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Connection Timeout 504'));

    const articles = await provider.fetchLatest(10);

    expect(articles).toEqual([]);
  });
});
