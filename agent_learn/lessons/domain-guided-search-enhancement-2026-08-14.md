# Lessons: domain-guided-search-enhancement — 2026-08-14

## What Worked
- Dùng `technicalindicators` library rất tiết kiệm thời gian so với việc tự implement lại MACD, Stochastic, ATR.
- Mở rộng thuật toán bằng `Record<string, IStrategy[]>` giúp nhóm Domain rất linh hoạt dựa trên `StrategyType`.

## What Didn't Work
- Gọi `npx tsc` thẳng trong workspace bị báo lỗi không tìm thấy cấu hình do workspace có thể đang sử dụng Nx hoặc cấu trúc monorepo phức tạp hơn thay vì `tsconfig.json` ở thư mục gốc.

## Deviations from Plan
- Bỏ SMC, Wyckoff ngay từ Phase 1 (Specify) theo yêu cầu của user, nên Plan và Code không phải implement phần này.

## KB Updates Needed
- [ ] Update kb/MODULES.md: Cần thêm mô tả về Domain (Trend, Momentum, Volatility, Structure, Information) vào phần Strategy Engine.
- [ ] Update kb/flows/strategy-search-loop.md: Làm rõ quá trình sinh chiến lược khi type = DOMAIN_GUIDED.
