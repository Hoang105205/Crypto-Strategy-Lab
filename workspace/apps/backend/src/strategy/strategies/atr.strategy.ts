import { Injectable, OnModuleInit } from '@nestjs/common';
import { Candle, Signal, IStrategy, StrategyType, SignalAction } from '@crypto-strategy-lab/shared';
import { StrategyRegistry } from '../registry/strategy.registry';
import { ATR } from 'technicalindicators';

@Injectable()
export class AtrStrategy implements IStrategy, OnModuleInit {
  private readonly period = 14;

  constructor(private readonly registry: StrategyRegistry) {}

  onModuleInit() {
    this.registry.register(this);
  }

  getName(): string {
    return 'ATR';
  }

  getType(): StrategyType {
    return StrategyType.ATR;
  }

  getParameters(): Record<string, unknown> {
    return {
      period: this.period,
    };
  }

  analyze(candles: Candle[]): Signal {
    if (!candles || candles.length < this.period + 1) {
      return {
        action: SignalAction.HOLD,
        confidence: 0,
        metadata: { reason: 'Not enough candles' },
      };
    }

    const high = candles.map((c) => c.high);
    const low = candles.map((c) => c.low);
    const close = candles.map((c) => c.close);
    
    const atrResult = ATR.calculate({
      high,
      low,
      close,
      period: this.period,
    });
    
    if (atrResult.length < 2) {
      return { action: SignalAction.HOLD, confidence: 0 };
    }

    const latest = atrResult[atrResult.length - 1];
    const previous = atrResult[atrResult.length - 2];

    const latestPrice = close[close.length - 1];
    const previousPrice = close[close.length - 2];
    
    const priceChange = latestPrice - previousPrice;
    
    if (priceChange > latest * 1.5) { // Bullish breakout
      return {
        action: SignalAction.BUY,
        confidence: 0.7,
        metadata: { atr: latest, priceChange },
      };
    }
    
    if (priceChange < -latest * 1.5) { // Bearish breakout
      return {
        action: SignalAction.SELL,
        confidence: 0.7,
        metadata: { atr: latest, priceChange },
      };
    }

    return {
      action: SignalAction.HOLD,
      confidence: 0,
      metadata: { atr: latest },
    };
  }
}
