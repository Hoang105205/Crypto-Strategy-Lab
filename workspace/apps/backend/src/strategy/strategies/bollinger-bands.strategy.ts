import { Injectable, OnModuleInit } from '@nestjs/common';
import { Candle, Signal, IStrategy, StrategyType, SignalAction } from '@crypto-strategy-lab/shared';
import { StrategyRegistry } from '../registry/strategy.registry';
import { BollingerBands } from 'technicalindicators';

@Injectable()
export class BollingerBandsStrategy implements IStrategy, OnModuleInit {
  private readonly period = 20;
  private readonly stdDev = 2;

  constructor(private readonly registry: StrategyRegistry) {}

  onModuleInit() {
    this.registry.register(this);
  }

  getName(): string {
    return 'BollingerBands';
  }

  getType(): StrategyType {
    return StrategyType.BOLLINGER;
  }

  getParameters(): Record<string, unknown> {
    return {
      period: this.period,
      stdDev: this.stdDev,
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
    const bbValues = BollingerBands.calculate({
      period: this.period,
      values: closePrices,
      stdDev: this.stdDev,
    });
    
    if (bbValues.length === 0) {
      return { action: SignalAction.HOLD, confidence: 0 };
    }

    const latestBB = bbValues[bbValues.length - 1];
    const latestPrice = closePrices[closePrices.length - 1];
    
    // Mean reversion logic
    // Price drops below or touches the lower band -> BUY
    if (latestPrice <= latestBB.lower) {
      return {
        action: SignalAction.BUY,
        confidence: 0.8,
        metadata: { price: latestPrice, lower: latestBB.lower, middle: latestBB.middle, upper: latestBB.upper },
      };
    }

    // Price rises above or touches the upper band -> SELL
    if (latestPrice >= latestBB.upper) {
      return {
        action: SignalAction.SELL,
        confidence: 0.8,
        metadata: { price: latestPrice, lower: latestBB.lower, middle: latestBB.middle, upper: latestBB.upper },
      };
    }

    return {
      action: SignalAction.HOLD,
      confidence: 0,
      metadata: { price: latestPrice, lower: latestBB.lower, middle: latestBB.middle, upper: latestBB.upper },
    };
  }
}
