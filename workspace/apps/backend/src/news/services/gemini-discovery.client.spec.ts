import { Test, TestingModule } from '@nestjs/testing';
import { GeminiDiscoveryClient } from './gemini-discovery.client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GeminiDiscoveryClient', () => {
  let client: GeminiDiscoveryClient;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-gemini-key' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GeminiDiscoveryClient],
    }).compile();

    client = module.get<GeminiDiscoveryClient>(GeminiDiscoveryClient);
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  describe('isConfigured', () => {
    it('should return true when GEMINI_API_KEY is present', () => {
      expect(client.isConfigured()).toBe(true);
    });

    it('should return false when GEMINI_API_KEY is missing or empty', async () => {
      delete process.env.GEMINI_API_KEY;
      const module = await Test.createTestingModule({
        providers: [GeminiDiscoveryClient],
      }).compile();
      const unconfiguredClient = module.get<GeminiDiscoveryClient>(
        GeminiDiscoveryClient,
      );
      expect(unconfiguredClient.isConfigured()).toBe(false);
    });
  });

  describe('discoverSelectors', () => {
    const mockHtml = `
      <html>
        <body>
          <main>
            <article class="news-card">
              <h2 class="headline"><a href="/news/1">Bitcoin Surges</a></h2>
              <p class="summary">BTC breaks all time high today.</p>
              <span class="pub-date">2026-08-31</span>
            </article>
          </main>
        </body>
      </html>
    `;

    it('should throw error when html sample is empty', async () => {
      await expect(
        client.discoverSelectors('', 'example.com', 'https://example.com'),
      ).rejects.toThrow('Empty HTML content');
    });

    it('should throw error when GEMINI_API_KEY is not configured', async () => {
      delete process.env.GEMINI_API_KEY;
      const module = await Test.createTestingModule({
        providers: [GeminiDiscoveryClient],
      }).compile();
      const unconfiguredClient = module.get<GeminiDiscoveryClient>(
        GeminiDiscoveryClient,
      );

      await expect(
        unconfiguredClient.discoverSelectors(
          mockHtml,
          'example.com',
          'https://example.com',
        ),
      ).rejects.toThrow('GEMINI_API_KEY is missing');
    });

    it('should successfully discover selectors via Gemini API JSON response', async () => {
      const mockGeminiJson = JSON.stringify({
        containerSelector: 'article.news-card',
        titleSelector: 'h2.headline a',
        contentSelector: 'p.summary',
        linkSelector: 'a[href]',
        dateSelector: 'span.pub-date',
      });

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          candidates: [
            {
              content: {
                parts: [{ text: mockGeminiJson }],
              },
            },
          ],
        },
      });

      const result = await client.discoverSelectors(
        mockHtml,
        'example.com',
        'https://example.com/news',
      );

      expect(result).toEqual({
        domain: 'example.com',
        targetUrl: 'https://example.com/news',
        containerSelector: 'article.news-card',
        titleSelector: 'h2.headline a',
        contentSelector: 'p.summary',
        linkSelector: 'a[href]',
        dateSelector: 'span.pub-date',
      });
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should parse markdown-fenced JSON output correctly', async () => {
      const fencedJson =
        '```json\n{"containerSelector":"article","titleSelector":"h2","contentSelector":"p","linkSelector":"a","dateSelector":"time"}\n```';

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          candidates: [
            {
              content: {
                parts: [{ text: fencedJson }],
              },
            },
          ],
        },
      });

      const result = await client.discoverSelectors(
        mockHtml,
        'example.com',
        'https://example.com',
      );

      expect(result.containerSelector).toBe('article');
      expect(result.titleSelector).toBe('h2');
    });

    it('should throw error when Gemini API encounters network timeout', async () => {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';
      mockedAxios.post.mockRejectedValueOnce(abortError);

      await expect(
        client.discoverSelectors(
          mockHtml,
          'example.com',
          'https://example.com',
        ),
      ).rejects.toThrow('Request aborted');
    });
  });
});
