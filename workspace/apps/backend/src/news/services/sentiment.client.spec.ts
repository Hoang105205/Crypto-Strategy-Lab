// SentimentClient Unit Tests — REST HTTP connection to Python VADER service & Graceful Degradation (ADR-0009)
// Owner: Thuan

import { SentimentLabel } from '@crypto-strategy-lab/shared';
import { SentimentClient } from './sentiment.client';

describe('SentimentClient', () => {
  let client: SentimentClient;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new SentimentClient();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('should return neutral score directly if text is empty or blank', async () => {
    const mockFetch = jest.fn();
    global.fetch = mockFetch;

    const resultEmpty = await client.analyzeText('');
    expect(resultEmpty).toEqual({ score: 0.0, label: SentimentLabel.NEUTRAL });

    const resultBlank = await client.analyzeText('   ');
    expect(resultBlank).toEqual({ score: 0.0, label: SentimentLabel.NEUTRAL });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should call Python FastAPI /analyze and return parsed sentiment score and label', async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ score: 0.85, label: 'POSITIVE' }),
    });
    global.fetch = mockFetch;

    const result = await client.analyzeText('Bitcoin surges past all-time high amidst strong ETF demand');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/analyze',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Bitcoin surges past all-time high amidst strong ETF demand' }),
      })
    );
    expect(result).toEqual({ score: 0.85, label: SentimentLabel.POSITIVE });
  });

  it('should implement Graceful Degradation returning neutral 0.0 on service timeout / crash (ADR-0009)', async () => {
    const mockFetch = jest.fn().mockRejectedValueOnce(new Error('fetch failed: connection refused'));
    global.fetch = mockFetch;

    const result = await client.analyzeText('Market experiences unexpected volatility');

    expect(result).toEqual({ score: 0.0, label: SentimentLabel.NEUTRAL });
  });

  it('should return neutral score when response status is non-200', async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Internal Server Error' }),
    });
    global.fetch = mockFetch;

    const result = await client.analyzeText('Some news article');

    expect(result).toEqual({ score: 0.0, label: SentimentLabel.NEUTRAL });
  });
});
