# Tasks: Remove Update Strategy API

**Input**: Design documents from `sdd_artifacts/remove-update-strategy-api/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure
*(No setup required for this removal feature)*

---

## Phase 2: Foundation

**Purpose**: Core infrastructure that MUST complete before ANY user story can start
*(No foundation required for this removal feature)*

---

## Phase 3: User Story 1 - Immutability Enforcement (Priority: P1) 🎯 MVP

**Goal**: Ensure strategies cannot be updated.

### Implementation for User Story 1

- [x] T001 [P] [US1] Remove any `PUT` or `PATCH` endpoint definitions in `apps/backend/src/strategy/controllers/strategy.controller.ts` (if they exist).
- [x] T002 [P] [US1] Remove `updateStrategy` method from `apps/backend/src/strategy/services/strategy.service.ts` (if it exists).
- [x] T003 [P] [US1] Verify that `apps/frontend/src/app/strategy/page.tsx` and related components do not allow updating existing composite strategies in-place. If any update button exists, change it to trigger a new creation.

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: Polish & Cross-Cutting

**Purpose**: Improvements that affect multiple user stories

- [x] T004 Run quickstart.md validation scenarios to confirm a 404/405 error is returned when attempting an update.

---

## Dependencies & Execution Order

### Phase Dependencies
- **User Stories (Phase 3+)**: Can start immediately.
- **Polish (Final Phase)**: Depends on User Story 1.

### Parallel Opportunities
- T001, T002, T003 can be investigated and executed in parallel.

---

## Phase 5: Convergence

**Purpose**: Close gaps between specification and implementation
**Generated**: 2026-08-19 by /hoang-sdd-converge

*(No gaps found. Implementation perfectly matches specification.)*

---

## Phase 6: UI Refinements

**Purpose**: Minor follow-up adjustments based on user review

- [x] T005 [P] [UI] Change "Parameter Configuration" title to "PARAMETER VIEWING".
- [x] T006 [P] [UI] Limit strategies per page in the catalog to 6.
- [x] T007 [P] [UI] Refactor `ParameterEditor` to be strictly read-only for both base and composite strategies, removing the "DRAFTING" badge, `<input>` tags, and action buttons.
