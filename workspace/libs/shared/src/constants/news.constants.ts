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
