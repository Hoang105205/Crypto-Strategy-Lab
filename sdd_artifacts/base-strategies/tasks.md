# Implementation Tasks: Base Technical Strategies

**Feature**: `base-strategies` | **Date**: 2026-08-12

## Execution Rules
- `[ ]` = Pending | `[x]` = Done | `[-]` = Blocked/Skipped
- `[P]` = Can be executed in parallel with other `[P]` tasks in the same phase.
- Do not proceed to the next phase until all tasks in the current phase are `[x]`.

---

### Phase 1: Setup & Dependencies
- [ ] **T1.1**: Install `technicalindicators` into the workspace (`npm install technicalindicators`).

### Phase 2: Strategy Implementations
- [P] **T2.1**: Implement `MovingAverageStrategy` (`apps/backend/src/strategy/strategies/moving-average.strategy.ts`). Must implement `IStrategy`, `OnModuleInit`, and use `SMA` from `technicalindicators`.
- [P] **T2.2**: Implement `RsiStrategy` (`apps/backend/src/strategy/strategies/rsi.strategy.ts`). Must use `RSI` from `technicalindicators`.
- [P] **T2.3**: Implement `BollingerBandsStrategy` (`apps/backend/src/strategy/strategies/bollinger-bands.strategy.ts`). Must use `BollingerBands` from `technicalindicators`.
- [P] **T2.4**: Implement `SupportResistanceStrategy` (`apps/backend/src/strategy/strategies/support-resistance.strategy.ts`). Must implement rolling local extrema algorithm as designed.

### Phase 3: Module Registration
- [ ] **T3.1**: Create barrel export `apps/backend/src/strategy/strategies/index.ts` exporting all 4 strategies.
- [ ] **T3.2**: Update `apps/backend/src/strategy/strategy.module.ts` to include the 4 strategies in the `providers` array.

### Phase 4: Unit Testing
- [P] **T4.1**: Write `apps/backend/src/strategy/strategies/tests/moving-average.spec.ts` mocking candle data and verifying MA logic.
- [P] **T4.2**: Write `apps/backend/src/strategy/strategies/tests/rsi.spec.ts` testing overbought/oversold logic.
- [P] **T4.3**: Write `apps/backend/src/strategy/strategies/tests/bollinger-bands.spec.ts` testing standard deviation breakout logic.
- [P] **T4.4**: Write `apps/backend/src/strategy/strategies/tests/support-resistance.spec.ts` testing pivot/bounce logic.
