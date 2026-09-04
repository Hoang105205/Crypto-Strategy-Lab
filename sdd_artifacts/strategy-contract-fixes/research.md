# Research: strategy-contract-fixes

## 1. IMarketDataService.getCandlesRange() Contract Compliance (F-003)
**Finding**: The issue description claimed `BacktesterService` needs to call `getCandlesRange`. However, `kb/contracts/strategy.yaml` specifies `IBacktester.run(strategy: IStrategy, candles: Candle[], config: BacktestConfig)`. `BacktesterService` already correctly accepts `candles: Candle[]` and does not (and should not) fetch candles itself.
**Conclusion**: The implementation of `IBacktester` is already compliant with `strategy.yaml`. The `IMarketDataService` call belongs to the Job Queue worker (in `event-infrastructure`). No action needed in `backtester.service.ts`.

## 2. BacktestRequested Payload (F-004)
**Finding**: `strategy.controller.ts` is already emitting the correct payload structure using `UserBacktestRequestedPayload` from `@crypto-strategy-lab/shared`. However, `apps/backend/src/strategy/events/backtest-requested.event.ts` defines an obsolete and non-compliant `BacktestRequestedEvent` class.
**Conclusion**: Refactor `backtest-requested.event.ts` to strictly match the schema defined in `events.yaml` (including `source`, `loopRunId`, `backtestConfig` object structure) to ensure the types are aligned with the SSoT.

## 3. IBacktester and IEvaluator Signatures (F-005)
**Finding**: `BacktesterService` and `EvaluatorService` signatures were checked.
`BacktesterService.run` is `(strategy: IStrategy, candles: Candle[], config: BacktestConfig): Trade[]`.
`EvaluatorService.evaluate` is `(trades: Trade[], initialCapital: number): EvaluationMetrics`.
**Conclusion**: They exactly match `kb/contracts/strategy.yaml`. This is a verified false positive. No action needed.

## 4. IStrategyGenerator DI and SearchEngine (F-006)
**Finding**: `SearchEngine` directly imports and injects `RandomGenerator` and `DomainGuidedGenerator` concrete classes. Also, `strategy-candidate.port.ts` does not exist, violating the `IStrategyCandidatePort` boundary defined in the contract.
**Conclusion**: 
1. Create `strategy-candidate.port.ts` that implements `IStrategyCandidatePort` and exports it. It will encapsulate `SearchEngine`'s capability to generate a candidate and create a version snapshot.
2. Refactor `SearchEngine` to inject generators via an interface (e.g. using a map or factory of `IStrategyGenerator`s) instead of concrete class types.
