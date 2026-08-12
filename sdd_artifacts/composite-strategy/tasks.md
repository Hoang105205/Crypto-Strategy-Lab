# Implementation Tasks: Composite Strategy & Signal Combiners

**Feature**: `composite-strategy` | **Date**: 2026-08-12

## Execution Rules
- `[ ]` = Pending | `[x]` = Done | `[-]` = Blocked/Skipped
- `[P]` = Can be executed in parallel with other `[P]` tasks in the same phase.
- Do not proceed to the next phase until all tasks in the current phase are `[x]`.

---

### Phase 1: Combiner Implementations
- [P] **T1.1**: Implement `MajorityVoteCombiner` (`apps/backend/src/strategy/combiners/majority-vote.combiner.ts`). Must implement `ICombiner` and handle majority, tie, and confidence calculation.
- [P] **T1.2**: Implement `WeightedScoreCombiner` (`apps/backend/src/strategy/combiners/weighted-score.combiner.ts`). Must implement `ICombiner` and normalized weighted score calculation.
- [ ] **T1.3**: Create barrel export `apps/backend/src/strategy/combiners/index.ts`.

### Phase 2: Composite Strategy Implementation
- [ ] **T2.1**: Implement `CompositeStrategy` (`apps/backend/src/strategy/composite/composite.strategy.ts`). Must implement `IStrategy`, `OnModuleInit`, accept child strategies & `ICombiner`, and register itself in `StrategyRegistry`.
- [ ] **T2.2**: Create barrel export `apps/backend/src/strategy/composite/index.ts`.

### Phase 3: Module Registration
- [ ] **T3.1**: Update `apps/backend/src/strategy/strategy.module.ts` to export combiners and `CompositeStrategy`.

### Phase 4: Unit Testing
- [P] **T4.1**: Write `apps/backend/src/strategy/combiners/tests/majority-vote.spec.ts`.
- [P] **T4.2**: Write `apps/backend/src/strategy/combiners/tests/weighted-score.spec.ts`.
- [P] **T4.3**: Write `apps/backend/src/strategy/composite/tests/composite.strategy.spec.ts`.
