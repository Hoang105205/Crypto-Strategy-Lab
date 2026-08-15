# Feature Specification: fix-backtest-mock-data

**Feature**: `fix-backtest-mock-data`
**Created**: 2026-08-13
**Status**: Draft
**Input**: User description: "Tích hợp Prisma Repository vào StrategyController để trả về dữ liệu BacktestResult thực tế thay vì mock data"

## User Scenarios & Testing

### User Story 1 - Fetch Real Backtest Result (Priority: P1)

Là một người dùng, hoặc là Frontend UI, tôi muốn lấy kết quả thực thi backtest đã chạy xong từ cơ sở dữ liệu để có thể hiển thị Return, WinRate, MDD, Sharpe và danh sách lệnh giao dịch (trades) thực sự thay vì dữ liệu cứng.

**Why this priority**: Yêu cầu bắt buộc để UI có thể ghép nối End-to-End.
**Independent Test**: Gọi API `GET /api/strategies/backtest/:id` bằng cURL/Postman với một ID hợp lệ trong DB, kết quả trả về phải khớp với dữ liệu thực từ Prisma.

**Acceptance Scenarios**:
1. **Given** một ID của BacktestResult hợp lệ trong DB, **When** gọi `GET /api/strategies/backtest/:id`, **Then** trả về HTTP 200 kèm JSON chứa thông tin kết quả backtest (metrics + trades).
2. **Given** một ID không tồn tại, **When** gọi `GET /api/strategies/backtest/:id`, **Then** trả về HTTP 404 Not Found.

---

### Edge Cases
- Chuyện gì xảy ra nếu ID không đúng định dạng (không phải UUID)? -> Nên Validate và báo lỗi 400 Bad Request, hoặc 404 Not Found.
- Chuyện gì xảy ra nếu field `trades` lưu trong JSONB rất lớn? -> Node/Nest có thể tốn chút RAM/CPU để Serialize JSON nhưng ở phạm vi của dự án 4 tuần, điều này chấp nhận được.

## Requirements

### Functional Requirements
- **FR-001**: The system MUST read the `BacktestResult` entity from the Prisma database using the provided ID.
- **FR-002**: The system MUST return an HTTP 404 error if the requested `BacktestResult` is not found.
- **FR-003**: The system MUST remove all hardcoded mock metrics and empty `trades` arrays from the controller method.

### Key Entities
- **BacktestResult**: Result containing performance metrics (totalReturn, winRate, sharpeRatio) and a `trades` JSONB object, linked to a StrategyVersion.

## Success Criteria
- **SC-001**: The endpoint `GET /api/strategies/backtest/:id` invokes a data repository or service to fetch data via Prisma.
- **SC-002**: Hardcoded mock object in `StrategyController` line 114 is entirely removed.

## Assumptions
- The `PrismaService` is correctly configured and exported from the `SharedModule`.
- The database schema includes a `BacktestResult` model matching the expected payload.

## KB Cross-References
- **Modules affected**: Strategy Engine, Shared Infrastructure
- **E2E flows affected**: `kb/flows/strategy-backtest.md`
- **Architecture constraints**: NestJS Dependency Injection, Prisma ORM constraints (ADR-0001 Modular Monolith).
- **Constitution gates**: SSoT (Single Source of Truth)
- **Glossary terms**: BacktestResult, Prisma
