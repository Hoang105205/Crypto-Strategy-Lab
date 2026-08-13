# Feature Specification: News Feed Offset Pagination & Multi-Coin Filter

**Feature**: `news-pagination-multicoin`  
**Created**: 2026-08-13  
**Status**: Specified  
**Input**: User description: "Nâng cấp giao diện và API News Feed hỗ trợ phân trang Offset Pagination (trả về metadata { total, limit, offset, hasMore }) hỗ trợ cả Load More lẫn thanh chuyển trang đánh số < 1 2 3 ... X >, cùng với bộ lọc 1 hoặc nhiều coin (coin=BTC hoặc coins=BTC,ETH,SOL)."

---

## User Scenarios & Testing

### User Story 1 - Phân trang danh sách tin tức (Offset Pagination & Numbered Navigation) (Priority: P1)

Là một người dùng theo dõi thị trường crypto, tôi muốn có thể duyệt tin tức theo từng trang hoặc xem thêm tin tức cũ hơn mà không bị lặp lại bài báo đã xem, đồng thời có thể chuyển trang theo chỉ số trang `< 1 2 3 ... X >`.

**Why this priority**: Giúp tăng trải nghiệm duyệt tin tức, giảm tải bộ nhớ client và băng thông mạng khi không phải load tất cả bài báo cùng lúc.
**Independent Test**: Có thể kiểm thử độc lập bằng cách gửi query `GET /api/news?limit=10&offset=0` cho trang 1, và `GET /api/news?limit=10&offset=10` cho trang 2.

**Acceptance Scenarios**:
1. **Given** Cơ sở dữ liệu có 42 bài báo, **When** Người dùng truy cập trang tin tức ban đầu với `limit=10&offset=0`, **Then** Hệ thống trả về 10 bài báo đầu tiên kèm metadata `pagination: { total: 42, limit: 10, offset: 0, hasMore: true }`.
2. **Given** Người dùng muốn chuyển sang trang 3 (`< 3 >`), **When** Frontend tính `offset = (3 - 1) * 10 = 20` và gửi `GET /api/news?limit=10&offset=20`, **Then** Hệ thống trả về 10 bài tiếp theo (từ bài 21 đến 30) mà không lặp lại bài báo ở trang 1 và trang 2.
3. **Given** Người dùng ở trang cuối (`offset=40`), **When** Gửi `GET /api/news?limit=10&offset=40`, **Then** Metadata trả về `hasMore: false` và vô hiệu hóa nút "Xem thêm" hoặc nút "Next page".

---

### User Story 2 - Lọc tin tức theo 1 hoặc nhiều đồng coin (Multi-Coin Filter) (Priority: P1)

Là một người dùng quan tâm đến danh mục đầu tư nhiều đồng coin, tôi muốn lọc tin tức theo 1 coin cụ thể (`BTC`) hoặc một nhóm nhiều coin (`BTC, ETH, SOL`).

**Why this priority**: Đáp ứng nhu cầu cá nhân hóa thông tin theo danh mục coin của người dùng.
**Independent Test**: Gửi request `GET /api/news?coins=BTC,ETH` và kiểm tra tất cả bài báo trả về đều có mảng `relatedCoins` chứa ít nhất 'BTC' hoặc 'ETH'.

**Acceptance Scenarios**:
1. **Given** Người dùng chọn tab `🪙 BTC`, **When** Gửi `GET /api/news?coin=BTC`, **Then** Hệ thống chỉ trả về bài báo có chứa `relatedCoins: ['BTC']`.
2. **Given** Người dùng chọn danh mục nhiều coin `BTC` và `ETH`, **When** Gửi `GET /api/news?coins=BTC,ETH`, **Then** Hệ thống trả về bài báo liên quan đến BTC hoặc ETH bằng truy vấn Postgres array containment.

---

### Edge Cases
- **Kịch bản vượt mốc offset**: Nếu `offset > total` (ví dụ `offset=100` nhưng chỉ có 42 bài), hệ thống trả về mảng rỗng `data: []` và `hasMore: false` thay vì báo lỗi 500.
- **Kịch bản lọc không có bài báo**: Khi chọn coin chưa có tin tức, hệ thống trả về `data: []`, `total: 0`, `hasMore: false`.

---

## Requirements

### Functional Requirements
- **FR-001**: Hệ thống MUST hỗ trợ phân trang danh sách tin tức bằng 2 tham số query `limit` (mặc định: 10, tối đa: 50) và `offset` (mặc định: 0).
- **FR-002**: Tất cả response trả về từ `GET /api/news` MUST bao gồm đối tượng metadata `pagination` chứa 4 thông số: `total`, `limit`, `offset`, `hasMore`.
- **FR-003**: Hệ thống MUST hỗ trợ lọc tin tức theo 1 coin qua query `coin` (string) và lọc theo nhiều coin qua query `coins` (comma-separated string hoặc array).
- **FR-004**: Điểm tâm lý gộp `GET /api/sentiment/aggregate` MUST hỗ trợ nhận cả `coin` lẫn `coins` để tính toán chỉ số aggregate mood cho nhóm đồng coin.

### Key Entities
- **NewsArticle**: Thực thể bài báo trong DB (`id`, `title`, `content`, `publishedAt`, `relatedCoins`, `sentimentScore`, `sentimentLabel`).
- **PaginationMeta**: Đối tượng Metadata phân trang (`total`, `limit`, `offset`, `hasMore`).

---

## Success Criteria
- **SC-001**: API `GET /api/news` trả về kết quả phân trang chính xác với thời gian phản hồi < 100ms.
- **SC-002**: Giao diện UI có thể dựng được cả nút "More stories" lẫn thanh chuyển trang đánh số `< 1 2 3 ... X >` trực quan dựa trên Metadata trả về.

---

## Assumptions
- Dữ liệu tin tức đã được cào và lưu trữ sẵn trong PostgreSQL DB với chỉ số `publishedAt` giảm dần.
- Phân trang Offset-based đáp ứng tốt cho quy mô dữ liệu tin tức hàng ngàn bài báo trong đồ án môn học.

---

## KB Cross-References
- **Modules affected**: `kb/modules/news-sentiment.md`
- **E2E flows affected**: `kb/flows/news-sentiment-pipeline.md`
- **Architecture constraints**: `kb/contracts/news.yaml`, `kb/ADR/0009`
- **Constitution gates**: Article VI (Explicit Over Implicit Contracts)
- **Glossary terms**: `NewsArticle`, `SentimentScore`, `AggregateMood`
