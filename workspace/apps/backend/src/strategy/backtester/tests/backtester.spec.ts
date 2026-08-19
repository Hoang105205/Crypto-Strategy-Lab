import { BacktesterService } from '../backtester.service';
import type { IStrategy } from '@crypto-strategy-lab/shared';
import { StrategyType, SignalAction } from '@crypto-strategy-lab/shared';

describe('BacktesterService', () => {
  let backtester: BacktesterService;

  beforeEach(() => {
    backtester = new BacktesterService();
  });

  it('should return empty array if no candles provided', async () => {
    const mockStrategy: jest.Mocked<IStrategy> = {
      getName: jest.fn().mockReturnValue('Mock'),
      getType: jest.fn().mockReturnValue(StrategyType.MA),
      getParameters: jest.fn().mockReturnValue({}),
      analyze: jest.fn().mockReturnValue({ action: SignalAction.HOLD }),
    };

    const trades = await backtester.run(mockStrategy, [], { initialCapital: 10000, positionSizePercent: 100 });
    expect(trades).toHaveLength(0);
  });

  it('should simulate trade on BUY and SELL signals and force close on last candle', async () => {
    const mockStrategy: jest.Mocked<IStrategy> = {
      getName: jest.fn().mockReturnValue('Mock'),
      getType: jest.fn().mockReturnValue(StrategyType.MA),
      getParameters: jest.fn().mockReturnValue({}),
      analyze: jest.fn()
        .mockReturnValueOnce({ action: SignalAction.HOLD }) // Candle 0
        .mockReturnValueOnce({ action: SignalAction.BUY })  // Candle 1 -> Open LONG at 100
        .mockReturnValueOnce({ action: SignalAction.HOLD }) // Candle 2
        .mockReturnValueOnce({ action: SignalAction.SELL }) // Candle 3 -> Close LONG at 120 (PnL +2000)
        .mockReturnValueOnce({ action: SignalAction.BUY }),  // Candle 4 -> Open LONG at 130 (Force close on exit)
    };

    const mockCandles = [
      { timestamp: 1000, open: 100, high: 105, low: 95, close: 100, volume: 10 },
      { timestamp: 2000, open: 100, high: 105, low: 95, close: 100, volume: 10 },
      { timestamp: 3000, open: 110, high: 115, low: 105, close: 110, volume: 10 },
      { timestamp: 4000, open: 120, high: 125, low: 115, close: 120, volume: 10 },
      { timestamp: 5000, open: 130, high: 135, low: 125, close: 130, volume: 10 },
    ] as any;

    const trades = await backtester.run(mockStrategy, mockCandles, { initialCapital: 10000, positionSizePercent: 100 });

    expect(trades).toHaveLength(2);
    expect(trades[0].entryPrice).toBe(100);
    expect(trades[0].exitPrice).toBe(120);
    expect(trades[0].pnl).toBe(2000); // (120 - 100) * 100 units
  });

  it('should calculate stopLoss, takeProfit, commission, slippage, and volumeUsd correctly', async () => {
    const mockStrategy: jest.Mocked<IStrategy> = {
      getName: jest.fn().mockReturnValue('Mock'),
      getType: jest.fn().mockReturnValue(StrategyType.MA),
      getParameters: jest.fn().mockReturnValue({}),
      analyze: jest.fn()
        .mockReturnValueOnce({ action: SignalAction.BUY })
        .mockReturnValueOnce({ action: SignalAction.SELL }),
      analyzeAsync: undefined,
    };

    const mockCandles = [
      { timestamp: 1000, open: 100, high: 105, low: 95, close: 100, closeTime: 1000 },
      { timestamp: 2000, open: 120, high: 125, low: 115, close: 120, closeTime: 2000 },
    ] as any;

    const config = {
      initialCapital: 1000,
      positionSizePercent: 100,
      commission: 0.1, // 0.1%
      slippage: 0.2, // 0.2%
      stopLossPercent: 2, // 2%
      takeProfitPercent: 5, // 5%
    };

    const trades = await backtester.run(mockStrategy, mockCandles, config);

    expect(trades).toHaveLength(1);
    
    // Entry price with 0.2% slippage on 100 = 100.2
    const expectedQuantity = 999 / 100.2;
    expect(trades[0].quantity).toBeCloseTo(expectedQuantity);

    expect(trades[0].stopLoss).toBeCloseTo(100.2 * 0.98);
    expect(trades[0].takeProfit).toBeCloseTo(100.2 * 1.05);

    // Exit price with 0.2% slippage on 120 = 119.76
    expect(trades[0].exitPrice).toBeCloseTo(119.76);

    expect(trades[0].volumeUsd).toBeCloseTo(999);
    
    const exitValue = 119.76 * expectedQuantity;
    const exitCommission = exitValue * 0.001;
    expect(trades[0].transactionCost).toBeCloseTo(1 + exitCommission);

    const expectedSlippage = (0.2 + 0.24) * expectedQuantity;
    expect(trades[0].slippage).toBeCloseTo(expectedSlippage);
  });
});
