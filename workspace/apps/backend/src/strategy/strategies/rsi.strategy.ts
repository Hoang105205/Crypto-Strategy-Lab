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
import { RSI } from 'technicalindicators';

@Injectable()
export class RsiStrategy implements IStrategy, OnModuleInit {
  private readonly period = 14;
  private readonly overbought = 70;
  private readonly oversold = 30;

  constructor(private readonly registry: StrategyRegistry) {}

  onModuleInit() {
    this.registry.register(this);
  }

  getName(): string {
    return 'RelativeStrengthIndex';
  }

  getType(): StrategyType {
    return StrategyType.RSI;
  }

  getParameters(): Record<string, unknown> {
    return {
      period: this.period,
      overbought: this.overbought,
      oversold: this.oversold,
    };
  }

  createAnalysisSession(): IStrategyAnalysisSession {
    const rsi = new RSI({ period: this.period, values: [] });
    let count = 0;
    let previousRsi: number | undefined;
    return {
      next: (candle) => {
        count += 1;
        const latestRsi = rsi.nextValue(candle.close);
        if (count < this.period) {
          return {
            action: SignalAction.HOLD,
            confidence: 0,
            metadata: { reason: 'Not enough candles' },
          };
        }
        if (latestRsi === undefined)
          return { action: SignalAction.HOLD, confidence: 0 };
        const prior = previousRsi ?? latestRsi;
        previousRsi = latestRsi;
        if (prior <= this.oversold && latestRsi > this.oversold) {
          return {
            action: SignalAction.BUY,
            confidence: 0.75,
            metadata: { rsi: latestRsi },
          };
        }
        if (prior >= this.overbought && latestRsi < this.overbought) {
          return {
            action: SignalAction.SELL,
            confidence: 0.75,
            metadata: { rsi: latestRsi },
          };
        }
        if (latestRsi >= this.overbought) {
          return {
            action: SignalAction.SELL,
            confidence: 0.6,
            metadata: { rsi: latestRsi },
          };
        }
        if (latestRsi <= this.oversold) {
          return {
            action: SignalAction.BUY,
            confidence: 0.6,
            metadata: { rsi: latestRsi },
          };
        }
        return {
          action: SignalAction.HOLD,
          confidence: 0,
          metadata: { rsi: latestRsi },
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
    const rsiValues = RSI.calculate({
      period: this.period,
      values: closePrices,
    });

    if (rsiValues.length === 0) {
      return { action: SignalAction.HOLD, confidence: 0 };
    }

    const latestRsi = rsiValues[rsiValues.length - 1];
    const previousRsi =
      rsiValues.length > 1 ? rsiValues[rsiValues.length - 2] : latestRsi;

    // Cross above oversold (30) from below -> BUY signal
    if (previousRsi <= this.oversold && latestRsi > this.oversold) {
      return {
        action: SignalAction.BUY,
        confidence: 0.75,
        metadata: { rsi: latestRsi },
      };
    }

    // Cross below overbought (70) from above -> SELL signal
    if (previousRsi >= this.overbought && latestRsi < this.overbought) {
      return {
        action: SignalAction.SELL,
        confidence: 0.75,
        metadata: { rsi: latestRsi },
      };
    }

    // Strong SELL if pushing above 70, strong BUY if pushing below 30
    if (latestRsi >= this.overbought) {
      return {
        action: SignalAction.SELL,
        confidence: 0.6,
        metadata: { rsi: latestRsi },
      };
    }
    if (latestRsi <= this.oversold) {
      return {
        action: SignalAction.BUY,
        confidence: 0.6,
        metadata: { rsi: latestRsi },
      };
    }

    return {
      action: SignalAction.HOLD,
      confidence: 0,
      metadata: { rsi: latestRsi },
    };
  }
}
