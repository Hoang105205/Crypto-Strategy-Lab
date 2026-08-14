# Implementation Plan: strategy-rest-events

**Feature**: `strategy-rest-events` | **Date**: 2026-08-13 | **Spec**: spec.md

## Summary
Triển khai 3 GET endpoints còn thiếu (`GET /api/strategies/:id`, `GET /api/strategies/:name/versions`, `GET /api/strategies/backtest/:id`) để hoàn thiện StrategyController.

## Technical Context
**Language/Version**: NestJS 11.x (TypeScript)
**Primary Dependencies**: `StrategyRegistry`, `StrategyVersioningService`
**Storage**: In-memory Map (cho phiên bản hiện tại, Prisma sẽ tích hợp sau)
**Testing**: Jest (Unit Tests)
**Target Platform**: Backend API
**Project Type**: Web App (Modular Monolith)

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Controller - Service Segregation | ✅ PASS | Controller không chứa logic kinh doanh, chỉ uỷ quyền xuống service. |
| Single Source of Truth | ✅ PASS | Payload và endpoints được thiết kế theo đúng `kb/contracts/strategy.yaml`. |

## Architecture Decision
**Approach**: Monolith addition.
**Rationale**: Bổ sung thêm API endpoint vào controller hiện có.
**Modules affected**: Strategy Engine
**E2E flows affected**: strategy-backtest.md

## Source Code Structure
- `apps/backend/src/strategy/controllers/strategy.controller.ts` (Cập nhật)
- `apps/backend/src/strategy/versioning/strategy-versioning.service.ts` (Cập nhật)
