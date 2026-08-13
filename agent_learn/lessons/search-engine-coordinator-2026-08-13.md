# Lessons: search-engine-coordinator — 2026-08-13

## What Worked
- Tách file rẽ nhánh (SearchEngine) khỏi các file thuật toán cụ thể (Generators) rất dễ dàng.
- Refactoring `strategy.module.ts` hoạt động suôn sẻ bằng cách update array imports.

## What Didn't Work
- Việc tự động dọn dẹp (xóa thư mục `generators/` cũ) gặp sự cố với lệnh terminal trên môi trường hiện hành.

## Deviations from Plan
- T011 (Dọn dẹp xóa thư mục `generators/`) đã bị skip do giới hạn môi trường terminal. Người dùng hoặc lệnh xoá an toàn sẽ cần thực thi bước này bằng tay.

## KB Updates Needed
- [x] Update kb/ARCHITECTURE.md: Bổ sung Facade Pattern cho việc lấy candidate thông qua `SearchEngine`.
- [x] Update kb/modules/strategy-engine.md: Sửa sơ đồ component (Generators nay nằm trong `strategy/search/` thay vì `strategy/generators/`).
- [x] Update kb/flows/strategy-search-loop.md: Cập nhật bước "LoopController gọi Strategy Engine" sẽ đi qua class `SearchEngine`.
