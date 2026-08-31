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

@Injectable()
export class SupportResistanceStrategy implements IStrategy, OnModuleInit {
  private readonly lookback = 5;
  private readonly tolerancePercent = 0.005; // 0.5% tolerance for "touching" a level

  constructor(private readonly registry: StrategyRegistry) {}

  onModuleInit() {
    this.registry.register(this);
  }

  getName(): string {
    return 'SupportResistance';
  }

  getType(): StrategyType {
    return StrategyType.SR;
  }

  getParameters(): Record<string, unknown> {
    return {
      lookback: this.lookback,
      tolerancePercent: this.tolerancePercent,
    };
  }

  createAnalysisSession(): IStrategyAnalysisSession {
    const history: Candle[] = [];
    let count = 0;
    return {
      next: (candle) => {
        count += 1;
        if (count < this.lookback * 2) {
          history.push(candle);
          return {
            action: SignalAction.HOLD,
            confidence: 0,
            metadata: { reason: 'Not enough candles' },
          };
        }
        let support = Infinity;
        let resistance = 0;
        for (const historical of history) {
          if (historical.low < support) support = historical.low;
          if (historical.high > resistance) resistance = historical.high;
        }
        const isNearSupport =
          Math.abs(candle.close - support) / support <= this.tolerancePercent;
        const isNearResistance =
          Math.abs(candle.close - resistance) / resistance <=
          this.tolerancePercent;
        history.push(candle);
        if (history.length > this.lookback * 2) history.shift();
        if (candle.close < support * (1 - this.tolerancePercent)) {
          return {
            action: SignalAction.SELL,
            confidence: 0.8,
            metadata: { type: 'breakout_down', support, price: candle.close },
          };
        }
        if (candle.close > resistance * (1 + this.tolerancePercent)) {
          return {
            action: SignalAction.BUY,
            confidence: 0.8,
            metadata: { type: 'breakout_up', resistance, price: candle.close },
          };
        }
        if (isNearSupport && candle.close > candle.open) {
          return {
            action: SignalAction.BUY,
            confidence: 0.6,
            metadata: { type: 'bounce_support', support, price: candle.close },
          };
        }
        if (isNearResistance && candle.close < candle.open) {
          return {
            action: SignalAction.SELL,
            confidence: 0.6,
            metadata: {
              type: 'bounce_resistance',
              resistance,
              price: candle.close,
            },
          };
        }
        return {
          action: SignalAction.HOLD,
          confidence: 0,
          metadata: { support, resistance, price: candle.close },
        };
      },
    };
  }

  analyze(candles: Candle[]): Signal {
    if (!candles || candles.length < this.lookback * 2) {
      return {
        action: SignalAction.HOLD,
        confidence: 0,
        metadata: { reason: 'Not enough candles' },
      };
    }

    // Find local extrema over the past N candles (excluding the very last one, which is 'current')
    let support = Infinity;
    let resistance = 0;

    const historicalCandles = candles.slice(0, candles.length - 1);

    // Simple logic: lowest low is support, highest high is resistance in the window
    for (const c of historicalCandles.slice(-this.lookback * 2)) {
      if (c.low < support) support = c.low;
      if (c.high > resistance) resistance = c.high;
    }

    const latest = candles[candles.length - 1];

    const isNearSupport =
      Math.abs(latest.close - support) / support <= this.tolerancePercent;
    const isNearResistance =
      Math.abs(latest.close - resistance) / resistance <= this.tolerancePercent;

    // Breakout logic: closing decisively below support -> SELL
    if (latest.close < support * (1 - this.tolerancePercent)) {
      return {
        action: SignalAction.SELL,
        confidence: 0.8,
        metadata: { type: 'breakout_down', support, price: latest.close },
      };
    }

    // Breakout logic: closing decisively above resistance -> BUY
    if (latest.close > resistance * (1 + this.tolerancePercent)) {
      return {
        action: SignalAction.BUY,
        confidence: 0.8,
        metadata: { type: 'breakout_up', resistance, price: latest.close },
      };
    }

    // Bounce logic: near support, rejecting -> BUY
    if (isNearSupport && latest.close > latest.open) {
      return {
        action: SignalAction.BUY,
        confidence: 0.6,
        metadata: { type: 'bounce_support', support, price: latest.close },
      };
    }

    // Bounce logic: near resistance, rejecting -> SELL
    if (isNearResistance && latest.close < latest.open) {
      return {
        action: SignalAction.SELL,
        confidence: 0.6,
        metadata: {
          type: 'bounce_resistance',
          resistance,
          price: latest.close,
        },
      };
    }

    return {
      action: SignalAction.HOLD,
      confidence: 0,
      metadata: { support, resistance, price: latest.close },
    };
  }
}
