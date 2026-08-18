# Tasks: news-sentiment-sync

**Input**: Design documents from `sdd_artifacts/news-sentiment-sync/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure
*(Không có setup dependencies nào mới, bỏ qua Phase này)*

---

## Phase 2: Foundation

**Purpose**: Thay đổi Interfaces cốt lõi (Shared Contract)

**⚠️ CRITICAL**: Không thể thay đổi service bên dưới nếu chưa xong Interface.

- [ ] T001 [Foundation] Cập nhật interface `IStrategy` và `IBacktester` trong `libs/shared/src/interfaces/strategy.ts` (thêm `analyzeAsync` và đổi `run` thành `Promise<Trade[]>`).

**Checkpoint**: Foundation ready — các phần implement phụ thuộc vào Interface mới có thể bắt đầu.

---

## Phase 3: User Story 1 - Run Backtest with NewsSentimentStrategy (Priority: P1) 🎯 MVP

**Goal**: Đảm bảo chiến lược Sentiment và các chiến lược đồng bộ khác hoạt động với Backtester mới.
**Independent Test**: Gửi lệnh Backtest từ UI và kiểm tra mảng kết quả.

### Implementation for User Story 1

- [ ] T002 [US1] Refactor `BacktesterService` trong `apps/backend/src/strategy/backtester/backtester.service.ts` (Đổi `run` thành `async`, dùng `await` với `analyzeAsync` nếu tồn tại, ngược lại dùng `analyze`). (Phụ thuộc: T001)
- [ ] T003 [P] [US1] Sửa các Unit Tests của `BacktesterService` trong `apps/backend/src/strategy/backtester/tests/backtester.spec.ts` (thêm `await` trước `backtester.run`). (Phụ thuộc: T002)

**Checkpoint**: User Story 1 should be fully functional and testable independently. Backtester đã sẵn sàng chạy Async.

---

## Phase 4: Polish & Cross-Cutting

**Purpose**: Đảm bảo chất lượng hệ thống

- [ ] T004 Code cleanup và chạy lại toàn bộ Unit Tests của backend (`npm run test`) để đảm bảo không bị regression.
- [ ] T005 Chạy kiểm tra End-to-End theo kịch bản trong `quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies
- **Foundation (Phase 2)**: BLOCKS all user stories. Cần làm Interface trước.
- **User Stories (Phase 3+)**: Chỉ có thể làm khi xong Foundation.
- **Polish (Final Phase)**: Chạy test cuối cùng.

### Parallel Opportunities
- Không có nhiều task chạy song song vì quy mô sửa chữa tập trung và tuyến tính (Interface -> Service -> Test).

---

## Implementation Strategy

### Incremental Delivery
1. Cập nhật Interface (Foundation).
2. Sửa `BacktesterService` (Core Logic).
3. Sửa Unit Test.
4. Chạy bộ Test toàn hệ thống.
5. Kiểm thử E2E qua UI.
