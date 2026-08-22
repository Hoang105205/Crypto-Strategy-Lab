// News & Sentiment Constants — Sourced from kb/contracts/news.yaml & kb/CONSTITUTION.md (Art VI: Explicit Over Implicit)
// Owner: Thuan | Status: Active

/**
 * Score Boundaries
 */
export const SENTIMENT_SCORE_MIN = -1.0;
export const SENTIMENT_SCORE_MAX = 1.0;
export const SENTIMENT_NEUTRAL_SCORE = 0.0;

/**
 * VADER Sentiment Intensity Thresholds
 */
export const VADER_POSITIVE_THRESHOLD = 0.05;
export const VADER_NEGATIVE_THRESHOLD = -0.05;

/**
 * News Strategy Signal Action Thresholds (Defaults for NewsSentimentStrategy)
 */
export const DEFAULT_SENTIMENT_BUY_THRESHOLD = 0.5;   // Score > +0.5 triggers BUY
export const DEFAULT_SENTIMENT_SELL_THRESHOLD = -0.5;  // Score < -0.5 triggers SELL

/**
 * Service & System Configuration Defaults
 */
export const DEFAULT_SENTIMENT_SERVICE_URL = 'http://localhost:8000';
export const SENTIMENT_CLIENT_TIMEOUT_MS = 500;       // 500ms strict SLA timeout per ADR-0009
export const DEFAULT_NEWS_FETCH_LIMIT = 10;
export const NEWS_COLLECTION_CRON_SCHEDULE = '*/15 * * * *'; // Every 15 minutes

/**
 * Default Seed RSS Feeds (ADR-0010)
 */
export const DEFAULT_RSS_FEEDS = [
  {
    name: 'CoinDesk RSS',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss',
  },
  { name: 'CoinTelegraph RSS', url: 'https://cointelegraph.com/rss' },
  { name: 'Decrypt RSS', url: 'https://decrypt.co/feed' },
];

/**
 * Default Seed Crawler Rules (ADR-0014)
 * Single Source of Truth for Database Seeding and Runtime Fallbacks.
 */
export const DEFAULT_CRAWLER_RULES = [
  {
    domain: 'cryptoslate.com',
    targetUrl: 'https://cryptoslate.com/news/',
    containerSelector:
      'article, div.news-feed article, div.article-card, div.list-post',
    titleSelector: 'h2, h3, a.post-title',
    contentSelector: 'p, div.post-excerpt, div.excerpt',
    linkSelector: 'a[href]',
    dateSelector: 'time, span.post-date',
    isActive: true,
  },
  {
    domain: 'bitcoinmagazine.com',
    targetUrl: 'https://bitcoinmagazine.com/articles',
    containerSelector:
      'div.td_module_wrap, div.td-module-meta-info, div.td-block-span12',
    titleSelector: 'h3.entry-title a, h2 a, a',
    contentSelector: 'div.td-excerpt, p',
    linkSelector: 'h3.entry-title a, a[href]',
    dateSelector: 'time, span.td-post-date',
    isActive: true,
  },
];
