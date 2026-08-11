import { StrategyRegistry } from './strategy.registry';
import { Candle, Signal, IStrategy, SignalAction, StrategyType } from '@crypto-strategy-lab/shared';

describe('StrategyRegistry', () => {
  let registry: StrategyRegistry;

  const createMockStrategy = (name: string, type: StrategyType = StrategyType.MA): IStrategy => ({
    getName: () => name,
    getType: () => type,
    getParameters: () => ({ period: 20 }),
    analyze: jest.fn((candles: Candle[]): Signal => ({
      action: SignalAction.BUY,
      confidence: 0.95,
      metadata: { reason: `Signal from ${name}` },
    })),
  });

  beforeEach(() => {
    registry = new StrategyRegistry();
  });

  it('should register and retrieve a strategy by short name and composite key', () => {
    const strategy = createMockStrategy('MA-Default', StrategyType.MA);
    registry.register(strategy);

    expect(registry.has('MA-Default')).toBe(true);
    expect(registry.has('MA:MA-Default')).toBe(true);
    expect(registry.get('MA-Default')).toBe(strategy);
    expect(registry.get('MA:MA-Default')).toBe(strategy);
  });

  it('should throw an error when registering a duplicate strategy name or key', () => {
    const strategy1 = createMockStrategy('MA-Default', StrategyType.MA);
    const strategy2 = createMockStrategy('MA-Default', StrategyType.MA);

    registry.register(strategy1);

    expect(() => registry.register(strategy2)).toThrow(
      "Strategy collision: strategy 'MA-Default' or key 'MA:MA-Default' is already registered",
    );
  });

  it('should throw an error when registering null or undefined strategy', () => {
    expect(() => registry.register(null as unknown as IStrategy)).toThrow(
      'Strategy instance cannot be null or undefined',
    );
  });

  it('should delegate analyze() to the registered strategy', () => {
    const strategy = createMockStrategy('MA-Default', StrategyType.MA);
    registry.register(strategy);

    const mockCandles: Candle[] = [
      {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        openTime: new Date(),
        closeTime: new Date(),
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000,
        isClosed: true,
      },
    ];

    const signal = registry.analyze('MA-Default', mockCandles);

    expect(strategy.analyze).toHaveBeenCalledWith(mockCandles);
    expect(signal.action).toBe(SignalAction.BUY);
    expect(signal.metadata?.reason).toBe('Signal from MA-Default');
  });

  it('should throw an error when calling analyze() for an unregistered strategy', () => {
    const mockCandles: Candle[] = [];

    expect(() => registry.analyze('NonExistentStrategy', mockCandles)).toThrow(
      "Strategy 'NonExistentStrategy' not found in registry",
    );
  });

  it('should return a deduplicated array of all registered strategies via getAll()', () => {
    const strat1 = createMockStrategy('MA-20', StrategyType.MA);
    const strat2 = createMockStrategy('RSI-14', StrategyType.RSI);

    registry.register(strat1);
    registry.register(strat2);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(strat1);
    expect(all).toContain(strat2);
  });
});
