---
name: hoang-sdd-tasks
description: "hoang-sdd Tasks — decomposes a plan into phased, dependency-ordered, executable tasks (tasks.md). Reads plan.md, spec.md, contracts/, data-model.md. Use after /hoang-sdd-plan completes."
allowed-tools: Read, Write, Bash(find *), Bash(ls *), Bash(wc *)
---

# hoang-sdd Tasks

Decompose a plan into an actionable, dependency-ordered task list.

## User Input

```
$ARGUMENTS
```

No additional input required. The skill reads from the feature directory.

## Pre-Execution

### 1. Locate Feature Directory

Read `sdd_artifacts/` to find the target feature. If multiple features exist without a `.intent`, ask the user which one.

### 2. Load Required Artifacts

Read in order:
1. `kb/CONSTITUTION.md` (for testing/quality gates)
2. `kb/ARCHITECTURE.md` (for source code structure)
3. `kb/MODULES.md` (for module boundaries)
4. `kb/modules/` (relevant module architecture files for component-level task breakdown)
5. `kb/flows/` (relevant E2E flows to understand cross-module interactions in tasks)
6. `sdd_artifacts/[feature-name]/spec.md` (REQUIRED)
7. `sdd_artifacts/[feature-name]/plan.md` (REQUIRED)
8. `sdd_artifacts/[feature-name]/data-model.md` (if exists)
9. `sdd_artifacts/[feature-name]/contracts/` (if exists)
10. `sdd_artifacts/[feature-name]/research.md` (if exists)

If `plan.md` doesn't exist, **STOP** and tell the user to run `/hoang-sdd-plan` first.

## Execution

### 3. Generate tasks.md

Use this strict format:

```markdown
# Tasks: [FEATURE NAME]

**Input**: Design documents from `sdd_artifacts/[feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure per implementation plan: [list dirs from plan.md]
- [ ] T002 Initialize dependencies per research.md: [list from research.md]
- [ ] T003 [P] Configure linting, formatting, and git hooks

---

## Phase 2: Foundation

**Purpose**: Core infrastructure that MUST complete before ANY user story can start

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [Foundation] Set up database schema and migrations per data-model.md
- [ ] T005 [P] [Foundation] Implement authentication/authorization framework per kb/ARCHITECTURE.md
- [ ] T006 [P] [Foundation] Set up API routing, middleware, and error handling per contracts/
- [ ] T007 [P] [Foundation] Configure logging and observability per constitution

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [from spec.md user story 1]
**Independent Test**: [from spec.md]

### Implementation for User Story 1

- [ ] T008 [P] [US1] Create [Entity1] model in src/models/[entity1].[ext] per data-model.md
- [ ] T009 [P] [US1] Create [Entity2] model in src/models/[entity2].[ext] per data-model.md
- [ ] T010 [US1] Implement [Service] in src/services/[service].[ext] (depends T008, T009)
- [ ] T011 [US1] Implement [endpoint] in src/api/[file].[ext] per contracts/[entity].md
- [ ] T012 [US1] Add validation and error handling per contracts/[entity].md error section
- [ ] T013 [US1] Add logging for US1 operations per constitution

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - [Title] (Priority: P2)
[Same structure as Phase 3]

---

## Phase N: Polish & Cross-Cutting

**Purpose**: Improvements that affect multiple user stories

- [ ] TXXX [P] Documentation updates
- [ ] TXXX Code cleanup and refactoring
- [ ] TXXX Performance optimization
- [ ] TXXX Security hardening per constitution
- [ ] TXXX Run quickstart.md validation scenarios

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
- All Setup [P] tasks can run in parallel
- All Foundation [P] tasks can run in parallel
- Once Foundation completes, different user stories can start in parallel
- Within a user story: models marked [P] can run in parallel

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
```

## Task Generation Rules

1. **Each task is atomic** — one clear deliverable, one set of files.
2. **File paths are exact** — use the source code structure from `plan.md`.
3. **Dependencies are explicit** — mention which task IDs a task depends on.
4. **Constitution gates are respected** — if the constitution requires tests-first, generate test tasks before implementation tasks.
5. **Cross-reference contracts** — each API endpoint task must reference its contract file.
6. **Cross-reference data model** — each model task must reference the entity in `data-model.md`.
7. **User story priority order** — P1 (MVP) first, then P2, P3, etc.
8. **Max 50 tasks** — if a feature needs more, split it into sub-features.

## Completion Report

Report:
- Total tasks generated
- Phase breakdown (how many tasks per phase)
- Parallel opportunities ([P] count)
- Recommended next step: `/hoang-sdd-implement`