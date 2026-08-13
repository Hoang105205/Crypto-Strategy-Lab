# Implementation Plan: SearchEngine Coordinator

**Feature**: `search-engine-coordinator` | **Date**: 2026-08-13 | **Spec**: spec.md

## Summary
Triển khai class `SearchEngine` làm coordinator (Facade) quản lý và điều phối các thuật toán sinh chiến lược (`RandomGenerator`, `DomainGuidedGenerator`). Chuẩn hóa cấu trúc thư mục bằng cách di chuyển các file generator vào chung thư mục `search/`.

## Technical Context
**Language/Version**: TypeScript (NestJS)
**Primary Dependencies**: `@nestjs/common`, `@crypto-strategy-lab/shared`
**Storage**: N/A cho logic sinh
**Testing**: Jest
**Target Platform**: Node.js Backend
**Project Type**: Backend Module (Strategy Engine)
**Performance Goals**: Sinh hàng nghìn ứng viên ngẫu nhiên < 100ms
**Constraints**: Phải tuân thủ OCP, Dependency Injection, không làm vỡ các flow hiện tại.

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Separation of Concerns | ✅ PASS | Tách bạch logic điều phối (SearchEngine) và logic sinh cụ thể (Generators) |
| Modular Monolith Boundaries | ✅ PASS | Nằm hoàn toàn trong `StrategyModule`, expose qua Injection |

## Architecture Decision
`SearchEngine` đóng vai trò là một service nội bộ (hoặc có thể expose qua Controller sau này) thuộc module Strategy Engine. Nó nhận Inject các `IStrategyGenerator` đã có sẵn.

**Approach**: Bổ sung Facade Service + Thao tác dọn dẹp thư mục (Refactoring).
**Rationale**: Việc gộp thư mục giúp mã nguồn gọn gàng, đúng với quy hoạch `plan-overview.md`. Facade `SearchEngine` giúp `LoopController` (của Phương) chỉ cần tương tác với 1 đầu mối duy nhất thay vì phải gọi trực tiếp từng Generator.
**Modules affected**: `StrategyModule`
**E2E flows affected**: `strategy-search-loop.md`
**New modules needed**: Không có.

## Source Code Structure
```text
apps/backend/src/strategy/
├── search/
│   ├── search-engine.ts           (MỚI)
│   ├── random.generator.ts        (DI CHUYỂN từ generators/)
│   └── domain-guided.generator.ts (DI CHUYỂN từ generators/)
├── strategy.module.ts             (CẬP NHẬT exports/providers/imports)
```
