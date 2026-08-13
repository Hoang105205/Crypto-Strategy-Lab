# Implementation Plan: fix-backtest-mock-data

**Feature**: `fix-backtest-mock-data` | **Date**: 2026-08-13 | **Spec**: spec.md

## Summary
Replace hardcoded mock `BacktestResult` data in `StrategyController.getBacktestResult` by querying the Prisma database.

## Technical Context
**Language/Version**: TypeScript / NestJS
**Primary Dependencies**: `@nestjs/common`, `@prisma/client`
**Storage**: PostgreSQL via Prisma (`PrismaService` from Shared module)
**Testing**: Jest
**Target Platform**: Node.js Backend
**Project Type**: Web API (Modular Monolith)
**Performance Goals**: Low latency read for single result
**Constraints**: Follow NestJS DI. Use Shared module PrismaService.

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Source of Truth | ✅ PASS | Data is read from PostgreSQL instead of hardcoded strings |
| NestJS Module Boundaries | ✅ PASS | StrategyController correctly uses SharedModule's exported PrismaService |

## Architecture Decision
This is a minor extension to an existing controller (`StrategyController`) to integrate it with the shared `PrismaService`. 

**Approach**: Monolith addition. Inject `PrismaService` into `StrategyController` to retrieve `BacktestResult` by ID.
**Rationale**: It is a simple GET endpoint; creating a full repository pattern for a read-only endpoint that is already well-isolated is overkill. 
**Modules affected**: Strategy Engine (Controller)
**E2E flows affected**: `kb/flows/strategy-backtest.md`
**New modules needed**: None.

## Source Code Structure
- `apps/backend/src/strategy/controllers/strategy.controller.ts`: Add `PrismaService` to constructor. Replace mock return with `await this.prisma.backtestResult.findUnique()`. Add 404 handling.
- `apps/backend/src/strategy/strategy.module.ts`: Ensure `SharedModule` (or wherever `PrismaService` lives) is imported. (Wait, let's check this in implementation, but usually `SharedModule` is globally available or imported in `AppModule`).

## Complexity Tracking
*(No violations)*
