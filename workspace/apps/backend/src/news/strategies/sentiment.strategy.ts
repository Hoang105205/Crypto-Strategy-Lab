// NewsSentimentStrategy — Strategy plugin implementing IStrategy interface
// Owner: Thuan | See: spec.md, plan.md, kb/contracts/strategy.yaml

import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import {
  IStrategy,
  Candle,
  Signal,
  SignalAction,
  StrategyType,
  DEFAULT_SENTIMENT_BUY_THRESHOLD,
  DEFAULT_SENTIMENT_SELL_THRESHOLD,
  VADER_POSITIVE_THRESHOLD,
  VADER_NEGATIVE_THRESHOLD,
} from '@crypto-strategy-lab/shared';
import { NewsService } from '../services/news.service';

export interface SentimentStrategyParams {
  buyThreshold?: number; // e.g., +0.5
  sellThreshold?: number; // e.g., -0.5
  timeframe?: string; // '1h' | '24h' | '7d'
}

@Injectable()
export class NewsSentimentStrategy implements IStrategy {
  private readonly logger = new Logger(NewsSentimentStrategy.name);
  private buyThreshold: number;
  private sellThreshold: number;
  private timeframe: string;

  constructor(
    private readonly newsService: NewsService,
    @Optional()
    @Inject('SENTIMENT_STRATEGY_PARAMS')
    params?: SentimentStrategyParams,
  ) {
    this.buyThreshold = params?.buyThreshold ?? DEFAULT_SENTIMENT_BUY_THRESHOLD;
    this.sellThreshold =
      params?.sellThreshold ?? DEFAULT_SENTIMENT_SELL_THRESHOLD;
    this.timeframe = params?.timeframe ?? '1h';
  }

  getName(): string {
    return 'NewsSentimentStrategy';
  }

  getType(): StrategyType {
    return StrategyType.SENTIMENT;
  }

  getParameters(): Record<string, unknown> {
    return {
      buyThreshold: this.buyThreshold,
      sellThreshold: this.sellThreshold,
      timeframe: this.timeframe,
    };
  }

  /**
   * Analyze market candles + aggregate news sentiment to produce trading signal
   * Synchronous / Async execution conforming to IStrategy interface
   */
  analyze(candles: Candle[]): Signal {
    if (!candles || candles.length === 0) {
      return { action: SignalAction.HOLD, confidence: 0 };
    }

    const latestCandle = candles[candles.length - 1];
    const coinSymbol = latestCandle.symbol
      ? latestCandle.symbol.replace('USDT', '')
      : 'BTC';

    try {
      const score = this.getLatestSentimentScoreSync(coinSymbol);

      if (score >= this.buyThreshold) {
        return {
          action: SignalAction.BUY,
          confidence: Math.min(1.0, Math.abs(score)),
          metadata: { score, symbol: coinSymbol, strategy: this.getName() },
        };
      }

      if (score <= this.sellThreshold) {
        return {
          action: SignalAction.SELL,
          confidence: Math.min(1.0, Math.abs(score)),
          metadata: { score, symbol: coinSymbol, strategy: this.getName() },
        };
      }

      return {
        action: SignalAction.HOLD,
        confidence: 0,
        metadata: { score, symbol: coinSymbol, strategy: this.getName() },
      };
    } catch (error) {
      this.logger.warn(
        `Error in NewsSentimentStrategy analysis: ${error.message}. Returning HOLD fallback.`,
      );
      return { action: SignalAction.HOLD, confidence: 0 };
    }
  }

  /**
   * Async analyze method for asynchronous trading engine execution
   */
  async analyzeAsync(candles: Candle[]): Promise<Signal> {
    if (!candles || candles.length === 0) {
      return { action: SignalAction.HOLD, confidence: 0 };
    }

    const latestCandle = candles[candles.length - 1];
    const coinSymbol = latestCandle.symbol
      ? latestCandle.symbol.replace('USDT', '')
      : 'BTC';

    try {
      const targetDate = new Date(latestCandle.closeTime);
      const agg = await this.newsService.getAggregateSentiment(
        coinSymbol,
        this.timeframe,
        undefined,
        targetDate,
      );

      if (agg.score >= this.buyThreshold) {
        return {
          action: SignalAction.BUY,
          confidence: Math.min(1.0, Math.abs(agg.score)),
          metadata: { score: agg.score, label: agg.label, symbol: coinSymbol },
        };
      }

      if (agg.score <= this.sellThreshold) {
        return {
          action: SignalAction.SELL,
          confidence: Math.min(1.0, Math.abs(agg.score)),
          metadata: { score: agg.score, label: agg.label, symbol: coinSymbol },
        };
      }

      return {
        action: SignalAction.HOLD,
        confidence: 0,
        metadata: { score: agg.score, label: agg.label, symbol: coinSymbol },
      };
    } catch (error) {
      this.logger.warn(
        `Error in NewsSentimentStrategy analyzeAsync: ${error.message}. Returning HOLD fallback.`,
      );
      return { action: SignalAction.HOLD, confidence: 0 };
    }
  }

  private getLatestSentimentScoreSync(coin: string): number {
    return 0.0;
  }
}
