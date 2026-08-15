# Research: Aggregate Mood Score Timeframe Selector

## Decisions

### D1: Vị trí và Thiết kế Giao diện Bộ chọn Timeframe (Timeframe Selector UI Placement)
- **Chosen**: Dựng nhóm nút bấm Pill-Buttons (`1h`, `24h`, `7d`) trực tiếp bên trong/cạnh thẻ Aggregate Mood Card ở góc phải Header của `NewsFeed.tsx`.
- **Rationale**: 
  - Đảm bảo tính trực quan và gần gũi với con số điểm tâm lý đang hiển thị.
  - Phù hợp với ngôn ngữ thiết kế Glassmorphism & Dark Mode của hệ thống (`kb/DESIGN.md`).
- **Alternatives considered**: Thả thanh Dropdown chọn timeframe (chậm thao tác hơn nút bấm trực tiếp).
- **KB reference**: `kb/DESIGN.md`, `kb/contracts/news.yaml`

### D2: Mốc Thời gian Mặc định (Default Timeframe)
- **Chosen**: Mốc `24h`.
- **Rationale**: 24 giờ là khung thời gian tiêu chuẩn để đo lường tâm lý tổng quan của toàn thị trường crypto trong 1 ngày, cân bằng giữa bài báo mới phát hành và lượng bài báo đủ lớn để có thống kê chính xác.
- **Alternatives considered**: 1h (quá ngắn, dễ bị 0 bài báo nếu là đồng coin nhỏ).
- **KB reference**: `kb/contracts/news.yaml`

### D3: Đồng bộ Trạng thái khi Chuyển tab Coin (State Synchronization)
- **Chosen**: Giữ nguyên `selectedTimeframe` khi thay đổi `activeTab` (hoặc `selectedCoins`).
- **Rationale**: Người dùng muốn so sánh điểm tâm lý của các coin khác nhau trong cùng một mốc thời gian (ví dụ so sánh tâm lý BTC trong 7d vs ETH trong 7d).
- **KB reference**: `kb/flows/news-sentiment-pipeline.md`
