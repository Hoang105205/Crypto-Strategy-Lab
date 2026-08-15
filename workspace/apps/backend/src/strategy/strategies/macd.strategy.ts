import { Injectable, OnModuleInit } from '@nestjs/common';
import { Candle, Signal, IStrategy, StrategyType, SignalAction } from '@crypto-strategy-lab/shared';
import { StrategyRegistry } from '../registry/strategy.registry';
import { MACD } from 'technicalindicators';

@Injectable()
export class MacdStrategy implements IStrategy, OnModuleInit {
  private readonly fastPeriod = 12;
  private readonly slowPeriod = 26;
  private readonly signalPeriod = 9;

  constructor(private readonly registry: StrategyRegistry) {}

  onModuleInit() {
    this.registry.register(this);
  }

  getName(): string {
    return 'MACD';
  }

  getType(): StrategyType {
    return StrategyType.MACD;
  }

  getParameters(): Record<string, unknown> {
    return {
      fastPeriod: this.fastPeriod,
      slowPeriod: this.slowPeriod,
      signalPeriod: this.signalPeriod,
    };
  }

  analyze(candles: Candle[]): Signal {
    if (!candles || candles.length < this.slowPeriod + this.signalPeriod) {
      return {
        action: SignalAction.HOLD,
        confidence: 0,
        metadata: { reason: 'Not enough candles' },
      };
    }

    const closePrices = candles.map((c) => c.close);
    const macdResult = MACD.calculate({
      values: closePrices,
      fastPeriod: this.fastPeriod,
      slowPeriod: this.slowPeriod,
      signalPeriod: this.signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    
    if (macdResult.length < 2) {
      return { action: SignalAction.HOLD, confidence: 0 };
    }

    const latest = macdResult[macdResult.length - 1];
    const previous = macdResult[macdResult.length - 2];
    
    if (latest.MACD === undefined || latest.signal === undefined || previous.MACD === undefined || previous.signal === undefined) {
      return { action: SignalAction.HOLD, confidence: 0 };
    }

    // Cross Above Signal -> BUY
    if (previous.MACD <= previous.signal && latest.MACD > latest.signal) {
      return {
        action: SignalAction.BUY,
        confidence: 0.8,
        metadata: { macd: latest.MACD, signal: latest.signal, histogram: latest.histogram },
      };
    }

    // Cross Below Signal -> SELL
    if (previous.MACD >= previous.signal && latest.MACD < latest.signal) {
      return {
        action: SignalAction.SELL,
        confidence: 0.8,
        metadata: { macd: latest.MACD, signal: latest.signal, histogram: latest.histogram },
      };
    }

    return {
      action: SignalAction.HOLD,
      confidence: 0,
      metadata: { macd: latest.MACD, signal: latest.signal, histogram: latest.histogram },
    };
  }
}
