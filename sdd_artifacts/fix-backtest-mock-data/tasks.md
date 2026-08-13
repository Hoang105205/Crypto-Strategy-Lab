# Tasks: fix-backtest-mock-data

**Input**: Design documents from `sdd_artifacts/fix-backtest-mock-data/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

- [X] T001 Verify `SharedModule` and `PrismaService` exports in `apps/backend/src/shared/shared.module.ts`

---

## Phase 2: Foundation

**Purpose**: Core infrastructure that MUST complete before ANY user story can start

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [Foundation] Import `DatabaseModule` into `apps/backend/src/strategy/strategy.module.ts` (if not already imported) to provide access to `PrismaService`.

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Fetch Real Backtest Result (Priority: P1) 🎯 MVP

**Goal**: Thay thế mock data bằng Prisma query trong StrategyController.
**Independent Test**: Gọi API `GET /api/strategies/backtest/:id` bằng cURL/Postman với một ID hợp lệ trong DB.

### Implementation for User Story 1

- [X] T003 [US1] Inject `PrismaService` into `StrategyController` constructor in `apps/backend/src/strategy/controllers/strategy.controller.ts`.
- [X] T004 [US1] Update `getBacktestResult` endpoint in `strategy.controller.ts` to query `this.prisma.backtestResult.findUnique({ where: { id } })`.
- [X] T005 [US1] Implement 404 Not Found error handling if the Prisma query returns null.
- [X] T006 [US1] Update unit tests in `apps/backend/src/strategy/controllers/tests/strategy.controller.spec.ts` to mock `PrismaService` instead of hardcoded data.

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase N: Polish & Cross-Cutting

**Purpose**: Improvements that affect multiple user stories

- [X] T007 Run quickstart.md validation scenarios (API testing).
- [X] T008 [P] Code cleanup (remove any leftover mock variables in controller).

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundation (Phase 2)**: Depends on Setup
- **User Stories (Phase 3+)**: Depends on Foundation
- **Polish (Final Phase)**: Depends on all desired user stories

### Parallel Opportunities
- T008 can be done during T004.

---

## Phase N: Convergence

**Purpose**: Close gaps between specification and implementation
**Generated**: 2026-08-13 by /hoang-sdd-converge

*(No gaps found. Implementation is fully converged with spec and plan).*
