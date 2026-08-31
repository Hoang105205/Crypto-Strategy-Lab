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
import { Stochastic } from 'technicalindicators';

@Injectable()
export class StochasticStrategy implements IStrategy, OnModuleInit {
  private readonly period = 14;
  private readonly signalPeriod = 3;
  private readonly overbought = 80;
  private readonly oversold = 20;

  constructor(private readonly registry: StrategyRegistry) {}

  onModuleInit() {
    this.registry.register(this);
  }

  getName(): string {
    return 'Stochastic';
  }

  getType(): StrategyType {
    return StrategyType.STOCHASTIC;
  }

  getParameters(): Record<string, unknown> {
    return {
      period: this.period,
      signalPeriod: this.signalPeriod,
      overbought: this.overbought,
      oversold: this.oversold,
    };
  }

  createAnalysisSession(): IStrategyAnalysisSession {
    const stochastic = new Stochastic({
      period: this.period,
      signalPeriod: this.signalPeriod,
      high: [],
      low: [],
      close: [],
    });
    let count = 0;
    let previous: ReturnType<Stochastic['nextValue']> | undefined;
    return {
      next: (candle) => {
        count += 1;
        const latest = stochastic.nextValue({
          high: candle.high,
          low: candle.low,
          close: candle.close,
        } as unknown as Parameters<Stochastic['nextValue']>[0]);
        if (count < this.period) {
          if (latest) previous = latest;
          return {
            action: SignalAction.HOLD,
            confidence: 0,
            metadata: { reason: 'Not enough candles' },
          };
        }
        if (
          !latest ||
          !previous ||
          latest.k === undefined ||
          latest.d === undefined ||
          previous.k === undefined ||
          previous.d === undefined
        ) {
          if (latest) previous = latest;
          return { action: SignalAction.HOLD, confidence: 0 };
        }
        const prior = previous;
        previous = latest;
        const metadata = { k: latest.k, d: latest.d };
        if (
          prior.k < prior.d &&
          latest.k > latest.d &&
          latest.k < this.oversold
        ) {
          return { action: SignalAction.BUY, confidence: 0.8, metadata };
        }
        if (
          prior.k > prior.d &&
          latest.k < latest.d &&
          latest.k > this.overbought
        ) {
          return { action: SignalAction.SELL, confidence: 0.8, metadata };
        }
        return { action: SignalAction.HOLD, confidence: 0, metadata };
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

    const high = candles.map((c) => c.high);
    const low = candles.map((c) => c.low);
    const close = candles.map((c) => c.close);

    const stochResult = Stochastic.calculate({
      high,
      low,
      close,
      period: this.period,
      signalPeriod: this.signalPeriod,
    });

    if (stochResult.length < 2) {
      return { action: SignalAction.HOLD, confidence: 0 };
    }

    const latest = stochResult[stochResult.length - 1];
    const previous = stochResult[stochResult.length - 2];

    if (
      latest.k === undefined ||
      latest.d === undefined ||
      previous.k === undefined ||
      previous.d === undefined
    ) {
      return { action: SignalAction.HOLD, confidence: 0 };
    }

    // Bullish crossover in oversold region
    if (
      previous.k < previous.d &&
      latest.k > latest.d &&
      latest.k < this.oversold
    ) {
      return {
        action: SignalAction.BUY,
        confidence: 0.8,
        metadata: { k: latest.k, d: latest.d },
      };
    }

    // Bearish crossover in overbought region
    if (
      previous.k > previous.d &&
      latest.k < latest.d &&
      latest.k > this.overbought
    ) {
      return {
        action: SignalAction.SELL,
        confidence: 0.8,
        metadata: { k: latest.k, d: latest.d },
      };
    }

    return {
      action: SignalAction.HOLD,
      confidence: 0,
      metadata: { k: latest.k, d: latest.d },
    };
  }
}
