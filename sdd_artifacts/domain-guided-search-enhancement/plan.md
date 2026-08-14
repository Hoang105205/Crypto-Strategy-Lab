# Implementation Plan: domain-guided-search-enhancement

**Feature**: `domain-guided-search-enhancement` | **Date**: 2026-08-14 | **Spec**: spec.md

## Summary
Nâng cấp thuật toán `DomainGuidedGenerator` để tự động phân loại các chiến lược hiện có vào 5 nhóm Domain (Trend, Momentum, Volatility, Structure, Information). Bổ sung 3 chiến lược mới (MACD, Stochastic, ATR) và thiết lập NewsSentimentStrategy vào nhóm Information. Khi tạo composite, thuật toán sẽ kết hợp chéo các chiến lược từ 2-3 domain khác nhau.

## Technical Context
**Language/Version**: TypeScript (NestJS)
**Primary Dependencies**: `technicalindicators` (cho MACD, Stochastic, ATR)
**Storage**: N/A (Chỉ xử lý logic In-Memory trong Strategy Engine)
**Testing**: Jest
**Target Platform**: Backend API
**Project Type**: API
**Performance Goals**: Sinh 100+ composite strategy trong < 100ms.
**Constraints**: Các chiến lược mới phải tuân thủ nghiêm ngặt `IStrategy` interface và tự động đăng ký vào `StrategyRegistry`. Enum `StrategyType` phải được cập nhật ở `libs/shared`.

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Source of Truth | ✅ PASS | ENUM được khai báo duy nhất tại `libs/shared`. |
| Dependency Injection | ✅ PASS | Các Strategy tự động inject `StrategyRegistry` để đăng ký. |
| Plugin Architecture | ✅ PASS | Không can thiệp vào file gốc của SearchEngine, Generator tự động loop qua registry. |

## Architecture Decision
Tính năng này nằm hoàn toàn trong giới hạn của Module **Strategy Engine** và một chút ở **Shared Module**.
Thuận (News Sentiment) đã tuân thủ Plugin Architecture nên không cần chỉnh sửa module News.

**Approach**: Mở rộng (Extension). Thêm class strategy mới implements `IStrategy` và sửa thuật toán `DomainGuidedGenerator` đang bị hardcode.
**Rationale**: Tuân thủ Open-Closed Principle. Việc thêm chiến lược mới (MACD, v.v.) chỉ cần viết file mới và đăng ký vào Provider array của Module.
**Modules affected**: `Strategy Engine`, `Shared`
**E2E flows affected**: `strategy-search-loop.md`
**New modules needed**: Không có.

## Source Code Structure
- `libs/shared/src/types/enums.ts` (Sửa đổi `StrategyType`)
- `apps/backend/src/strategy/strategies/macd.strategy.ts` (Mới)
- `apps/backend/src/strategy/strategies/stochastic.strategy.ts` (Mới)
- `apps/backend/src/strategy/strategies/atr.strategy.ts` (Mới)
- `apps/backend/src/strategy/strategies/index.ts` (Export mới)
- `apps/backend/src/strategy/strategy.module.ts` (Cập nhật provider)
- `apps/backend/src/strategy/search/domain-guided.generator.ts` (Viết lại thuật toán)

## Complexity Tracking
*(Không có violation nào cần justify)*
