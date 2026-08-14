# Feature Specification: SearchEngine Coordinator

**Feature**: `search-engine-coordinator`
**Created**: 2026-08-13
**Status**: Draft
**Input**: User description: "Triển khai SearchEngine coordinator điều phối RandomGenerator và DomainGuidedGenerator, đồng thời chuẩn hóa thư mục strategy/search/"

## User Scenarios & Testing

### User Story 1 - Phối hợp lấy Candidate Strategy (Priority: P1)

Là một `Loop Controller` (từ module Event Infrastructure của Phương), tôi cần gọi vào Strategy Engine để lấy danh sách $N$ chiến lược ứng viên để đưa vào hàng đợi Backtest. Tôi muốn có thể chỉ định loại thuật toán sinh (Ví dụ: Random hoặc Domain-Guided).

**Why this priority**: Đây là điểm kết nối sống còn để vòng lặp tìm kiếm (Search Loop) có thể hoạt động end-to-end. Không có coordinator, vòng lặp không thể lấy được chiến lược mới.
**Independent Test**: Khởi tạo `SearchEngine` với mock generators. Gọi `searchEngine.generateCandidates(5, 'RANDOM')`. Kiểm tra kết quả trả về đúng 5 ứng viên từ `RandomGenerator`.

**Acceptance Scenarios**:
1. **Given** `SearchEngine` được inject `RandomGenerator` và `DomainGuidedGenerator`, **When** gọi `generateCandidates(3, 'RANDOM')`, **Then** trả về 3 chiến lược ngẫu nhiên.
2. **Given** `SearchEngine`, **When** gọi `generateCandidates(3, 'DOMAIN_GUIDED')`, **Then** trả về 3 chiến lược composite được chọn lọc theo domain.

---

### Edge Cases
- What happens when một thuật toán sinh không được hỗ trợ (vd 'GENETIC') được yêu cầu? -> Throw `Error('Generator type not supported')`.
- What happens when requested count là số âm hoặc bằng 0? -> Trả về mảng rỗng `[]` hoặc throw Error `Invalid count`.

## Requirements

### Functional Requirements
- **FR-001**: Hệ thống MUST cung cấp class `SearchEngine` làm coordinator (Facade) cho toàn bộ logic sinh chiến lược.
- **FR-002**: `SearchEngine` MUST hỗ trợ method (ví dụ `generateCandidates(count: number, type: 'RANDOM' | 'DOMAIN_GUIDED')`) để rẽ nhánh logic sang các class Generator tương ứng.
- **FR-003**: `SearchEngine` MUST được export từ `StrategyModule` để các module khác (hoặc REST API nội bộ) có thể gọi.
- **FR-004**: Tất cả các file liên quan đến search (bao gồm `search-engine.ts`, `random.generator.ts`, `domain-guided.generator.ts`) MUST được gom chung vào thư mục `apps/backend/src/strategy/search/`.

### Key Entities
- **SearchEngine**: Coordinator class chịu trách nhiệm chọn đúng Generator để sinh chiến lược.
- **IStrategyGenerator**: Interface chung cho các thuật toán sinh chiến lược.

## Success Criteria
- **SC-001**: Thư mục `strategy/search/` chứa đầy đủ 3 file cấu thành logic Search. (Không còn dùng thư mục `generators/` cũ).
- **SC-002**: Module `StrategyModule` export thành công `SearchEngine`.

## Assumptions
- Giả định rằng `IStrategyGenerator` interface đã tồn tại và các generator đã implement đúng interface này (từ công việc của Task 3 trước đó). Việc triển khai này chủ yếu là cấu trúc lại (Refactoring) và bổ sung Facade class.

## KB Cross-References
- **Modules affected**: `strategy-engine`
- **E2E flows affected**: `strategy-search-loop.md`
- **Architecture constraints**: Modular Monolith, Interface Segregation. Dependency Injection trong NestJS.
- **Constitution gates**: Tuân thủ Separation of Concerns (coordinator tách biệt với thuật toán sinh cụ thể).
