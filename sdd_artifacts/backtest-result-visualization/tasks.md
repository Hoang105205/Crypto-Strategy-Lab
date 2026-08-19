# Tasks: backtest-result-visualization

**Input**: Design documents from `sdd_artifacts/backtest-result-visualization/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

- [x] T001 Verify project structure per implementation plan (Frontend and Backend apps exist).
- [ ] T002 Verify `SupabaseJwtGuard` and `@CurrentUser` are available from `@crypto-strategy-lab/shared` or backend shared modules.

---

## Phase 2: Foundation

**Purpose**: Core infrastructure that MUST complete before ANY user story can start

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [Foundation] Database schema and migrations are already set up (Prisma `userId` and `trades` JSONB exist).
- [x] T004 [Foundation] Supabase JWT Guard is already implemented globally per ADR-0015.

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Private Strategy & Backtest Scoping (Priority: P1) 🎯 MVP

**Goal**: As a logged-in user, I want my created strategies and backtests to be securely isolated.
**Independent Test**: Log in as User A, create a strategy. Log in as User B, verify User A's strategy is not visible.

### Implementation for User Story 1

- [ ] T005 [US1] Thêm decorator `@CurrentUser()` (từ Auth Guard) vào các hàm API của `apps/backend/src/strategy/controllers/strategy.controller.ts`.
- [ ] T006 [US1] Sửa các query Prisma (`findUnique`, `findMany`...) trong `strategy.controller.ts` để thêm bộ lọc `WHERE userId IS NULL OR userId = :currentUserId`.

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Comprehensive Trade Metrics (Priority: P1)

**Goal**: As a trader analyzing a backtest, I want to see detailed execution costs and risk management parameters.
**Independent Test**: Run a backtest with a non-zero commission and slippage config, check the resulting trades array.

### Implementation for User Story 2

- [ ] T007 [US2] Update `BacktesterService.run()` trong `apps/backend/src/strategy/backtester/backtester.service.ts` để tính toán `stopLoss`, `takeProfit`, `transactionCost`, `slippage`, `volumeUsd` cho từng `Trade`.
- [ ] T008 [P] [US2] Update file test `apps/backend/src/strategy/backtester/tests/backtester.spec.ts` để bổ sung test case cho các công thức tính toán mới.
- [ ] T009 [P] [US2] Sửa component `TradeDetailTable` tại `apps/frontend/src/components/trade-detail-table.tsx` để hiển thị các cột SL, TP, Slippage, Cost, Vol.

**Checkpoint**: User Story 2 should be fully functional and testable independently

---

## Phase 5: User Story 3 - Visual Equity Curve (Priority: P2)

**Goal**: As a user, I want to see an Equity Curve chart for my backtest.
**Independent Test**: Perform a backtest, verify the line chart renders without crashing.

### Implementation for User Story 3

- [ ] T010 [US3] Tích hợp component `EquityCurveChart` vào trang Strategy Builder UI tại `apps/frontend/src/app/strategy/page.tsx` (hoặc page tương ứng) để nhận dữ liệu từ BacktestResult và vẽ đồ thị.

---

## Phase N: Polish & Cross-Cutting

**Purpose**: Improvements that affect multiple user stories

- [ ] T011 [P] Chạy lại toàn bộ unit test (`npm run test`) của Backend.
- [ ] T012 Chạy kịch bản validation trong `quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundation (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundation completion
  - US1 (Backend Auth) và US2 (Backend Backtester + Frontend Table) có thể làm song song.
  - US3 (Frontend Chart) nên làm sau khi US2 có data Trade đầy đủ, hoặc có thể làm song song nếu dùng mock.
- **Polish (Final Phase)**: Depends on all desired user stories

### Parallel Opportunities
- T008 và T009 có thể chạy song song với T007 (nếu tự thiết kế mock độc lập).
- Frontend (T009, T010) và Backend (T005, T006, T007) hoàn toàn có thể chạy song song.

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
