# Tasks: Strategy Registry Plugin System

**Input**: Design documents from `sdd_artifacts/strategy-registry/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/strategy-registry-contract.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project verification and initial setup

- [x] T001 Verify existing file structure at `apps/backend/src/strategy/registry/strategy.registry.ts` and test runner configuration

---

## Phase 2: Foundation

**Purpose**: Shared contract and interface readiness

- [x] T002 [Foundation] Verify imports from `@crypto-strategy-lab/shared` (`IStrategy`, `ICandle`, `ISignal`, `StrategyType`) in `apps/backend/src/strategy/registry/strategy.registry.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Register Strategy Plugin Safely (Priority: P1) 🎯 MVP

**Goal**: Implement strict strategy registration with collision detection throwing Error on duplicate name/key in `StrategyRegistry`
**Independent Test**: Register a strategy instance; verify success. Register duplicate strategy instance with same name or composite key; verify Error is thrown.

### Implementation for User Story 1

- [x] T003 [US1] Update `register(strategy: IStrategy): void` in `apps/backend/src/strategy/registry/strategy.registry.ts` to check if composite key `${strategy.getType()}:${strategy.getName()}` or short name `${strategy.getName()}` exists in `this.strategies`. Throw Error on collision per `research.md` D1.
- [x] T004 [US1] Ensure `get(nameOrType: string): IStrategy | undefined` and `has(nameOrType: string): boolean` correctly work with both composite keys and short names in `apps/backend/src/strategy/registry/strategy.registry.ts`.
- [x] T005 [US1] Ensure `getAll(): IStrategy[]` returns a deduplicated array of registered `IStrategy` instances in `apps/backend/src/strategy/registry/strategy.registry.ts`.

**Checkpoint**: User Story 1 fully functional for registration & collision handling

---

## Phase 4: User Story 2 - Analyze Market Candles via Registry Delegation (Priority: P1)

**Goal**: Expose `analyze(nameOrType: string, candles: ICandle[]): ISignal` method on `StrategyRegistry` delegating candle analysis to registered strategy
**Independent Test**: Register a strategy; invoke `registry.analyze("MA-Default", candles)`; verify signal delegation. Pass unknown strategy name; verify Error is thrown.

### Implementation for User Story 2

- [x] T006 [US2] Implement `analyze(nameOrType: string, candles: ICandle[]): ISignal` in `apps/backend/src/strategy/registry/strategy.registry.ts`. Retrieve strategy via `get(nameOrType)`. If missing, throw Error per `research.md` D2. Otherwise, delegate to `strategy.analyze(candles)`.

**Checkpoint**: User Story 2 fully functional for delegated candle analysis

---

## Phase 5: Verification & Testing

**Purpose**: Unit testing and quickstart scenario validation

- [x] T007 [P] Create unit test suite `apps/backend/src/strategy/registry/strategy.registry.spec.ts` covering:
  - Successful registration and retrieval by short name and composite key (Quickstart Scenario 1)
  - Duplicate registration attempt throwing Error (Quickstart Scenario 2)
  - Delegated `analyze()` returning signal (Quickstart Scenario 1)
  - `analyze()` with non-existent strategy throwing Error (Quickstart Scenario 3)
  - `getAll()` returning deduplicated strategy list

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Module export and clean integration

- [x] T008 [P] Ensure `StrategyRegistry` is correctly exported in `apps/backend/src/strategy/strategy.module.ts` providers and exports array.

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Start immediately
- **Foundation (Phase 2)**: Depends on Setup
- **User Story 1 (Phase 3)**: Depends on Foundation
- **User Story 2 (Phase 4)**: Depends on User Story 1
- **Verification (Phase 5)**: Depends on US1 & US2 completion
- **Polish (Phase 6)**: Depends on Verification

### Parallel Opportunities
- T007 (Unit tests) and T008 (Module export) can run in parallel after US2 completion.
