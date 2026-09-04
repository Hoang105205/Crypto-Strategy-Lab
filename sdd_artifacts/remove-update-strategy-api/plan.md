# Implementation Plan: Remove Update Strategy API

**Feature**: `remove-update-strategy-api` | **Date**: 2026-08-19 | **Spec**: spec.md

## Summary
Remove the ability to update an existing strategy via API or Frontend UI to enforce the Strategy Versioning principle (immutability). Once a strategy is created, it cannot be modified; users must create a new strategy instead.

## Technical Context
**Language/Version**: TypeScript (NestJS + Next.js)
**Primary Dependencies**: @nestjs/common, next
**Target Platform**: Backend API + Web Frontend
**Project Type**: Fullstack Web App
**Constraints**: Must ensure backward compatibility for reading/fetching strategies.

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Immutability | ✅ PASS | This feature directly enforces immutability by removing the update endpoint. |
| Clean Boundaries | ✅ PASS | Does not violate module boundaries. |

## Architecture Decision
**Approach**: Monolith modification (removing code).
**Rationale**: Strategy Versioning requires that any changes to strategy parameters produce a new strategy ID. Exposing a PUT/PATCH endpoint risks mutating historical strategy data, which would invalidate historical backtest results.
**Modules affected**: Strategy Engine
**E2E flows affected**: strategy-backtest.md

## Source Code Structure
- `apps/backend/src/strategy/controllers/strategy.controller.ts`: Remove `PUT` or `PATCH` endpoint.
- `apps/backend/src/strategy/services/strategy.service.ts`: (If exists) Remove `updateStrategy` method.
- `apps/frontend/src/app/strategy/page.tsx` (or related components): Remove any "Update" / "Save Changes" logic that mutates an existing `strategy.id`.
