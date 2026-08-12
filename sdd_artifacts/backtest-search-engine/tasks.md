# Implementation Tasks: Backtest, Evaluator, Search & Versioning

**Feature**: `backtest-search-engine` | **Date**: 2026-08-12

## Execution Rules
- `[ ]` = Pending | `[x]` = Done | `[-]` = Blocked/Skipped
- `[P]` = Can be executed in parallel with other `[P]` tasks in the same phase.
- Do not proceed to the next phase until all tasks in the current phase are `[x]`.

---

### Phase 1: Core Engine Services Implementation
- [P] **T1.1**: Implement `BacktesterService` (`apps/backend/src/strategy/backtester/backtester.service.ts`). Must implement `IBacktester` and handle candle iteration, position tracking, and trade force-close.
- [P] **T1.2**: Implement `EvaluatorService` (`apps/backend/src/strategy/evaluator/evaluator.service.ts`). Must implement `IEvaluator` and compute Return, WinRate, MaxDrawdown, Sharpe Ratio, Profit Factor.
- [P] **T1.3**: Implement `RandomGenerator` (`apps/backend/src/strategy/generators/random.generator.ts`). Must implement `IStrategyGenerator`.
- [P] **T1.4**: Implement `DomainGuidedGenerator` (`apps/backend/src/strategy/generators/domain-guided.generator.ts`). Must implement `IStrategyGenerator`.
- [P] **T1.5**: Implement `StrategyVersioningService` (`apps/backend/src/strategy/versioning/strategy-versioning.service.ts`). Must create and retrieve immutable `StrategyVersion` records.

### Phase 2: Exports & Module Registration
- [ ] **T2.1**: Create barrel exports (`backtester/index.ts`, `evaluator/index.ts`, `generators/index.ts`, `versioning/index.ts`).
- [ ] **T2.2**: Update `apps/backend/src/strategy/strategy.module.ts` to provide and export all 4 services.

### Phase 3: Unit Testing
- [P] **T3.1**: Write `apps/backend/src/strategy/backtester/tests/backtester.spec.ts`.
- [P] **T3.2**: Write `apps/backend/src/strategy/evaluator/tests/evaluator.spec.ts`.
- [P] **T3.3**: Write `apps/backend/src/strategy/generators/tests/generators.spec.ts`.
- [P] **T3.4**: Write `apps/backend/src/strategy/versioning/tests/strategy-versioning.spec.ts`.
