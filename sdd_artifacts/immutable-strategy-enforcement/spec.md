# Feature Specification: Immutable Strategy Enforcement

**Feature**: `immutable-strategy-enforcement`  
**Created**: 2026-09-02  
**Status**: Draft  
**Input**: User description: "Chuyển toàn bộ các strategy đã lưu sang cơ chế bất biến tuyệt đối (immutable): loại bỏ hoàn toàn nút DELETE và API xóa/sửa strategy trên cả Frontend và Backend theo chuẩn ADR-0008"

## User Scenarios & Testing

### User Story 1 - Loại bỏ hoàn toàn chức năng Xóa trên UI & Ngăn chặn tham chiếu hỏng (Priority: P1)

Người dùng khi duyệt danh sách chiến lược (Catalog) hoặc kiểm tra tham số chiến lược (Parameter Inspector) có thể xem cấu hình, tạo chiến lược hỗn hợp mới (Composite), hoặc chạy kiểm thử quá khứ (Backtest). Tuyệt đối không có bất kỳ nút "DELETE" nào xuất hiện trên giao diện đối với cả chiến lược mặc định (System Base Strategies) lẫn chiến lược do người dùng tạo (Composite Strategies).

**Why this priority**: Ngăn ngừa hoàn toàn nguy cơ người dùng vô tình xóa chiến lược con (Child Strategy), làm gãy cây phụ thuộc của các Composite Strategy đang sử dụng nó, dẫn đến lỗi crash hệ thống khi chạy Backtest hoặc Leaderboard tải lại dữ liệu.  
**Independent Test**: Mở trang Strategy Builder (`/strategy`), kiểm tra tất cả các thẻ StrategyCard trong Catalog: không tồn tại bất kỳ nút bấm hay hành động xóa nào.

**Acceptance Scenarios**:
1. **Given** người dùng đang ở trang `/strategy` tại tab Catalog, **When** quan sát bất kỳ thẻ chiến lược nào (kể cả Composite do người dùng tạo), **Then** không có nút "DELETE" nào được hiển thị.
2. **Given** một client cố tình gửi yêu cầu HTTP `DELETE /api/strategies/:name`, **When** request đến backend, **Then** backend từ chối với HTTP 403 Forbidden và thông báo rõ ràng "Strategy deletion is not permitted".

---

### User Story 2 - Đảm bảo tính Bất biến của Tham số Chiến lược đã lưu (Priority: P1)

Khi xem chi tiết một chiến lược đã lưu trong Parameter Inspector, các tham số được xem như một bản chụp đóng băng (Snapshot). Người dùng không thể chỉnh sửa đè (in-place update) lên chiến lược hiện tại. Nếu muốn thử nghiệm tham số mới, người dùng có thể điều chỉnh tham số ngay tại form Backtest Runner hoặc tạo một Composite Strategy mới.

**Why this priority**: Tuân thủ triệt để quyết định kiến trúc ADR-0008: Mỗi bộ tham số đại diện cho một phiên bản bất biến (Immutable Snapshot) phục vụ tính tái lập khoa học (Reproducibility) cho các kết quả xếp hạng trên Leaderboard.  
**Independent Test**: Kiểm tra mã nguồn và giao diện Parameter Editor: không có nút cập nhật đè (Save/Update in-place) lên phiên bản hiện có.

**Acceptance Scenarios**:
1. **Given** người dùng đang xem một chiến lược trong Live Parameter Inspector, **When** xem các trường thông số, **Then** hệ thống không cho phép lưu đè lên tên chiến lược cũ.
2. **Given** một client gửi HTTP PUT hoặc PATCH đến `/api/strategies/:name`, **When** request đến backend, **Then** backend từ chối (404/405/403) vì không tồn tại API sửa đè.

---

### User Story 3 - Đồng bộ hóa API Contract & Giao diện dịch vụ (Priority: P2)

Hợp đồng giao tiếp trong `kb/contracts/strategy.yaml` và service gọi API ở Frontend (`api-client.ts`) được dọn dẹp sạch sẽ, phản ánh chính xác trạng thái bất biến: loại bỏ hoàn toàn các hàm gọi xóa chiến lược khỏi luồng người dùng.

**Why this priority**: Đảm bảo nguyên tắc Contract-Driven (Constitution Principle II) và làm sạch mã nguồn, tránh mã rác (dead code).  
**Independent Test**: Chạy typecheck và kiểm tra unit test của `apiClient` và `StrategyController`.

