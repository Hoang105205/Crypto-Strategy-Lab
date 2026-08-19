# Lessons: news-sentiment-sync — 2026-08-18

## What Worked
- Nâng cấp `IBacktester` thành async và sử dụng `Promise` linh hoạt cho `analyzeAsync` giúp cho các chiến lược gọi API I/O bên ngoài (như Sentiment) có thể chạy mượt mà mà không làm hỏng các chiến lược tính toán đồng bộ nội bộ.
- BullMQ (Worker) xử lý Queue job rất tốt vì hàm `this.stage()` đã bao bọc logic bất đồng bộ từ trước.

## What Didn't Work
- Quên chưa update lại file cấu hình Dependency Injection của phần Mock test, dẫn đến việc Unit Test gặp lỗi `Nest can't resolve dependencies` khi đổi Interface (thực ra là lỗi tàn dư từ ticket trước nhưng bộc phát ra ở ticket này).

## Deviations from Plan
- Không có sự khác biệt so với thiết kế.

## KB Updates Needed
- [x] Update kb/contracts/strategy.yaml: Đã update phần Interface `IBacktester` và `IStrategy` (trong `contracts/strategy.md` thuộc sdd_artifacts). Lần cập nhật Knowledge Base tới sẽ merge phần này vào file gốc.
