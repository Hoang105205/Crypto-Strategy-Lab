import { CrawlerDiscoveryService, DiscoveredRule } from './crawler-discovery.service';
import { PrismaService } from '../../database/prisma.service';
import { GeminiDiscoveryClient } from './gemini-discovery.client';
import { CrawlerRule } from '@prisma/client';

describe('CrawlerDiscoveryService', () => {
  let service: CrawlerDiscoveryService;
  let upsertMock: jest.Mock;
  let findFirstMock: jest.Mock;
  let findManyMock: jest.Mock;
  let geminiDiscoverMock: jest.Mock;
  let geminiIsConfiguredMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    upsertMock = jest.fn();
    findFirstMock = jest.fn();
    findManyMock = jest.fn();
    geminiDiscoverMock = jest.fn();
    geminiIsConfiguredMock = jest.fn().mockReturnValue(false);

    const mockPrisma = {
      crawlerRule: {
        upsert: upsertMock,
        findFirst: findFirstMock,
        findMany: findManyMock,
      },
    } as unknown as PrismaService;

    const mockGeminiClient = {
      isConfigured: geminiIsConfiguredMock,
      discoverSelectors: geminiDiscoverMock,
    } as unknown as GeminiDiscoveryClient;

    service = new CrawlerDiscoveryService(mockPrisma, mockGeminiClient);
  });

  describe('discoverSelectors', () => {
    const mockHtml = `
      <html>
        <body>
          <div class="news-feed">
            <article class="post-card">
              <h2 class="headline"><a href="/news/crypto-regulation-2026">Global Crypto Regulation Framework Finalized</a></h2>
              <p class="excerpt">Financial regulators agree on standardized digital asset reporting rules.</p>
              <span class="post-date">2026-08-18T08:00:00Z</span>
            </article>
          </div>
        </body>
      </html>
    `;

    it('should throw an error if provided HTML is empty or blank', async () => {
      await expect(
        service.discoverSelectors('', 'theblock.co', 'https://www.theblock.co/latest'),
      ).rejects.toThrow('Empty HTML content provided for domain theblock.co');
    });

    it('should use Gemini LLM when configured and call succeeds', async () => {
      geminiIsConfiguredMock.mockReturnValue(true);
      const mockGeminiRule: DiscoveredRule = {
        domain: 'theblock.co',
        targetUrl: 'https://www.theblock.co/latest',
        containerSelector: 'article.post-card',
        titleSelector: 'h2.headline a',
        contentSelector: 'p.excerpt',
        linkSelector: 'a[href]',
        dateSelector: 'span.post-date',
      };
      geminiDiscoverMock.mockResolvedValueOnce(mockGeminiRule);

      const result = await service.discoverSelectors(
        mockHtml,
        'theblock.co',
        'https://www.theblock.co/latest',
      );

      expect(geminiIsConfiguredMock).toHaveBeenCalled();
      expect(geminiDiscoverMock).toHaveBeenCalledWith(
        mockHtml,
        'theblock.co',
        'https://www.theblock.co/latest',
      );
      expect(result).toEqual(mockGeminiRule);
    });

    it('should gracefully fallback to Cheerio heuristics when Gemini throws an error', async () => {
      geminiIsConfiguredMock.mockReturnValue(true);
      geminiDiscoverMock.mockRejectedValueOnce(new Error('Rate limit 429'));

      const result = await service.discoverSelectors(
        mockHtml,
        'theblock.co',
        'https://www.theblock.co/latest',
      );

      expect(geminiDiscoverMock).toHaveBeenCalled();
      expect(result.domain).toBe('theblock.co');
      expect(result.containerSelector).toContain('article');
      expect(result.titleSelector).toContain('h2');
      expect(result.contentSelector).toContain('p');
    });

    it('should discover CSS selectors directly via Cheerio when Gemini is unconfigured', async () => {
      geminiIsConfiguredMock.mockReturnValue(false);

      const result = await service.discoverSelectors(
        mockHtml,
        'theblock.co',
        'https://www.theblock.co/latest',
      );

      expect(geminiDiscoverMock).not.toHaveBeenCalled();
      expect(result.domain).toBe('theblock.co');
      expect(result.targetUrl).toBe('https://www.theblock.co/latest');
      expect(result.containerSelector).toContain('article');
      expect(result.titleSelector).toContain('h2');
      expect(result.contentSelector).toContain('p');
      expect(result.linkSelector).toBe('a[href]');
    });
  });

  describe('saveDiscoveredRule & repairSelectors', () => {
    it('should persist discovered rule into PostgreSQL via prisma.crawlerRule.upsert', async () => {
      const mockRule: DiscoveredRule = {
        domain: 'theblock.co',
        targetUrl: 'https://www.theblock.co/latest',
        containerSelector: 'article',
        titleSelector: 'h2',
        contentSelector: 'p',
        linkSelector: 'a[href]',
        dateSelector: 'time',
      };

      const mockSaved: CrawlerRule = {
        id: 'rule-uuid-123',
        domain: mockRule.domain,
        targetUrl: mockRule.targetUrl,
        containerSelector: mockRule.containerSelector,
        titleSelector: mockRule.titleSelector,
        contentSelector: mockRule.contentSelector,
        linkSelector: mockRule.linkSelector,
        dateSelector: mockRule.dateSelector,
        isActive: true,
        lastDiscoveredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      upsertMock.mockResolvedValueOnce(mockSaved);

      const saved = await service.saveDiscoveredRule(mockRule);

      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { domain: 'theblock.co' },
          create: expect.objectContaining({
            domain: 'theblock.co',
            targetUrl: 'https://www.theblock.co/latest',
          }),
        }),
      );
      expect(saved.id).toBe('rule-uuid-123');
    });

    it('should implement Self-Healing: re-discover and update rules when layout changes (ADR-0014)', async () => {
      const redesignedHtml = `
        <div class="articles-container">
          <div class="articleCard">
            <h3 class="title"><a href="/news/new-article">New Bitcoin Inflow Record</a></h3>
            <div class="description">Market liquidity spikes.</div>
            <span class="pubDate">Aug 18, 2026</span>
          </div>
        </div>
      `;

      const mockRepaired: CrawlerRule = {
        id: 'rule-uuid-123',
        domain: 'theblock.co',
        targetUrl: 'https://www.theblock.co/latest',
        containerSelector: 'div.articleCard',
        titleSelector: 'h3',
        contentSelector: 'div.description',
        linkSelector: 'a[href]',
        dateSelector: 'span.pubDate',
        isActive: true,
        lastDiscoveredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      upsertMock.mockResolvedValueOnce(mockRepaired);

      const repaired = await service.repairSelectors(
        redesignedHtml,
        'theblock.co',
        'https://www.theblock.co/latest',
      );

      expect(upsertMock).toHaveBeenCalled();
      expect(repaired.domain).toBe('theblock.co');
    });

    it('should query active rules from database', async () => {
      findFirstMock.mockResolvedValueOnce({
        domain: 'cryptoslate.com',
        isActive: true,
      });

      const rule = await service.getRuleForDomain('cryptoslate.com');
      expect(rule?.domain).toBe('cryptoslate.com');
      expect(findFirstMock).toHaveBeenCalledWith({
        where: { domain: 'cryptoslate.com', isActive: true },
      });
    });
  });
});
