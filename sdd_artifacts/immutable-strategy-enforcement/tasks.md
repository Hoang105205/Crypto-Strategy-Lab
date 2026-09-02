# Tasks: Immutable Strategy Enforcement

**Input**: Design documents from `sdd_artifacts/immutable-strategy-enforcement/`
**Prerequisites**: [`plan.md`](file:///d:/DaiHoc/KienTrucPM/sdd_artifacts/immutable-strategy-enforcement/plan.md) (required), [`spec.md`](file:///d:/DaiHoc/KienTrucPM/sdd_artifacts/immutable-strategy-enforcement/spec.md) (required), [`research.md`](file:///d:/DaiHoc/KienTrucPM/sdd_artifacts/immutable-strategy-enforcement/research.md), [`data-model.md`](file:///d:/DaiHoc/KienTrucPM/sdd_artifacts/immutable-strategy-enforcement/data-model.md), [`contracts/`](file:///d:/DaiHoc/KienTrucPM/sdd_artifacts/immutable-strategy-enforcement/contracts/)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Validate current baseline before applying changes

- [ ] T001 Verify existing test baselines and build integrity in `apps/frontend` and `apps/backend`

---

## Phase 2: User Story 1 - Elimination of Deletion from UI & Prevention of Dangling References (Priority: P1) 🎯 MVP

**Goal**: Remove all delete triggers from Frontend UI to eliminate user confusion and enforce strict 403 Forbidden in Backend to preserve child dependencies of Composite strategies per ADR-0008.
**Independent Test**: Navigate to `/strategy`, verify 0 DELETE buttons exist on any StrategyCard in Catalog; execute `DELETE /api/strategies/AnyStrategy` and verify HTTP 403 response.

### Implementation for User Story 1

- [ ] T002 [US1] Remove DELETE button rendering, `showDelete` logic, and delete-related styling from [`apps/frontend/src/components/strategy/StrategyCard.tsx`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/frontend/src/components/strategy/StrategyCard.tsx)
- [ ] T003 [US1] Remove `handleDeleteStrategy` and `onDelete` prop wiring from [`apps/frontend/src/app/strategy/page.tsx`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/frontend/src/app/strategy/page.tsx)
- [ ] T004 [P] [US1] Remove or deprecate `deleteUserStrategy` in [`apps/frontend/src/services/api-client.ts`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/frontend/src/services/api-client.ts)
- [ ] T005 [P] [US1] Set `canDelete: false` for all strategies in [`apps/backend/src/strategy/controllers/strategy.controller.ts`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/backend/src/strategy/controllers/strategy.controller.ts) `getAllStrategies`
- [ ] T006 [US1] Ensure `DELETE /api/strategies/:name` in [`apps/backend/src/strategy/controllers/strategy.controller.ts`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/backend/src/strategy/controllers/strategy.controller.ts) unconditionally rejects all requests with HTTP 403 Forbidden and ADR-0008 explanation
- [ ] T007 [US1] Update backend unit tests in [`apps/backend/src/strategy/controllers/tests/strategy.controller.spec.ts`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/backend/src/strategy/controllers/tests/strategy.controller.spec.ts) asserting unconditional 403 Forbidden on any delete attempt

**Checkpoint**: User Story 1 is fully functional. No DELETE button can be seen or clicked, and the backend permanently safeguards strategy versions.

---

## Phase 3: User Story 2 & Contract Alignment (Priority: P2)

**Goal**: Ensure parameter editor maintains immutability and contracts/documentation match the immutable architecture.
**Independent Test**: Verify `ParameterEditor` does not mutate existing strategies and `kb/contracts/strategy.yaml` reflects the prohibition of deletion.

- [ ] T008 [P] [US2] Verify and ensure [`apps/frontend/src/components/strategy/ParameterEditor.tsx`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/frontend/src/components/strategy/ParameterEditor.tsx) acts purely as an inspector and clone baseline without in-place update mutations
- [ ] T009 [P] [US2] Update API contract in [`kb/contracts/strategy.yaml`](file:///d:/DaiHoc/KienTrucPM/kb/contracts/strategy.yaml) to document that strategy deletion and in-place modification are permanently prohibited (403 Forbidden) per ADR-0008

---

## Phase 4: Polish & Verification

**Purpose**: System-wide verification and quality gate checks

- [ ] T010 [P] Run frontend typecheck and production build (`npm run build` in `apps/frontend`)
- [ ] T011 [P] Run backend unit test suite (`npm test` in `apps/backend`)
- [ ] T012 Run quickstart validation scenarios per [`sdd_artifacts/immutable-strategy-enforcement/quickstart.md`](file:///d:/DaiHoc/KienTrucPM/sdd_artifacts/immutable-strategy-enforcement/quickstart.md)

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Start immediately.
- **US1 MVP (Phase 2)**: Core focus; implements the primary user requirements.
- **US2 & Contracts (Phase 3)**: Aligns contracts and inspector behavior.
- **Polish (Phase 4)**: Executes full verification and regression testing.

### Parallel Opportunities
- Frontend UI cleanup (T002, T003, T004) can be prepared alongside Backend API guard tightening (T005, T006, T007).
- Contract updates (T009) can run in parallel with verification tasks.
