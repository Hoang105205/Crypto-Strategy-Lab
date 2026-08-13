# Lessons: strategy-rest-events — 2026-08-13

## What Worked
- Implementing GET endpoints using existing `StrategyVersioningService` and mocking missing data (like `BacktestResult`) allows the REST API to be fully functional for frontend integration without blocking on Prisma DB implementation.

## What Didn't Work
- N/A

## Deviations from Plan
- None. Added mock data for `GET /api/strategies/backtest/:id` as planned.

## KB Updates Needed
- [x] Tích hợp CSDL Prisma (sẽ được làm ở các task tiếp theo).
