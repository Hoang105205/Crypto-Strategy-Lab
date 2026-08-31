import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Candle,
  Signal,
  IStrategy,
  IStrategyAnalysisSession,
  StrategyType,
  SignalAction,
} from '@crypto-strategy-lab/shared';
import { StrategyRegistry } from '../registry/strategy.registry';
import { SMA } from 'technicalindicators';

@Injectable()
export class MovingAverageStrategy implements IStrategy, OnModuleInit {
  private readonly period = 14;

  constructor(private readonly registry: StrategyRegistry) {}

  onModuleInit() {
    this.registry.register(this);
  }

  getName(): string {
    return 'MovingAverage';
  }

  getType(): StrategyType {
    return StrategyType.MA;
  }

  getParameters(): Record<string, unknown> {
    return {
      period: this.period,
    };
  }

  createAnalysisSession(): IStrategyAnalysisSession {
    const sma = new SMA({ period: this.period, values: [] });
    let count = 0;
    let previousPrice: number | undefined;
    let previousSma: number | undefined;
    return {
      next: (candle) => {
        count += 1;
        const latestPrice = candle.close;
        const latestSma = sma.nextValue(latestPrice);
        const priorPrice = previousPrice;
        const priorSma = previousSma ?? latestSma;
        previousPrice = latestPrice;
        if (latestSma !== undefined) previousSma = latestSma;
        if (
          count < this.period ||
          latestSma === undefined ||
          priorPrice === undefined
        ) {
          return {
            action: SignalAction.HOLD,
            confidence: 0,
            metadata: { reason: 'Not enough candles' },
          };
        }
        if (priorPrice <= (priorSma ?? latestSma) && latestPrice > latestSma) {
          return {
            action: SignalAction.BUY,
            confidence: 0.8,
            metadata: { price: latestPrice, sma: latestSma },
          };
        }
        if (priorPrice >= (priorSma ?? latestSma) && latestPrice < latestSma) {
          return {
            action: SignalAction.SELL,
            confidence: 0.8,
            metadata: { price: latestPrice, sma: latestSma },
          };
        }
        return {
          action: SignalAction.HOLD,
          confidence: 0,
          metadata: { price: latestPrice, sma: latestSma },
        };
      },
    };
  }

  analyze(candles: Candle[]): Signal {
    if (!candles || candles.length < this.period) {
      return {
        action: SignalAction.HOLD,
        confidence: 0,
        metadata: { reason: 'Not enough candles' },
      };
    }

    const closePrices = candles.map((c) => c.close);
    const smaValues = SMA.calculate({
      period: this.period,
      values: closePrices,
    });

    if (smaValues.length === 0) {
      return { action: SignalAction.HOLD, confidence: 0 };
    }

    const latestPrice = closePrices[closePrices.length - 1];
    const latestSMA = smaValues[smaValues.length - 1];
    const previousPrice = closePrices[closePrices.length - 2];
    const previousSMA =
      smaValues.length > 1 ? smaValues[smaValues.length - 2] : latestSMA;

    // Cross Above SMA -> BUY
    if (previousPrice <= previousSMA && latestPrice > latestSMA) {
      return {
        action: SignalAction.BUY,
        confidence: 0.8,
        metadata: { price: latestPrice, sma: latestSMA },
      };
    }

    // Cross Below SMA -> SELL
    if (previousPrice >= previousSMA && latestPrice < latestSMA) {
      return {
        action: SignalAction.SELL,
        confidence: 0.8,
        metadata: { price: latestPrice, sma: latestSMA },
      };
    }

    return {
      action: SignalAction.HOLD,
      confidence: 0,
      metadata: { price: latestPrice, sma: latestSMA },
    };
  }
}
