# Feature Specification: Aggregate Mood Score Timeframe Selector

**Feature**: `sentiment-timeframe-selector`  
**Created**: 2026-08-13  
**Status**: Specified  
**Input**: User description: "Nâng cấp giao diện tin tức (News Feed Header) cho phép người dùng lựa chọn mốc thời gian (timeframe) tính toán điểm tâm lý gộp (Aggregate Mood Score) giữa các mốc mà hệ thống hiện tại cung cấp (1h, 24h, 7d), thay vì cố định một mốc thời gian."

---

## User Scenarios & Testing

### User Story 1 - Lựa chọn mốc thời gian tính điểm tâm lý gộp (Aggregate Mood Timeframe Selection) (Priority: P1)

Là một nhà đầu tư crypto xem bảng tin tức, tôi muốn có thể chuyển đổi giữa các mốc thời gian `⏱️ 1h`, `⏱️ 24h`, và `⏱️ 7d` trên thẻ Aggregate Mood Score để theo dõi diễn biến tâm lý thị trường theo thời gian thực hoặc xu hướng dài hạn.

**Why this priority**: Giúp cá nhân hóa trải nghiệm xem điểm tâm lý thị trường theo khung thời gian giao dịch của người dùng (ngắn hạn vs dài hạn).  
**Independent Test**: Chọn từng mốc `1h`, `24h`, `7d` trên UI header và kiểm tra URL request API `GET /api/sentiment/aggregate?timeframe=1h` tương ứng.

**Acceptance Scenarios**:
1. **Given** Người dùng truy cập trang tin tức ban đầu, **When** Trang vừa tải xong, **Then** Thẻ Aggregate Mood Score hiển thị mốc mặc định `24h` cùng các nút chuyển đổi mốc thời gian `1h | 24h | 7d`.
2. **Given** Người dùng đang ở mốc `24h`, **When** Nhấp chọn nút `1h`, **Then** Frontend gửi request `GET /api/sentiment/aggregate?timeframe=1h&coin=...` và cập nhật lại `Score`, `Label` (POSITIVE/NEGATIVE/NEUTRAL) cùng nhãn hiển thị `Aggregate Mood (1h)`.
3. **Given** Người dùng lọc theo 1 coin (`BTC`) hoặc nhiều coin (`BTC,ETH`), **When** Thay đổi mốc thời gian sang `7d`, **Then** Hệ thống tính toán đúng điểm gộp của coin/danh mục coin được chọn trong 7 ngày qua.

---

### Edge Cases
- **Kịch bản không có bài báo trong mốc thời gian ngắn (1h)**: Nếu trong 1h qua không có bài báo mới, API trả về điểm trung lập `Score: 0.0`, `Label: NEUTRAL`, `articleCount: 0`. UI hiển thị badge NEUTRAL và thông tin rõ ràng.
- **Kịch bản chuyển tab coin khi đang chọn timeframe 7d**: Khi người dùng đổi từ `BTC` sang `ETH`, mốc thời gian `7d` đang chọn được giữ nguyên và request `GET /api/sentiment/aggregate?coin=ETH&timeframe=7d` được thực hiện.

---

## Requirements

### Functional Requirements
- **FR-001**: Giao diện News Feed Header MUST hiển thị bộ chọn mốc thời gian (Timeframe Selector) gồm 3 lựa chọn: `1h`, `24h` (mặc định), và `7d`.
- **FR-002**: Khi người dùng thay đổi lựa chọn mốc thời gian, Frontend MUST tự động gọi lại API `GET /api/sentiment/aggregate` với tham số query `timeframe=<selected>` tương ứng.
- **FR-003**: Bộ chọn mốc thời gian MUST duy trì trạng thái được chọn đồng bộ khi người dùng thay đổi bộ lọc coin (`coin` hoặc `coins`).
- **FR-004**: Nhãn tiêu đề Aggregate Mood trên Header MUST phản ánh rõ mốc thời gian đang chọn (ví dụ: `Aggregate Mood (BTC · 1h)`).

### Key Entities
- **AggregateSentimentDTO**: Đối tượng dữ liệu trả về từ API (`score`, `label`, `articleCount`, `updatedAt`).
- **TimeframeOption**: Kiểu dữ liệu enum mốc thời gian (`'1h'`, `'24h'`, `'7d'`).

---

## Success Criteria
- **SC-001**: Thao tác chuyển đổi mốc thời gian trên UI phản hồi mượt mà, thời gian cập nhật lại chỉ số điểm tâm lý < 150ms.
- **SC-002**: Nút bấm bộ chọn mốc thời gian có hiệu ứng active/hover chuẩn UI dark-mode của ứng dụng.

---

## Assumptions
- Backend API `GET /api/sentiment/aggregate` đã hỗ trợ sẵn query param `timeframe` với các giá trị `'1h'`, `'24h'`, `'7d'`.
- Mốc thời gian mặc định ban đầu là `24h` (tương ứng khung nhìn tiêu chuẩn thị trường).

---

## KB Cross-References
- **Modules affected**: `kb/modules/news-sentiment.md`
- **E2E flows affected**: `kb/flows/news-sentiment-pipeline.md`
- **Architecture constraints**: `kb/contracts/news.yaml`
- **Constitution gates**: Article VI (Explicit Over Implicit Contracts)
- **Glossary terms**: `SentimentScore`, `SentimentLabel`, `AggregateMood`
