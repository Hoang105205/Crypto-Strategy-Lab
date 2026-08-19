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
  async run(strategy: IStrategy, candles: Candle[], config: BacktestConfig): Promise<Trade[]> {
    if (!candles || candles.length === 0 || !strategy) {
      return [];
    }

    const trades: Trade[] = [];
    const initialCapital = config.initialCapital || 10000;
    const positionSizePercent = config.positionSizePercent || 100;
    const commissionPct = (config.commission || 0) / 100;
    const slippagePct = (config.slippage || 0) / 100;

    let currentCapital = initialCapital;
    let openPosition: { entryPrice: number; rawEntryPrice: number; entryDate: Date; quantity: number; entryCommission: number } | null = null;

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      // Slice candles up to current timestamp for realistic simulation
      const currentCandles = candles.slice(0, i + 1);
      
      const signal = typeof strategy.analyzeAsync === 'function' 
        ? await strategy.analyzeAsync(currentCandles) 
        : strategy.analyze(currentCandles);

      // Open LONG position if BUY signal and no position open
      if (signal.action === SignalAction.BUY && !openPosition) {
        const capitalToUse = currentCapital * (positionSizePercent / 100);
        const entryPriceWithSlippage = candle.close * (1 + slippagePct);
        const commissionCost = capitalToUse * commissionPct;
        const quantity = (capitalToUse - commissionCost) / entryPriceWithSlippage;

        openPosition = {
          entryPrice: entryPriceWithSlippage,
          rawEntryPrice: candle.close,
          entryDate: new Date(candle.closeTime),
          quantity,
          entryCommission: commissionCost,
        };
      }
      // Close LONG position if SELL signal and position open
      else if (signal.action === SignalAction.SELL && openPosition) {
        const exitPriceWithSlippage = candle.close * (1 - slippagePct);
        const exitValue = exitPriceWithSlippage * openPosition.quantity;
        const entryValue = openPosition.entryPrice * openPosition.quantity;
        const exitCommission = exitValue * commissionPct;
        
        const pnl = (exitValue - entryValue) - exitCommission;
        currentCapital += pnl;
        
        const volumeUsd = openPosition.entryPrice * openPosition.quantity;
        const transactionCost = openPosition.entryCommission + exitCommission;
        const slippageCost = ((openPosition.entryPrice - openPosition.rawEntryPrice) + (candle.close - exitPriceWithSlippage)) * openPosition.quantity;

        trades.push({
          entryPrice: openPosition.entryPrice,
          entryDate: openPosition.entryDate,
          exitPrice: exitPriceWithSlippage,
          exitDate: new Date(candle.closeTime),
          side: 'LONG',
          pnl,
          quantity: openPosition.quantity,
          stopLoss: config.stopLossPercent ? openPosition.entryPrice * (1 - config.stopLossPercent / 100) : undefined,
          takeProfit: config.takeProfitPercent ? openPosition.entryPrice * (1 + config.takeProfitPercent / 100) : undefined,
          transactionCost,
          slippage: slippageCost,
          volumeUsd,
        });

        openPosition = null;
      }
    }

    // Force close open position at the last candle
    if (openPosition && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const exitPriceWithSlippage = lastCandle.close * (1 - slippagePct);
      const exitValue = exitPriceWithSlippage * openPosition.quantity;
      const entryValue = openPosition.entryPrice * openPosition.quantity;
      const exitCommission = exitValue * commissionPct;
      
      const pnl = (exitValue - entryValue) - exitCommission;
      currentCapital += pnl;
      
      const volumeUsd = openPosition.entryPrice * openPosition.quantity;
      const transactionCost = openPosition.entryCommission + exitCommission;
      const slippageCost = ((openPosition.entryPrice - openPosition.rawEntryPrice) + (lastCandle.close - exitPriceWithSlippage)) * openPosition.quantity;

      trades.push({
        entryPrice: openPosition.entryPrice,
        entryDate: openPosition.entryDate,
        exitPrice: exitPriceWithSlippage,
        exitDate: new Date(lastCandle.closeTime),
        side: 'LONG',
        pnl,
        quantity: openPosition.quantity,
        stopLoss: config.stopLossPercent ? openPosition.entryPrice * (1 - config.stopLossPercent / 100) : undefined,
        takeProfit: config.takeProfitPercent ? openPosition.entryPrice * (1 + config.takeProfitPercent / 100) : undefined,
        transactionCost,
        slippage: slippageCost,
        volumeUsd,
      });
    }

    return trades;
  }
}
