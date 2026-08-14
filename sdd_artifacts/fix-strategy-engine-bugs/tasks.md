# Tasks: fix-strategy-engine-bugs

**Input**: Design documents from `sdd_artifacts/fix-strategy-engine-bugs/`
**Prerequisites**: plan.md (required), spec.md (required), research.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

- [ ] T001 Verify access to shared interfaces `IJobQueue` and `IEventBus` from `@crypto-strategy-lab/shared`

---

## Phase 2: Foundation

**Purpose**: Core infrastructure that MUST complete before ANY user story can start

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

*(No foundation tasks required for this bug fix)*

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Integrate with IJobQueue (Priority: P1) 🎯 MVP

**Goal**: As the Strategy Engine, I want to submit backtest jobs to the shared IJobQueue so that the Job Queue Worker can process them asynchronously.
**Independent Test**: Send a POST request to `/api/strategies/backtest` and verify that the job appears in BullMQ/Redis and the BacktestRequested event is emitted on the shared IEventBus.

### Implementation for User Story 1

- [ ] T002 [US1] Delete `apps/backend/src/strategy/events/event-bus.service.ts`
- [ ] T003 [US1] Remove `EventBusService` from `providers` and `exports` in `apps/backend/src/strategy/strategy.module.ts` (depends on T002)
- [ ] T004 [US1] Inject `'IJobQueue'` and `'IEventBus'` in `apps/backend/src/strategy/controllers/strategy.controller.ts`
- [ ] T005 [US1] Refactor `requestBacktest` in `strategy.controller.ts` to `await this.jobQueue.enqueue(...)` and then `this.eventBus.publish(...)` (depends on T004)

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Document API Endpoint (Priority: P2)

**Goal**: As a frontend developer or API consumer, I want the DELETE /api/strategies/:name endpoint to be documented in the API contract so that I know it exists and how to use it.
**Independent Test**: Read kb/contracts/strategy.yaml and verify the DELETE endpoint is present.

### Implementation for User Story 2

- [ ] T006 [P] [US2] Add `DELETE /api/strategies/:name` endpoint definition to `kb/contracts/strategy.yaml`

---

## Phase 5: Polish & Cross-Cutting

**Purpose**: Improvements that affect multiple user stories

- [ ] T007 Run local tests to ensure the controller changes compile and run correctly.

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundation (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundation completion
  - User stories CAN proceed in parallel (if team capacity allows)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories

### Parallel Opportunities
- T006 [US2] can run in parallel with US1 tasks because it only modifies the YAML contract.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup
2. Complete Phase 2: Foundation
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test US1 independently
5. Demo if ready

### Incremental Delivery
1. Setup + Foundation → Foundation ready
2. Add US1 → Test independently → Deploy (MVP!)
3. Add US2 → Test independently → Deploy
4. Each story adds value without breaking previous stories
