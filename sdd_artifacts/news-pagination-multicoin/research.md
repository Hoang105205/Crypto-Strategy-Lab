# Research: News Feed Offset Pagination & Multi-Coin Filter

## Decisions

### D1: Phương pháp Phân trang (Pagination Strategy)
- **Chosen**: Offset-based Pagination (`skip: offset`, `take: limit`).
- **Rationale**: 
  - Phù hợp với giao diện cần chuyển trang trực tiếp bằng con số `< 1 2 3 ... X >` vì dễ dàng tính toán `offset = (page - 1) * limit`.
  - Phù hợp với nút "📰 More stories" (Load More) bằng cách tăng `offset = offset + limit`.
  - Phù hợp với quy mô dữ liệu hàng ngàn bài báo tin tức trong dự án.
- **Alternatives considered**: Cursor-based pagination (không hỗ trợ nhảy trực tiếp tới trang số bất kỳ).
- **KB reference**: `kb/contracts/news.yaml`

### D2: Phương pháp Lọc Nhiều Coin (Multi-Coin Filtering)
- **Chosen**: Prisma Array Containment (`hasSome: coins.map(c => c.toUpperCase())`).
- **Rationale**: Trường `relatedCoins` trong cơ sở dữ liệu lưu dưới dạng mảng các mã coin (ví dụ `['BTC', 'ETH']`). Toán tử `hasSome` trong Prisma kiểm tra xem mảng bài báo có chứa bất kỳ đồng coin nào trong danh sách được yêu cầu không.
- **Alternatives considered**: Chuỗi regex OR (chậm và không tận dụng được index mảng).
- **KB reference**: `kb/contracts/news.yaml`

### D3: Cấu trúc Metadata Trả về cho Frontend
- **Chosen**: `{ data: NewsArticle[], pagination: { total: number, limit: number, offset: number, hasMore: boolean } }`.
- **Rationale**: 
  - Đảm bảo đầy đủ thông tin để tính `totalPages = Math.ceil(total / limit)` và `currentPage = Math.floor(offset / limit) + 1`.
  - Đáp ứng nguyên tắc *Explicit Over Implicit Contracts* (Điều lệ dự án Article VI).
