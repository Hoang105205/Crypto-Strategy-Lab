# Implementation Plan: Fix Strategy Engine Bugs

**Feature**: `fix-strategy-engine-bugs` | **Date**: 2026-08-14 | **Spec**: spec.md

## Summary
The `StrategyController` currently bypasses the architectural event flow by omitting the job queue integration and using a local `EventBusService`. This plan outlines the removal of the local service, the integration of shared `IJobQueue` and `IEventBus` interfaces into the controller, and the documentation of the missing `DELETE /api/strategies/:name` endpoint in the contract.

## Technical Context
**Language/Version**: TypeScript / NestJS
**Primary Dependencies**: `@nestjs/common`, `@crypto-strategy-lab/shared`
**Target Platform**: Backend API
**Project Type**: Web API Module
**Constraints**: Must use shared `IEventBus` and `IJobQueue` interfaces (ADR-0005, ADR-0006).

## User Review Required
> [!IMPORTANT]
> The `IJobQueue` and `IEventBus` will be injected using `@Inject('IJobQueue')` and `@Inject('IEventBus')`. Please confirm if the team has decided on different injection tokens for these shared interfaces.

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Module Boundaries | ✅ PASS | We are removing the local event bus and using the shared infrastructure interfaces, which restores module boundaries. |
| Contracts SSoT | ✅ PASS | Documenting the undocumented `DELETE` endpoint restores the contract as the Single Source of Truth. |

## Architecture Decision
**Approach**: Monolith refactoring.
**Rationale**: Strategy Engine must use the central Event Infrastructure (Phương's module) to enable the leaderboard and search loop to function properly.
**Modules affected**: Strategy Engine
**E2E flows affected**: Strategy Backtest (`kb/flows/strategy-backtest.md`)

## Source Code Structure
- `apps/backend/src/strategy/events/event-bus.service.ts` -> [DELETE]
- `apps/backend/src/strategy/controllers/strategy.controller.ts` -> [MODIFY]
- `apps/backend/src/strategy/strategy.module.ts` -> [MODIFY] (remove local event bus provider)
- `kb/contracts/strategy.yaml` -> [MODIFY] (add DELETE endpoint)
