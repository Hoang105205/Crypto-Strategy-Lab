// INewsProvider Interface & RawArticle interface
// Owner: Thuan | See: ADR-0010, kb/contracts/news.yaml

import { RawArticle } from '@crypto-strategy-lab/shared';

export interface INewsProvider {
  /**
   * Fetch the latest news articles normalized to RawArticle format
   * @param limit Maximum number of articles to fetch
   * @param coin Optional coin ticker filter (e.g. 'BTC')
   */
  fetchLatest(limit?: number, coin?: string): Promise<RawArticle[]>;
}

/**
 * Injection token for INewsProvider implementations
 */
export const INEWS_PROVIDER_TOKEN = Symbol('INEWS_PROVIDER_TOKEN');
