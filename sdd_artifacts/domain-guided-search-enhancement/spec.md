# Feature Specification: domain-guided-search-enhancement

**Feature**: `domain-guided-search-enhancement`
**Created**: 2026-08-14
**Status**: Draft
**Input**: User description: "Nâng cấp DomainGuidedGenerator để phân nhóm chiến lược theo 5 domains (Trend, Momentum, Volatility, Structure, Information). Bổ sung 5 chiến lược mới: MACD, Stochastic, ATR (Tôi quyết định bỏ SMC, Wyckoff do tính chất quá phức tạp). Tích hợp NewsSentiment vào nhóm Information."

## User Scenarios & Testing

### User Story 1 - Phân loại chiến lược theo nhóm Domain (Priority: P1)

Với tư cách là Search Engine, tôi muốn tự động phân loại tất cả các chiến lược hiện có trong hệ thống thành 5 nhóm Domain chính (Trend, Momentum, Volatility, Structure, Information) để có thể phối hợp chúng một cách thông minh.

**Why this priority**: Đây là nền tảng cốt lõi của thuật toán Domain-Guided Generation, đảm bảo các composite strategy sinh ra có sự kết hợp đa chiều (cross-domain) thay vì nhặt ngẫu nhiên các chiến lược trùng lặp về mục đích.
**Independent Test**: Kích hoạt bộ tạo (Generator) và kiểm tra logs phân nhóm. Đảm bảo MA, MACD nằm ở Trend; RSI, Stochastic ở Momentum; Bollinger, ATR ở Volatility; SR ở Structure; và Sentiment ở Information.

**Acceptance Scenarios**:
1. **Given** hệ thống đang có sẵn các chiến lược chuẩn, **When** trình tạo (generator) được gọi, **Then** tất cả chiến lược phải được phân phát chính xác vào 5 bucket (xô) tương ứng.

---

### User Story 2 - Sinh chiến lược kết hợp (Composite) đa nền tảng (Priority: P1)

Với tư cách là Người dùng, tôi muốn Search Engine trả về các chiến lược kết hợp (Composite Strategy) được lấy từ ít nhất 2 hoặc 3 nhóm Domain khác nhau (bao gồm cả phân tích kỹ thuật và tin tức).

**Why this priority**: Tránh việc hệ thống tạo ra một composite chỉ có RSI và Stochastic (cùng là Momentum), dẫn đến tín hiệu bị nhiễu và trùng lặp.
**Independent Test**: Yêu cầu Search Engine sinh 10 chiến lược. Kiểm tra thành phần (children) của các composite strategy này có thuộc các Domain khác nhau hay không.

**Acceptance Scenarios**:
1. **Given** người dùng chọn chế độ Domain-Guided, **When** hệ thống tạo composite, **Then** hệ thống sẽ lấy 2-3 domain ngẫu nhiên và chọn mỗi domain 1 chiến lược để kết hợp.
2. **Given** NewsSentiment đang hoạt động, **When** domain Information được bốc trúng, **Then** NewsSentiment sẽ trở thành một phần của chiến lược kết hợp.

---

### User Story 3 - Bổ sung các chỉ báo kỹ thuật phổ biến (Priority: P2)

Với tư cách là Người tạo chiến lược, tôi muốn có sẵn các chỉ báo MACD, Stochastic và ATR để có thể tạo các cấu hình giao dịch phong phú hơn.

**Why this priority**: Tăng tính đa dạng cho bộ gen chiến lược.
**Independent Test**: Gọi API lấy danh sách chiến lược hiện có và xác nhận MACD, Stochastic, ATR có tồn tại.

**Acceptance Scenarios**:
1. **Given** người dùng mở giao diện, **When** tìm kiếm các chỉ báo, **Then** MACD, Stochastic, ATR đều sẵn sàng để sử dụng độc lập hoặc kết hợp.

---

### Edge Cases
- What happens when một Domain bị rỗng (không có chiến lược nào)? Hệ thống chỉ lấy các Domain đang Active (có chiến lược) để trộn.
- How does system handle việc News Sentiment module bị sập (lỗi kết nối)? `SentimentStrategy` tự động báo tín hiệu HOLD, chiến lược Composite vẫn sẽ tiếp tục dùng kết quả từ các chỉ báo khác để ra quyết định theo Combiner.

## Requirements

### Functional Requirements
- **FR-001**: Hệ thống MUST bổ sung MACD, Stochastic, ATR như các chiến lược độc lập.
- **FR-002**: Hệ thống MUST phân loại chiến lược tự động dựa vào `StrategyType`.
- **FR-003**: Hệ thống MUST đảm bảo `NewsSentimentStrategy` (nếu có mặt trong Registry) được quy hoạch vào domain `Information`.
- **FR-004**: Thuật toán MUST bốc ngẫu nhiên 2-3 domain khác biệt và chọn ngẫu nhiên 1 chiến lược từ mỗi domain để ghép vào CompositeStrategy.

### Key Entities
- **DomainGuidedGenerator**: Bộ sinh thuật toán thông minh, thay thế cho logic giả lập cũ.
- **StrategyRegistry**: Kho chứa chứa tất cả chiến lược đã đăng ký.

## Success Criteria
- **SC-001**: 100% các chiến lược sinh ra bởi DomainGuidedGenerator bao gồm các chỉ báo/tin tức từ ít nhất 2 domain phân tích khác nhau.
- **SC-002**: Không có lỗi crash khi NewsModule bị mất kết nối.

## Assumptions
- Thuật toán Combiner (MajorityVote hoặc WeightedScore) được gán ngẫu nhiên hoặc có trọng số ngẫu nhiên cho từng component.
- Các chiến lược SMC và Wyckoff đã bị loại bỏ khỏi scope do quá phức tạp.

## KB Cross-References
- **Modules affected**: Strategy Engine, News Sentiment, Shared
- **E2E flows affected**: `strategy-search-loop.md`
- **Architecture constraints**: Plugin Architecture (Strategy phải tự register), Open-Closed Principle (Thêm MACD, ATR mà không phải sửa code core).
- **Constitution gates**: Single Source of Truth (Các StrategyType mới phải đặt ở Shared/ENUM).
- **Glossary terms**: Domain, CompositeStrategy, Momentum, Trend.
