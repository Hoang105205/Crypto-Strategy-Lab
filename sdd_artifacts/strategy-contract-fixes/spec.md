# Specification: strategy-contract-fixes

## 1. Description
This feature fixes four critical contract compliance bugs in the Strategy Engine:
1. `IMarketDataService.getCandlesRange()`: The Backtester uses `getHistorical()` instead of `getCandlesRange(symbol, timeframe, startTime, endTime)` as defined in `kb/contracts/market-data.yaml`.
2. `BacktestRequested`: The payload emitted does not strictly match `kb/contracts/events.yaml` (missing `source`, `loopRunId`, incorrect structure for `jobId`).
3. `IBacktester.run()` and `IEvaluator.evaluate()`: Method signatures do not match `kb/contracts/strategy.yaml`.
4. `IStrategyGenerator` DI: `SearchEngine` uses concrete generators instead of the `IStrategyGenerator` interface, and it lacks the `IStrategyCandidatePort` boundary defined in the contract for the Loop Controller.

## 2. Requirements
- **FR-001 (Market Data Call)**: `BacktesterService` MUST call `IMarketDataService.getCandlesRange(symbol: string, timeframe: string, startTime: Date, endTime: Date)` using the `IMARKET_DATA_SERVICE` injection token.
- **FR-002 (Event Payload)**: `strategy.controller.ts` MUST emit the `BacktestRequested` event with a payload strictly matching `events.yaml`. It must include `jobId` at the root, and set `source: 'USER'` and `loopRunId: null` since the request originates from the API.
- **FR-003 (Signatures)**:
  - `IBacktester.run` must exactly match: `(strategy: IStrategy, candles: Candle[], config: BacktestConfig) => Trade[]`.
  - `IEvaluator.evaluate` must exactly match: `(trades: Trade[], initialCapital: number) => EvaluationMetrics`.
- **FR-004 (DI in Search Engine)**:
  - `SearchEngine` MUST depend on an array or map of `IStrategyGenerator` via Dependency Injection rather than hardcoding concrete classes.
  - Create `strategy-candidate.port.ts` implementing `IStrategyCandidatePort.generateCandidate(generatorType: 'RANDOM' | 'DOMAIN_GUIDED') => Promise<{ strategyVersionId: string, strategyName: string }>` as defined in `strategy.yaml`.

## 3. Constitution Compliance
- **Contracts SSoT**: Ensures the Strategy Engine adheres to the API constraints defined by `market-data.yaml`, `events.yaml`, and `strategy.yaml`.
- **Module Boundaries**: The `IStrategyCandidatePort` will serve as the stable boundary for the Search Loop Controller to request strategy candidates without knowing the internal generators.
- **Dependency Inversion**: Decoupling `SearchEngine` from concrete generators promotes the Extensibility principle.
