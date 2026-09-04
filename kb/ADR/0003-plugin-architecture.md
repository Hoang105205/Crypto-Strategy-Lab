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
    │  createAnalysisSession?(): Session            │
    │  getParameters(): Record<string, any>           │
    └──┬──────┬──────┬──────┬──────┬────────────────┘
       │      │      │      │      │
      MA    RSI  Bollinger  SR  Sentiment  ... (future)
```

### Incremental Analysis Sessions for Performance Optimization

To prevent $O(M^2)$ history re-calculation during backtesting ($M$ candles), strategies can optionally implement `createAnalysisSession()`:
- **Session API**: Returns an `IStrategyAnalysisSession` instance with a `next(candle: Candle): Signal` method. Indicators advance chronologically in $O(1)$ per candle ($O(M)$ total execution time).
- **State Isolation**: Each backtest creates a fresh, isolated session instance, ensuring state is never leaked or shared across concurrent backtest jobs.
- **Backward Compatibility**: `analyze(candles)` remains the direct compatibility contract. If a plugin omits `createAnalysisSession()`, the `Backtester` falls back to prefix-based evaluation without breaking contract.

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
- **Positive**: Incremental sessions optimize backtest execution time from $O(M^2)$ to $O(M)$ while maintaining clean fallback compatibility.
- **Negative**: The Registry is a central point — if it has a bug, all strategies are affected.
- **Negative**: Strategy discovery is manual (`register()` call). No auto-discovery from filesystem (YAGNI for this project scope).
- **Risks**: Strategy name collisions (mitigated by unique name validation in `register()`).


## Links
- Relates to ADR-0001 (Record Architecture Decisions)
- Relates to ADR-0008 (Strategy Versioning)
- Affects: `kb/modules/strategy-engine.md` (Section 3 — Design Patterns)
