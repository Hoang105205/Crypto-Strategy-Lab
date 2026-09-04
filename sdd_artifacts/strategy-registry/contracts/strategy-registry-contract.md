# Contract: StrategyRegistry Service Interface

## Class Interface

```typescript
export class StrategyRegistry {
  /**
   * Registers an IStrategy plugin instance.
   * Throws an Error if a strategy with the same name or key already exists.
   */
  register(strategy: IStrategy): void;

  /**
   * Retrieves a strategy by name or composite key (type:name).
   */
  get(nameOrType: string): IStrategy | undefined;

  /**
   * Executes candle analysis using the registered strategy identified by nameOrType.
   * Throws an Error if the strategy is not found.
   */
  analyze(nameOrType: string, candles: ICandle[]): ISignal;

  /**
   * Returns a deduplicated array of all registered unique strategy instances.
   */
  getAll(): IStrategy[];

  /**
   * Checks if a strategy by name or key is registered.
   */
  has(nameOrType: string): boolean;
}
```
