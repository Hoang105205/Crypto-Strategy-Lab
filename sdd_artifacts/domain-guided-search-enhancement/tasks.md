# Tasks: domain-guided-search-enhancement

**Input**: Design documents from `sdd_artifacts/domain-guided-search-enhancement/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

- [ ] T001 [P] Ensure correct branch and project structure.

---

## Phase 2: Foundation

**Purpose**: Core infrastructure that MUST complete before ANY user story can start

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 [Foundation] Update `StrategyType` ENUM trong `libs/shared/src/types/enums.ts` để khai báo MACD, STOCHASTIC, ATR.

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 3 - Bổ sung các chỉ báo kỹ thuật phổ biến (Priority: P2) 

**Goal**: Bổ sung MACD, Stochastic, ATR
**Independent Test**: Gọi API lấy danh sách chiến lược hiện có và xác nhận MACD, Stochastic, ATR có tồn tại.

### Implementation for User Story 3

*(Thực hiện US3 trước vì US1, US2 cần các chiến lược này để test kết hợp Domain)*

- [ ] T003 [P] [US3] Tạo file `apps/backend/src/strategy/strategies/macd.strategy.ts` implement `IStrategy` với type `StrategyType.MACD`.
- [ ] T004 [P] [US3] Tạo file `apps/backend/src/strategy/strategies/stochastic.strategy.ts` implement `IStrategy` với type `StrategyType.STOCHASTIC`.
- [ ] T005 [P] [US3] Tạo file `apps/backend/src/strategy/strategies/atr.strategy.ts` implement `IStrategy` với type `StrategyType.ATR`.
- [ ] T006 [US3] Cập nhật `apps/backend/src/strategy/strategies/index.ts` để export 3 file chiến lược mới (Phụ thuộc T003, T004, T005).
- [ ] T007 [US3] Đăng ký `MacdStrategy`, `StochasticStrategy`, `AtrStrategy` vào providers array trong `apps/backend/src/strategy/strategy.module.ts` (Phụ thuộc T006).

**Checkpoint**: User Story 3 should be fully functional. (Các chiến lược mới đã có mặt trong Registry).

---

## Phase 4: User Story 1 - Phân loại chiến lược theo nhóm Domain (Priority: P1) 🎯 MVP

**Goal**: Phân loại chiến lược vào 5 nhóm (Trend, Momentum, Volatility, Structure, Information)
**Independent Test**: Gọi generator, kiểm tra logs phân nhóm.

### Implementation for User Story 1

- [ ] T008 [US1] Viết lại thuật toán trong `apps/backend/src/strategy/search/domain-guided.generator.ts`. Lấy tất cả chiến lược từ `StrategyRegistry` và đưa vào 5 biến mảng (Trend, Momentum, Volatility, Structure, Information) dựa trên `StrategyType`. Chú ý map `StrategyType.SENTIMENT` vào Information.

**Checkpoint**: User Story 1 ready.

---

## Phase 5: User Story 2 - Sinh chiến lược kết hợp đa nền tảng (Priority: P1)

**Goal**: Sinh Composite Strategy từ 2-3 domain khác nhau.
**Independent Test**: Generate 10 strategies, kiểm tra children của composite.

### Implementation for User Story 2

- [ ] T009 [US2] Tiếp tục cập nhật hàm `generate()` trong `apps/backend/src/strategy/search/domain-guided.generator.ts`. Chọn ngẫu nhiên 2-3 mảng Domain đang có dữ liệu, bốc ngẫu nhiên 1 chiến lược từ mỗi Domain đã chọn, tạo `CompositeStrategy` truyền vào combiner và trả về danh sách.

**Checkpoint**: User Story 2 should be fully functional.

---

## Phase N: Polish & Cross-Cutting

**Purpose**: Improvements that affect multiple user stories

- [ ] T010 [P] Chạy validation (Nên generate thử) theo `quickstart.md` để đảm bảo hệ thống không bị crash.

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Không có dependencies.
- **Foundation (Phase 2)**: Chặn tất cả US. Phải làm T002 trước để có ENUM.
- **User Stories (Phase 3+)**: Có thể làm US3 (Các chiến lược) trước, rồi mới sửa Generator (US1, US2).
- **Polish (Final Phase)**: Chạy cuối cùng.

### Implementation Strategy

1. Mở file ENUM thêm type.
2. Viết 3 chiến lược song song.
3. Đăng ký module.
4. Sửa DomainGuidedGenerator.
5. Kiểm tra ứng dụng.
