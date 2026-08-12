import { Injectable } from '@nestjs/common';
import type { IEvaluator, Trade, EvaluationMetrics } from '@crypto-strategy-lab/shared';

@Injectable()
export class EvaluatorService implements IEvaluator {
  evaluate(trades: Trade[], initialCapital: number): EvaluationMetrics {
    if (!trades || trades.length === 0 || initialCapital <= 0) {
      return {
        totalReturn: 0,
        winRate: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        profitFactor: 0,
        totalTrades: 0,
      };
    }

    const totalTrades = trades.length;
    let totalPnl = 0;
    let winningTrades = 0;
    let grossProfit = 0;
    let grossLoss = 0;

    const returns: number[] = [];
    let currentEquity = initialCapital;
    let peakEquity = initialCapital;
    let maxDrawdown = 0;

    for (const trade of trades) {
      totalPnl += trade.pnl;

      if (trade.pnl > 0) {
        winningTrades++;
        grossProfit += trade.pnl;
      } else if (trade.pnl < 0) {
        grossLoss += Math.abs(trade.pnl);
      }

      currentEquity += trade.pnl;
      returns.push(trade.pnl / initialCapital);

      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      }

      const drawdown = (peakEquity - currentEquity) / peakEquity;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    const totalReturn = totalPnl / initialCapital;
    const winRate = winningTrades / totalTrades;
    const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 100 : 0) : grossProfit / grossLoss;

    // Sharpe Ratio calculation
    const meanReturn = returns.reduce((a, b) => a + b, 0) / totalTrades;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (totalTrades || 1);
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev === 0 ? 0 : (meanReturn / stdDev) * Math.sqrt(252);

    return {
      totalReturn,
      winRate,
      maxDrawdown,
      sharpeRatio: isNaN(sharpeRatio) ? 0 : sharpeRatio,
      profitFactor,
      totalTrades,
    };
  }
}
