# Research: news-sentiment-sync

## Decisions

### D1: How to support Async Strategy Execution
- **Chosen**: Extend `IStrategy` with an optional `analyzeAsync` method and change `IBacktester.run()` to return `Promise<Trade[]>`.
- **Rationale**: This is the least intrusive way to allow strategies that require external I/O (like NewsSentimentStrategy) to function during backtests without forcing all mathematically pure strategies (like MACD, RSI) to rewrite their `analyze` methods. The Backtester will intelligently await if `analyzeAsync` exists.
- **Alternatives considered**: 
  - *Pre-fetching sentiment data*: We could fetch sentiment data beforehand and pass it via `Candle` metadata. Rejected because it breaks the `Candle` interface and `MarketDataService` separation of concerns.
  - *Make `analyze()` return `Promise<Signal>`*: Rejected because it requires refactoring every single strategy (MACD, RSI, Bollinger, etc.) and tests.
- **KB reference**: `kb/contracts/strategy.yaml`

### D2: Updating the Queue Worker
- **Chosen**: No major logic changes needed in `backtest.worker.ts`.
- **Rationale**: The worker already wraps the backtester call in `this.stage()`, which handles both synchronous and asynchronous returns flawlessly.
- **Alternatives considered**: N/A

### D3: Testing Considerations
- **Chosen**: Ensure existing unit tests for `backtester.service.ts` apply `await` to `backtester.run()`.
- **Rationale**: Since `run()` will now return a `Promise`, existing synchronous assertions in Jest will fail. We just need to prepend `await` in the test file.
