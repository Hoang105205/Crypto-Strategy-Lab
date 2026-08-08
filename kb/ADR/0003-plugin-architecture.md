# ADR-0003: Plugin Architecture for Strategies

## Status
Accepted

## Context
The system requires support for multiple trading strategies (MA, RSI, Bollinger Bands, Support/Resistance, Sentiment, and future additions). New strategies must be addable without modifying the backtester, evaluator, leaderboard, or any downstream consumer. The grading criterion explicitly targets **modifiability** — demonstrating that extension points require minimal code changes.

## Decision Drivers
- **Extensibility requirement**: Adding `MACDStrategy` must require only 1 new file + 1 `register()` call — zero changes elsewhere.
- **Open-Closed Principle (OCP)**: The system must be open for extension (new strategies) but closed for modification (existing code).
- **Uniform treatment**: Single strategies and composite strategies must be treated identically by the backtester and evaluator.
- **Runtime flexibility**: Strategies can be registered and composed at runtime, not just at compile time.
- **Team independence**: Huy (Strategy Engine), Member C (NewsSentimentStrategy), and Phương (Loop Controller) must work independently.

## Considered Options
1. **Hard-coded switch/case** — Each strategy handled in a switch. Violates OCP.
2. **Inheritance hierarchy** — Abstract base class with concrete subclasses. Coupling between strategies.
3. **Strategy Registry (Plugin Pattern)** — All strategies implement `IStrategy`. A central registry manages registration and lookup. Consumers work with `IStrategy` — never concrete types.

## Decision Outcome
Chosen option: **Strategy Registry (Plugin Pattern)**, because it satisfies OCP, enables runtime registration, and makes the extensibility scenario demonstrable.

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                 StrategyRegistry                     │
│                                                     │
│  register(strategy: IStrategy): void                │
│  get(name: string): IStrategy                       │
│  getAll(): IStrategy[]                              │
│  analyze(name: string, candles: Candle[]): Signal │
│                                                     │
│  Internal: Map<string, IStrategy>                   │
└─────────┬───────────────────────────────────────────┘
          │ implements IStrategy
          │
    ┌─────┴─────────────────────────────────────────┐
    │               IStrategy                        │
    │  name: string                                  │
    │  type: StrategyType                            │
    │  analyze(candles: Candle[]): Signal           │
    │  getParameters(): Record<string, any>           │
    └──┬──────┬──────┬──────┬──────┬────────────────┘
       │      │      │      │      │
      MA    RSI  Bollinger  SR  Sentiment  ... (future)
```

### Registration Flow
```typescript
// 1. Create strategy file: src/strategy/strategies/macd.strategy.ts
export class MACDStrategy implements IStrategy { ... }

// 2. Register in module init:
registry.register(new MACDStrategy({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }));

// Done. Backtester, Evaluator, Leaderboard, Search — all unchanged.
```

### Consequences
- **Positive**: Adding a strategy is O(1) effort. Backtester and Evaluator are strategy-agnostic. NewsSentimentStrategy (Member C) plugs in the same way. Demonstrable in final demo.
- **Positive**: Composite strategies implement `IStrategy` too, enabling recursive composition (a composite can contain other composites).
- **Negative**: The Registry is a central point — if it has a bug, all strategies are affected.
- **Negative**: Strategy discovery is manual (`register()` call). No auto-discovery from filesystem (YAGNI for this project scope).
- **Risks**: Strategy name collisions (mitigated by unique name validation in `register()`).

## Links
- Relates to ADR-0001 (Record Architecture Decisions)
- Relates to ADR-0008 (Strategy Versioning)
- Affects: `kb/modules/strategy-engine.md` (Section 3 — Design Patterns)
