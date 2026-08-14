# Research: domain-guided-search-enhancement

## Decisions

### D1: Cấu trúc thuật toán DomainGuidedGenerator
- **Chosen**: Sử dụng Map/Dictionary để phân loại các chiến lược được lấy ra từ `StrategyRegistry.getAll()`. Random chọn 2-3 key từ Dictionary, và lấy 1 giá trị ngẫu nhiên từ mỗi key.
- **Rationale**: Đảm bảo thuật toán mở rộng tự động. Nếu sau này có thêm `StrategyType.NEWS_AI` và được map vào nhóm Information, code Generator không cần thay đổi.
- **Alternatives considered**: Hardcode switch-case cho từng chiến lược. (Bị từ chối vì vi phạm OCP).
- **KB reference**: `ARCHITECTURE.md` (Plugin Architecture).

### D2: Thông số cấu hình của các chỉ báo mới (MACD, Stochastic, ATR)
- **Chosen**: Sử dụng thư viện `technicalindicators` với các thông số phổ biến nhất: MACD (12, 26, 9), Stochastic (14, 3, 3), ATR (14).
- **Rationale**: Cung cấp cấu hình default ổn định để Search Engine có thể sử dụng ngay mà không bị lỗi params undefined.
- **Alternatives considered**: Viết lại thuật toán tính toán từ đầu. (Bị từ chối vì tốn thời gian, dễ sai sót).

### D3: Tương tác với NewsSentimentStrategy
- **Chosen**: Generator chỉ kiểm tra type `StrategyType.SENTIMENT` và nhét vào nhóm Information. Không cần import trực tiếp NewsModule.
- **Rationale**: `StrategyRegistry` hoạt động bằng cơ chế Singleton (provider) tại mức root hoặc exported, các class con tự push instances của nó vào. DomainGuidedGenerator chỉ việc lấy ra đọc. Đảm bảo loose coupling 100%.
