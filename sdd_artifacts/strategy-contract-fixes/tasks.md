# Tasks: strategy-contract-fixes

**Input**: Design documents from `sdd_artifacts/strategy-contract-fixes/`
**Prerequisites**: plan.md, spec.md, research.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

*(No setup tasks required for this bug fix)*

---

## Phase 2: Foundation

**Purpose**: Core infrastructure that MUST complete before ANY user story can start

*(No foundation tasks required for this bug fix)*

---

## Phase 3: User Story 1 - Fix Event Payload (Priority: P1)

**Goal**: Ensure `BacktestRequested` payload complies with `events.yaml`.

- `[ ]` T001 [US1] Update `apps/backend/src/strategy/events/backtest-requested.event.ts` to strictly match the `events.yaml` payload structure (including `source`, `loopRunId`, `backtestConfig`).

---

## Phase 4: User Story 2 - Fix Generator DI & Port (Priority: P1)

**Goal**: Ensure SearchEngine uses `IStrategyGenerator` via DI and implements `IStrategyCandidatePort`.

- `[ ]` T002 [US2] Refactor `apps/backend/src/strategy/search/search-engine.ts` to depend on the `IStrategyGenerator` interface instead of the concrete generator classes.
- `[ ]` T003 [US2] Create `apps/backend/src/strategy/search/strategy-candidate.port.ts` that implements `IStrategyCandidatePort` and generates candidates using `SearchEngine` and `StrategyVersionService`.
- `[ ]` T004 [US2] Update `apps/backend/src/strategy/search/index.ts` to export `strategy-candidate.port.ts`.
- `[ ]` T005 [US2] Update `apps/backend/src/strategy/strategy.module.ts` to register and export `StrategyCandidatePort`.

---

## Phase 5: Polish & Cross-Cutting

**Purpose**: Final compilation checks and test runs.

- `[ ]` T006 Run `npm run build` or local tests to ensure the backend module compiles correctly after these changes.

---

## Dependencies & Execution Order

- **Phase 3 and Phase 4** can be executed in parallel as they touch different files (events vs search engine).
- **T003** depends on **T002**.
- **T004** and **T005** depend on **T003**.
