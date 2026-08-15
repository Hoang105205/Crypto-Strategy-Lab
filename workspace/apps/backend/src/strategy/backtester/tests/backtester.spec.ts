import { BacktesterService } from '../backtester.service';
import type { IStrategy } from '@crypto-strategy-lab/shared';
import { StrategyType, SignalAction } from '@crypto-strategy-lab/shared';

describe('BacktesterService', () => {
  let backtester: BacktesterService;

  beforeEach(() => {
    backtester = new BacktesterService();
  });

  it('should return empty array if no candles provided', () => {
    const mockStrategy: jest.Mocked<IStrategy> = {
      getName: jest.fn().mockReturnValue('Mock'),
      getType: jest.fn().mockReturnValue(StrategyType.MA),
      getParameters: jest.fn().mockReturnValue({}),
      analyze: jest.fn().mockReturnValue({ action: SignalAction.HOLD }),
    };

    const trades = backtester.run(mockStrategy, [], { initialCapital: 10000, positionSizePercent: 100 });
    expect(trades).toHaveLength(0);
  });

  it('should simulate trade on BUY and SELL signals and force close on last candle', () => {
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

    const trades = backtester.run(mockStrategy, mockCandles, { initialCapital: 10000, positionSizePercent: 100 });

    expect(trades).toHaveLength(2);
    expect(trades[0].entryPrice).toBe(100);
    expect(trades[0].exitPrice).toBe(120);
    expect(trades[0].pnl).toBe(2000); // (120 - 100) * 100 units
  });
});