**Acceptance Scenarios**:
1. **Given** file `kb/contracts/strategy.yaml`, **When** kiểm tra các endpoint của `/api/strategies`, **Then** không có thao tác xóa hoặc được đánh dấu rõ ràng là cấm xóa vĩnh viễn (403 Forbidden).
2. **Given** `api-client.ts`, **When** rà soát các method, **Then** luồng xóa chiến lược không còn được gọi từ các component giao diện.

---

### Edge Cases
- **Trường hợp gửi request DELETE trực tiếp bằng Postman / curl**: Backend lập tức chặn và trả về HTTP 403 Forbidden với message rõ ràng `Strategy deletion is not permitted per ADR-0008`.
- **Trường hợp chiến lược có hàng chục Composite phụ thuộc**: Nhờ việc cấm xóa tuyệt đối, 100% cây phả hệ (lineage) của chiến lược luôn toàn vẹn, bảo đảm mọi tiến trình BacktestWorker và Search Engine không bao giờ gặp lỗi `references missing child version`.

---

## Requirements

### Functional Requirements
- **FR-001**: Component [`StrategyCard`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/frontend/src/components/strategy/StrategyCard.tsx) trên Frontend PHẢI loại bỏ hoàn toàn nút DELETE và logic kiểm tra `showDelete`.
- **FR-002**: Trang [`StrategyBuilderPage`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/frontend/src/app/strategy/page.tsx) trên Frontend PHẢI gỡ bỏ hàm `handleDeleteStrategy` và không truyền prop `onDelete` vào các thẻ chiến lược.
- **FR-003**: Backend [`StrategyController`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/backend/src/strategy/controllers/strategy.controller.ts) PHẢI đảm bảo bất kỳ lệnh gọi `DELETE /api/strategies/:name` đều bị chặn với HTTP 403 Forbidden (hoặc gỡ bỏ endpoint và trả về 405 Method Not Allowed).
- **FR-004**: Không cung cấp bất kỳ endpoint nào cho phép `PUT` hay `PATCH` để sửa đổi trực tiếp dữ liệu chiến lược đã tạo trong Database.
- **FR-005**: API Contract trong [`kb/contracts/strategy.yaml`](file:///d:/DaiHoc/KienTrucPM/kb/contracts/strategy.yaml) PHẢI được cập nhật tương ứng, đồng bộ với triết lý bất biến của ADR-0008.

### Key Entities
- **StrategyVersion**: Bản ghi snapshot bất biến trong PostgreSQL chứa định danh, loại chiến lược, tên, số phiên bản, tham số JSONB, và danh sách các ID chiến lược con (`childVersionIds`).
- **StrategyCatalogItem**: Đối tượng dữ liệu hiển thị trên Frontend bao gồm tên, loại, tham số và cờ nhận diện, không còn cờ kích hoạt xóa (`canDelete` luôn là `false` hoặc được loại bỏ).

---

## Success Criteria
- **SC-001**: 0 nút DELETE nào xuất hiện trên bất kỳ phần nào của giao diện người dùng.
- **SC-002**: 100% các request cố ý gọi xóa chiến lược đến Backend đều bị chặn với mã HTTP 403.
- **SC-003**: 100% các Composite Strategy giữ được đầy đủ liên kết con, triệt tiêu hoàn toàn nguy cơ lỗi `references missing child version`.

---

## Assumptions
- Người dùng muốn thử nghiệm chiến lược mới sẽ tạo chiến lược mới hoặc tùy chỉnh thông số trên Backtest Runner thay vì sửa đè lên cấu hình cũ.
- Việc ẩn/xóa chiến lược khỏi danh sách nhìn thấy (nếu cần trong tương lai) sẽ thực hiện qua cơ chế Archived/Hidden flag chứ không thực hiện xóa cứng trong DB.

---

## KB Cross-References
- **Modules affected**: `strategy-engine` ([`apps/backend/src/strategy/`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/backend/src/strategy/)), `frontend` ([`apps/frontend/src/app/strategy/`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/frontend/src/app/strategy/))
- **E2E flows affected**: [`kb/flows/strategy-backtest.md`](file:///d:/DaiHoc/KienTrucPM/kb/flows/strategy-backtest.md), [`kb/flows/composite-with-sentiment.md`](file:///d:/DaiHoc/KienTrucPM/kb/flows/composite-with-sentiment.md)
- **Architecture constraints**: ADR-0008 (Strategy Versioning for Reproducibility), ADR-0003 (Plugin Architecture)
- **Constitution gates**: Nguyên tắc I (Chất lượng kiến trúc), Nguyên tắc II (Contract-Driven), Nguyên tắc V (KB là chân lý)
- **Glossary terms**: Strategy, Composite Strategy, Strategy Version, Immutability, Lineage
