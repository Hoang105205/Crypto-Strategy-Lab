import { Injectable } from '@nestjs/common';
import type {
  IBacktester,
  IStrategy,
  Candle,
  BacktestConfig,
  Trade,
} from '@crypto-strategy-lab/shared';
import { SignalAction } from '@crypto-strategy-lab/shared';

@Injectable()
export class BacktesterService implements IBacktester {
  run(strategy: IStrategy, candles: Candle[], config: BacktestConfig): Trade[] {
    if (!candles || candles.length === 0 || !strategy) {
      return [];
    }

    const trades: Trade[] = [];
    const initialCapital = config.initialCapital || 10000;
    const positionSizePercent = config.positionSizePercent || 100;

    let openPosition: { entryPrice: number; entryDate: Date; quantity: number } | null = null;

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      // Slice candles up to current timestamp for realistic simulation
      const currentCandles = candles.slice(0, i + 1);
      const signal = strategy.analyze(currentCandles);

      // Open LONG position if BUY signal and no position open
      if (signal.action === SignalAction.BUY && !openPosition) {
        const capitalToUse = initialCapital * (positionSizePercent / 100);
        const quantity = capitalToUse / candle.close;

        openPosition = {
          entryPrice: candle.close,
          entryDate: new Date(candle.closeTime),
          quantity,
        };
      }
      // Close LONG position if SELL signal and position open
      else if (signal.action === SignalAction.SELL && openPosition) {
        const pnl = (candle.close - openPosition.entryPrice) * openPosition.quantity;

        trades.push({
          entryPrice: openPosition.entryPrice,
          entryDate: openPosition.entryDate,
          exitPrice: candle.close,
          exitDate: new Date(candle.closeTime),
          side: 'LONG',
          pnl,
          quantity: openPosition.quantity,
        });

        openPosition = null;
      }
    }

    // Force close open position at the last candle
    if (openPosition && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const pnl = (lastCandle.close - openPosition.entryPrice) * openPosition.quantity;

      trades.push({
        entryPrice: openPosition.entryPrice,
        entryDate: openPosition.entryDate,
        exitPrice: lastCandle.close,
        exitDate: new Date(lastCandle.closeTime),
        side: 'LONG',
        pnl,
        quantity: openPosition.quantity,
      });
    }

    return trades;
  }
}
