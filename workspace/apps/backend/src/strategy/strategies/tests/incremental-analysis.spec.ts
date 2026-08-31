import type { Candle, IStrategy } from '@crypto-strategy-lab/shared';
import { AtrStrategy } from '../atr.strategy';
import { BollingerBandsStrategy } from '../bollinger-bands.strategy';
import { MacdStrategy } from '../macd.strategy';
import { MovingAverageStrategy } from '../moving-average.strategy';
import { RsiStrategy } from '../rsi.strategy';
import { StochasticStrategy } from '../stochastic.strategy';
import { SupportResistanceStrategy } from '../support-resistance.strategy';
import { StrategyRegistry } from '../../registry/strategy.registry';

describe('built-in incremental analysis sessions', () => {
  const candles = Array.from({ length: 120 }, (_, index): Candle => {
    const close = 100 + Math.sin(index / 4) * 12 + index / 20;
    return {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      openTime: new Date(index * 3_600_000),
      closeTime: new Date((index + 1) * 3_600_000),
      open: close - Math.sin(index),
      high: close + 2,
      low: close - 2,
      close,
      volume: 10 + index,
      isClosed: true,
    };
  });

  it.each([
    ['MA', () => new MovingAverageStrategy(new StrategyRegistry())],
    ['RSI', () => new RsiStrategy(new StrategyRegistry())],
    ['Bollinger', () => new BollingerBandsStrategy(new StrategyRegistry())],
    [
      'SupportResistance',
      () => new SupportResistanceStrategy(new StrategyRegistry()),
    ],
    ['MACD', () => new MacdStrategy(new StrategyRegistry())],
    ['ATR', () => new AtrStrategy(new StrategyRegistry())],
    ['Stochastic', () => new StochasticStrategy(new StrategyRegistry())],
  ] as const)(
    '%s matches the existing batch signal at every candle',
    (_name, create) => {
      const strategy: IStrategy = create();
      const session = strategy.createAnalysisSession?.();
      expect(session).toBeDefined();

      for (let index = 0; index < candles.length; index += 1) {
        const incremental = session!.next(candles[index]);
        expect(incremental).not.toBeInstanceOf(Promise);
        expect(incremental).toEqual(
          strategy.analyze(candles.slice(0, index + 1)),
        );
      }
    },
  );
});
