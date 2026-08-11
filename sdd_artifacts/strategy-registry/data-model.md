# Data Model: Strategy Registry Plugin System

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      StrategyRegistry                       │
├─────────────────────────────────────────────────────────────┤
│ - strategies: Map<string, IStrategy>                        │
├─────────────────────────────────────────────────────────────┤
│ + register(strategy: IStrategy): void                       │
│ + get(nameOrType: string): IStrategy | undefined            │
│ + analyze(nameOrType: string, candles: ICandle[]): ISignal │
│ + getAll(): IStrategy[]                                     │
│ + has(nameOrType: string): boolean                          │
└──────────────────────────────┬──────────────────────────────┘
                               │ manages (1:N)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                          IStrategy                          │
├─────────────────────────────────────────────────────────────┤
│ + getName(): string                                         │
│ + getType(): StrategyType                                   │
│ + analyze(candles: ICandle[]): ISignal                      │
│ + getParameters(): Record<string, any>                      │
└─────────────────────────────────────────────────────────────┘
```

## Internal Data Structures

### `strategies: Map<string, IStrategy>`
- **Keys**: 
  - Composite Key: `${strategy.getType()}:${strategy.getName()}` (e.g. `MA:MA-Cross-20-50`)
  - Name Key: `${strategy.getName()}` (e.g. `MA-Cross-20-50`)
- **Values**: `IStrategy` instance
- **Validation**: On `register(strategy)`, check `strategies.has(compositeKey)` or `strategies.has(nameKey)`. If true, throw Error.
