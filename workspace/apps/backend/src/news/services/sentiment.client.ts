// SentimentClient — NestJS Client communicating with Python FastAPI Sentiment Service
// Owner: Thuan | See: ADR-0009, kb/modules/news-sentiment.md Section 8

import { Injectable, Logger } from '@nestjs/common';
import { 
  SentimentResult, 
  SentimentLabel, 
  SENTIMENT_CLIENT_TIMEOUT_MS, 
  DEFAULT_SENTIMENT_SERVICE_URL,
  SENTIMENT_NEUTRAL_SCORE 
} from '@crypto-strategy-lab/shared';

@Injectable()
export class SentimentClient {
  private readonly logger = new Logger(SentimentClient.name);
  private readonly sentimentServiceUrl = process.env.SENTIMENT_SERVICE_URL || DEFAULT_SENTIMENT_SERVICE_URL;
  private readonly timeoutMs = SENTIMENT_CLIENT_TIMEOUT_MS; // Strict SLA timeout per plan.md & ADR-0009

  /**
   * Send text to Python FastAPI micro-service for VADER sentiment analysis
   * Implements Graceful Degradation: If Python service is down or times out (>500ms),
   * returns neutral fallback { score: 0.0, label: SentimentLabel.NEUTRAL } without throwing errors.
   */
  async analyzeText(text: string): Promise<SentimentResult> {
    if (!text || text.trim().length === 0) {
      return { score: SENTIMENT_NEUTRAL_SCORE, label: SentimentLabel.NEUTRAL };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.sentimentServiceUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        this.logger.warn(`Python sentiment service returned status ${response.status}. Fallback to NEUTRAL.`);
        return { score: SENTIMENT_NEUTRAL_SCORE, label: SentimentLabel.NEUTRAL };
      }

      const data = await response.json();
      return {
        score: typeof data.score === 'number' ? data.score : SENTIMENT_NEUTRAL_SCORE,
        label: (data.label as SentimentLabel) || SentimentLabel.NEUTRAL,
      };
    } catch (error) {
      clearTimeout(timer);
      // Graceful Degradation per ADR-0009 & Reliability Scenario #5
      if (error.name === 'AbortError') {
        this.logger.warn(`Sentiment service request timed out after ${this.timeoutMs}ms. Fallback to NEUTRAL.`);
      } else {
        this.logger.warn(`Failed to connect to sentiment micro-service at ${this.sentimentServiceUrl}: ${error.message}. Fallback to NEUTRAL.`);
      }
      return { score: SENTIMENT_NEUTRAL_SCORE, label: SentimentLabel.NEUTRAL };
    }
  }
}
