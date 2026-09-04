# Quickstart: Backtest Engine, Evaluator, Generators & Versioning

```typescript
// 1. Run a Backtest
const backtester = new BacktesterService();
const trades = backtester.run(strategy, candles, { initialCapital: 10000, positionSizePercent: 100 });

// 2. Evaluate Performance
const evaluator = new EvaluatorService();
const metrics = evaluator.evaluate(trades, 10000);
console.log(`WinRate: ${metrics.winRate * 100}%, Return: ${metrics.totalReturn * 100}%`);

// 3. Generate Search Candidates
const generator = new DomainGuidedGenerator(registry);
const candidateStrategies = generator.generate(5);

// 4. Save Version Snapshot
const versioning = new StrategyVersioningService();
const version = versioning.createVersion(strategy);
```
