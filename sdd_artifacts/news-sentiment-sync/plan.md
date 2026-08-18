# Implementation Plan: news-sentiment-sync

**Feature**: `news-sentiment-sync` | **Date**: 2026-08-18 | **Spec**: spec.md

## Summary
Đồng bộ hóa `NewsSentimentStrategy` với `Strategy Engine` bằng cách nâng cấp `IBacktester` thành asynchronous. Điều này cho phép backtester chờ (await) kết quả phân tích tin tức từ `NewsService` thay vì bị ép chạy đồng bộ và luôn trả về `HOLD`.

## Technical Context
**Language/Version**: TypeScript / NestJS
**Primary Dependencies**: None (Chỉ sửa Interface nội bộ)
**Storage**: N/A
**Testing**: Jest
**Target Platform**: Backend
**Project Type**: Monolith
**Constraints**: Cần đảm bảo backwards compatibility (các strategy đồng bộ cũ không được hỏng).

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Architecture Quality | ✅ PASS | Giữ nguyên Strategy Engine contract, chỉ thêm khả năng Async. |
| II. Contract-Driven | ✅ PASS | Sẽ cập nhật `strategy.yaml` để phản ánh sự thay đổi interface. |
| IV. Simplicity Over Cleverness | ✅ PASS | Thay vì cấu trúc lại toàn bộ Strategy (như nhúng tin tức vào Candle), chỉ cần đổi hàm `run` thành async. |

## Architecture Decision
Nâng cấp `IBacktester` và `IStrategy` tại module Shared (libs/shared).

**Approach**: Extension (Mở rộng Interface).
**Rationale**: `IStrategy` hiện tại quá cứng nhắc khi không hỗ trợ I/O bên ngoài (DB, Network). Mở rộng `IStrategy` thêm `analyzeAsync` và làm cho `IBacktester.run()` thành async là cách sạch sẽ nhất, được BullMQ worker hỗ trợ sẵn (`this.stage()` chấp nhận cả Promise).
**Modules affected**: Strategy Engine, Shared Interfaces.
**E2E flows affected**: Flow 1 (User Backtest).

## Source Code Structure
- `libs/shared/src/interfaces/strategy.ts` (Sửa interface).
- `apps/backend/src/strategy/backtester/backtester.service.ts` (Implement async run).
- `apps/backend/src/strategy/backtester/tests/backtester.spec.ts` (Sửa bài test).

## Complexity Tracking
N/A - Không vi phạm hiến pháp.
