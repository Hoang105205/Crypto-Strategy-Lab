# Tasks: search-engine-coordinator

**Input**: Design documents from `sdd_artifacts/search-engine-coordinator/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/search-engine-contract.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

- [x] T001 Chuẩn bị thư mục đích: Đảm bảo thư mục `apps/backend/src/strategy/search/` tồn tại.
- [x] T002 [P] Di chuyển (Move) file `random.generator.ts` từ `apps/backend/src/strategy/generators/` sang `apps/backend/src/strategy/search/`.
- [x] T003 [P] Di chuyển (Move) file `domain-guided.generator.ts` từ `apps/backend/src/strategy/generators/` sang `apps/backend/src/strategy/search/`.
- [x] T004 Di chuyển (Move) thư mục tests `apps/backend/src/strategy/generators/tests/` sang `apps/backend/src/strategy/search/tests/`.

---

## Phase 2: Foundation

**Purpose**: Core infrastructure that MUST complete before ANY user story can start

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 [Foundation] Định nghĩa type `SearchGeneratorType` trong file nội bộ hoặc dùng trực tiếp string literal type (`'RANDOM' | 'DOMAIN_GUIDED'`). Không có DB migration (per data-model.md).

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Phối hợp lấy Candidate Strategy (Priority: P1) 🎯 MVP

**Goal**: Loop Controller có thể yêu cầu danh sách ứng viên thông qua 1 điểm duy nhất (SearchEngine).
**Independent Test**: Khởi tạo `SearchEngine` với mock generators. Gọi `generateCandidates(5, 'RANDOM')` trả về 5 chiến lược.

### Implementation for User Story 1

- [x] T006 [US1] Tạo file `apps/backend/src/strategy/search/search-engine.ts`. Triển khai class `SearchEngine` với dependency injection cho `RandomGenerator` và `DomainGuidedGenerator`.
- [x] T007 [US1] Implement hàm `generateCandidates(count: number, type: SearchGeneratorType): IStrategy[]` trong `SearchEngine` để rẽ nhánh gọi đúng generator. (Ném Error nếu type không hợp lệ).
- [x] T008 [US1] Tạo file barrel export `apps/backend/src/strategy/search/index.ts` xuất `SearchEngine`, `RandomGenerator`, `DomainGuidedGenerator`.
- [x] T009 [US1] Cập nhật `apps/backend/src/strategy/strategy.module.ts`:
  - Sửa đường dẫn import của `RandomGenerator` và `DomainGuidedGenerator` từ `./generators` sang `./search`.
  - Import `SearchEngine` từ `./search`.
  - Thêm `SearchEngine` vào mảng `providers` và `exports`.

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: Polish & Cross-Cutting

**Purpose**: Improvements that affect multiple user stories

- [x] T010 Viết Unit Test `apps/backend/src/strategy/search/tests/search-engine.spec.ts` kiểm tra logic rẽ nhánh của `SearchEngine`.
- [ ] T011 Dọn dẹp: Xóa thư mục cũ `apps/backend/src/strategy/generators/` và file barrel `generators/index.ts` (vì đã dời sang search/).
- [x] T012 Chạy xác thực Quickstart: Gọi thử `SearchEngine` xem có bị vòng lặp import (circular dependency) nào không.

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Bắt đầu ngay.
- **Foundation (Phase 2)**: Cần xong Phase 1.
- **User Stories (Phase 3)**: Cần xong Phase 2.
- **Polish (Phase 4)**: Cần xong Phase 3.

### Parallel Opportunities
- T002, T003 có thể chạy song song (các lệnh move độc lập).

---

## Phase 5: Convergence

**Purpose**: Close gaps between specification and implementation
**Generated**: 2026-08-13 by /hoang-sdd-converge

### Medium Gaps
- [x] CV001 ⚠️ [partial] Clean up old directory — plan.md and tasks.md (T011) require deleting `apps/backend/src/strategy/generators/`, but the directory and duplicated files still exist. (Resolved by User)
- [x] CV002 ⚠️ [missing] Implement `ISearchEngine` interface — `contracts/search-engine-contract.md` requires `ISearchEngine` interface, but `SearchEngine` class does not implement it and the interface is not defined anywhere.
