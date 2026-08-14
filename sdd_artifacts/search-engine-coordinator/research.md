# Research: SearchEngine Coordinator

## Decisions

### D1: Cấu trúc thư mục chứa thuật toán Generator
- **Chosen**: Đổi tên thư mục `generators/` thành `search/` và gom chung `search-engine.ts` vào đó. (Sẽ update lại đường dẫn export trong `strategy.module.ts`).
- **Rationale**: Đảm bảo tuân thủ thiết kế ban đầu trong `plan-overview.md`. Giúp tất cả các logic liên quan đến tìm kiếm nằm chung một bounded context.
- **Alternatives considered**: Giữ nguyên `generators/` và tạo thêm `search/` chứa coordinator. (Bị loại vì phân tán logic tìm kiếm).
- **KB reference**: `kb/modules/strategy-engine.md` và `plan-overview.md`.

### D2: Phương thức tiêm phụ thuộc (Dependency Injection) cho SearchEngine
- **Chosen**: Khai báo `RandomGenerator` và `DomainGuidedGenerator` như là các Provider riêng biệt, tiêm vào constructor của `SearchEngine` qua InjectionTokens.
- **Rationale**: Chuẩn DI của NestJS. Dễ dàng mock khi viết Unit Test cho `SearchEngine`.
- **Alternatives considered**: Tự khởi tạo bằng `new RandomGenerator()` bên trong constructor của `SearchEngine`. (Bị loại vì vi phạm Dependency Inversion, khó test).
