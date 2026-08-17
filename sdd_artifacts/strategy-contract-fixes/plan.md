# Implementation Plan: strategy-contract-fixes

This plan addresses the contract compliance gaps in the Strategy Engine.

## 1. Code Modifications

### 1.1. Refactor `BacktestRequestedEvent`
**File**: `apps/backend/src/strategy/events/backtest-requested.event.ts`
- Update the class fields to exactly match `kb/contracts/events.yaml`:
  - `jobId: string`
  - `strategyVersionId: string`
  - `pair: string`
  - `timeframe: string`
  - `startDate: Date`
  - `endDate: Date`
  - `backtestConfig: { initialCapital: number; positionSizePercent: number; commission?: number; slippage?: number }`
  - `source: BacktestSource`
  - `loopRunId: string | null`

### 1.2. Refactor `SearchEngine` DI
**File**: `apps/backend/src/strategy/search/search-engine.ts`
- Inject `IStrategyGenerator` instances using a generic injection token instead of concrete `RandomGenerator` and `DomainGuidedGenerator` types, or at minimum depend on the `IStrategyGenerator` interface programmatically.

### 1.3. Implement `IStrategyCandidatePort`
**File**: `apps/backend/src/strategy/search/strategy-candidate.port.ts` (NEW)
- Create a new service `StrategyCandidatePort` implementing `IStrategyCandidatePort`.
- Inject `SearchEngine` and `StrategyVersionService`.
- Implement `generateCandidate(generatorType: 'RANDOM' | 'DOMAIN_GUIDED'): Promise<{ strategyVersionId: string, strategyName: string }>` which generates candidates using `SearchEngine`, picks one, persists it via `StrategyVersionService`, and returns the `{ strategyVersionId, strategyName }`.

### 1.4. Update `StrategyModule`
**File**: `apps/backend/src/strategy/strategy.module.ts`
- Register `StrategyCandidatePort` in `providers` and `exports`.

## 2. False Positives (No Action)
- `F-003`: `BacktesterService` should not call `IMarketDataService` per contract. It takes `candles: Candle[]` as input. Verified compliant.
- `F-005`: `IBacktester.run()` and `IEvaluator.evaluate()` signatures already perfectly match the contract. Verified compliant.

## 3. Constitution Compliance
- **Contracts SSoT**: Ensures data models and boundaries match the YAML contracts strictly.
- **Dependency Inversion**: `SearchEngine` relies on abstractions (`IStrategyGenerator`) rather than concretions.
