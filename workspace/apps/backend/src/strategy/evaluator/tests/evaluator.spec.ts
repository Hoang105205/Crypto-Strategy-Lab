import { EvaluatorService } from '../evaluator.service';
import type { Trade } from '@crypto-strategy-lab/shared';

describe('EvaluatorService', () => {
  let evaluator: EvaluatorService;

  beforeEach(() => {
    evaluator = new EvaluatorService();
  });

  it('should return zeros for empty trades', () => {
    const metrics = evaluator.evaluate([], 10000);
    expect(metrics.totalTrades).toBe(0);
    expect(metrics.totalReturn).toBe(0);
    expect(metrics.winRate).toBe(0);
  });

  it('should evaluate trade performance metrics correctly', () => {
    const mockTrades: Trade[] = [
      { entryDate: new Date(), exitDate: new Date(), entryPrice: 100, exitPrice: 110, side: 'LONG', pnl: 1000, quantity: 100 },
      { entryDate: new Date(), exitDate: new Date(), entryPrice: 110, exitPrice: 105, side: 'LONG', pnl: -500, quantity: 100 },
      { entryDate: new Date(), exitDate: new Date(), entryPrice: 105, exitPrice: 120, side: 'LONG', pnl: 1500, quantity: 100 },
    ];

    const metrics = evaluator.evaluate(mockTrades, 10000);

    expect(metrics.totalTrades).toBe(3);
    expect(metrics.winRate).toBeCloseTo(2 / 3); // 2 wins out of 3
    expect(metrics.totalReturn).toBe(0.2); // (1000 - 500 + 1500) / 10000 = 2000 / 10000 = 0.2
    expect(metrics.profitFactor).toBe(5); // Gross profit (2500) / Gross loss (500) = 5
    expect(metrics.sharpeRatio).toBeGreaterThan(0);
  });
});
