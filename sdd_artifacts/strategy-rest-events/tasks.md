# Tasks: strategy-rest-events

**Input**: Design documents from `sdd_artifacts/strategy-rest-events/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure
*(Không có task setup nào do cấu trúc module đã tồn tại)*

---

## Phase 2: Foundation

**Purpose**: Core infrastructure that MUST complete before ANY user story can start

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T001 [Foundation] Add `getVersionsByName(name: string)` method to `StrategyVersioningService` in `apps/backend/src/strategy/versioning/strategy-versioning.service.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story - 3 GET Endpoints (Priority: P1) 🎯 MVP

**Goal**: Bổ sung 3 API GET endpoint còn thiếu cho hệ thống.

### Implementation for User Story

- [ ] T002 [US] Implement `GET /api/strategies/:id` endpoint in `apps/backend/src/strategy/controllers/strategy.controller.ts` to fetch a StrategyVersion by ID.
- [ ] T003 [P] [US] Implement `GET /api/strategies/:name/versions` endpoint in `apps/backend/src/strategy/controllers/strategy.controller.ts`.
- [ ] T004 [P] [US] Implement `GET /api/strategies/backtest/:id` endpoint in `apps/backend/src/strategy/controllers/strategy.controller.ts` returning mock `BacktestResult` data.

**Checkpoint**: User Story should be fully functional and testable independently

---

## Phase 4: Polish & Cross-Cutting

**Purpose**: Improvements that affect multiple user stories

- [ ] T005 [P] Update unit tests in `apps/backend/src/strategy/controllers/tests/strategy.controller.spec.ts` for the 3 new GET endpoints.
- [ ] T006 Update file `.intent` của feature thành trạng thái hoàn thành.

---

## Dependencies & Execution Order

### Phase Dependencies
- **Foundation (Phase 2)**: T001
- **User Stories (Phase 3+)**: T002, T003, T004 phụ thuộc vào T001 (đặc biệt T003).

### Parallel Opportunities
- T003 và T004 có thể code song song trong Controller.
- T005 chạy sau cùng.
