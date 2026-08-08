// News & Sentiment types — sourced from kb/contracts/news.yaml
// Owner: Thuan | Status: Active

import { SentimentLabel } from './enums';

export interface NewsArticle {
  id: string;
  source: string;
  title: string;
  content: string;
  url: string;
  publishedAt: string; // ISO8601
  crawledAt: string; // ISO8601
  relatedCoins: string[];
  sentimentScore: number; // -1.0 to 1.0
  sentimentLabel: SentimentLabel;
  createdAt: string; // ISO8601
}

export interface SentimentScore {
  id: string;
  articleId: string;
  score: number; // -1.0 to 1.0
  label: SentimentLabel;
  model: string; // 'VADER'
  scoredAt: string; // ISO8601
}

export interface RawArticle {
  source: string;
  title: string;
  content: string;
  url: string;
  publishedAt: string; // ISO8601
  relatedCoins?: string[];
}

export interface SentimentResult {
  score: number; // -1.0 to 1.0
  label: SentimentLabel;
}
