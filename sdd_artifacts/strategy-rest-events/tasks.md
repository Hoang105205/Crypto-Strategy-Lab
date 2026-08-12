# Implementation Tasks: Strategy REST API & Event Bus Integration

**Feature**: `strategy-rest-events` | **Date**: 2026-08-12

## Execution Rules
- `[ ]` = Pending | `[x]` = Done | `[-]` = Blocked/Skipped
- `[P]` = Can be executed in parallel with other `[P]` tasks in the same phase.
- Do not proceed to the next phase until all tasks in the current phase are `[x]`.

---

### Phase 1: DTOs & Event Definitions
- [P] **T1.1**: Create `CreateCompositeDto` (`apps/backend/src/strategy/controllers/dtos/create-composite.dto.ts`).
- [P] **T1.2**: Create `RequestBacktestDto` (`apps/backend/src/strategy/controllers/dtos/request-backtest.dto.ts`).
- [P] **T1.3**: Create `BacktestRequestedEvent` (`apps/backend/src/strategy/events/backtest-requested.event.ts`).

### Phase 2: Services & Controller Implementation
- [P] **T2.1**: Implement `EventBusService` (`apps/backend/src/strategy/events/event-bus.service.ts`).
- [ ] **T2.2**: Implement `StrategyController` (`apps/backend/src/strategy/controllers/strategy.controller.ts`). Must implement routes `GET /api/strategies`, `POST /api/strategies/composite`, `POST /api/strategies/backtest`.
- [ ] **T2.3**: Create barrel exports for `controllers/index.ts` and `events/index.ts`.

### Phase 3: Module Integration
- [ ] **T3.1**: Update `apps/backend/src/strategy/strategy.module.ts` to register `StrategyController` in `controllers` and `EventBusService` in `providers`.

### Phase 4: Unit Testing
- [P] **T4.1**: Write `apps/backend/src/strategy/controllers/tests/strategy.controller.spec.ts`.
- [P] **T4.2**: Write `apps/backend/src/strategy/events/tests/event-bus.spec.ts`.
