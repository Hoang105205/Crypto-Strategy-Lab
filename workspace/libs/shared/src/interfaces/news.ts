// News & Sentiment interfaces — sourced from kb/contracts/news.yaml
// Owner: Thuan | Status: Active

import { RawArticle, SentimentResult } from '../types/news';

export interface INewsProvider {
  fetchLatest(limit?: number, coin?: string): Promise<RawArticle[]>;
}

export interface SentimentClient {
  analyzeText(text: string): Promise<SentimentResult>;
}
