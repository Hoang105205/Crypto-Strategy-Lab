# Implementation Plan: Immutable Strategy Enforcement

**Feature**: `immutable-strategy-enforcement` | **Date**: 2026-09-02 | **Spec**: [`spec.md`](file:///d:/DaiHoc/KienTrucPM/sdd_artifacts/immutable-strategy-enforcement/spec.md)

## Summary
Enforce absolute immutability of strategies across the entire system as mandated by ADR-0008. Completely eliminate delete triggers from the Frontend UI ([`StrategyCard`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/frontend/src/components/strategy/StrategyCard.tsx) and [`StrategyBuilderPage`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/frontend/src/app/strategy/page.tsx)), clean up API service methods, and ensure the Backend API ([`StrategyController`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/backend/src/strategy/controllers/strategy.controller.ts)) strictly rejects any deletion requests with HTTP 403 Forbidden to prevent broken composite dependencies and protect leaderboard reproducibility.

## Technical Context
**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: Next.js 16.3 (Turbopack), NestJS 11.x, Prisma 6.x, PostgreSQL  
**Storage**: PostgreSQL `StrategyVersion` table (insert-only, immutable snapshots)  
**Testing**: Jest (Backend unit/integration), Vitest (Frontend unit tests)  
**Target Platform**: Web application (Next.js client + NestJS backend)  
**Project Type**: Monorepo Web Application  
**Performance Goals**: Instant UI rendering (0 extraneous delete checks/handlers), zero dangling composite dependency errors  
**Constraints**: ADR-0008 (Strategy Versioning & Immutable Snapshots), ADR-0003 (Plugin Architecture)

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|---|---|---|
| I. Architecture Quality Over Trading Profitability | ✅ PASS | Preserves reproducibility and lineage auditability of Leaderboard entries |
| II. Contract-Driven | ✅ PASS | API behavior and interfaces reflect immutable semantics |
| III. Extension Points Demonstrable | ✅ PASS | Base strategies and composites remain fully demonstrable without mutation risks |
| IV. Simplicity Over Cleverness | ✅ PASS | Removing dead delete code simplifies UI state and eliminates cascading error logic |
| V. Knowledge Base as Truth | ✅ PASS | Conforms directly to ADR-0008 and KB Module specifications |
| VI. Explicit Over Implicit | ✅ PASS | Explicit 403 Forbidden with clear architectural explanation |

## Architecture Decision
- **Approach**: Modular monolith enforcement — UI element elimination + strict backend HTTP 403 boundary guard.
- **Rationale**: ADR-0008 dictates that every strategy version is a frozen snapshot. Deleting child strategies breaks composite execution during backtesting and search loops. Removing the delete trigger entirely from the UI prevents accidental or intentional corruption of the dependency graph.
- **Modules affected**:
  - `Strategy Engine` ([`apps/backend/src/strategy/`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/backend/src/strategy/))
  - `Frontend` ([`apps/frontend/src/app/strategy/`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/frontend/src/app/strategy/), [`apps/frontend/src/components/strategy/`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/frontend/src/components/strategy/))
- **E2E flows affected**:
  - [`kb/flows/strategy-backtest.md`](file:///d:/DaiHoc/KienTrucPM/kb/flows/strategy-backtest.md) (preserves strategy version resolution)
  - [`kb/flows/composite-with-sentiment.md`](file:///d:/DaiHoc/KienTrucPM/kb/flows/composite-with-sentiment.md) (preserves child version integrity)

## Source Code Structure
```
workspace/
├── apps/
│   ├── backend/src/strategy/controllers/
│   │   ├── strategy.controller.ts            # Ensure DELETE returns HTTP 403 with ADR-0008 message
│   │   └── tests/strategy.controller.spec.ts  # Verify 403 Forbidden on DELETE
│   └── frontend/
│       ├── src/components/strategy/
│       │   ├── StrategyCard.tsx              # Remove delete button, showDelete logic & canDelete prop
│       │   └── StrategyCard.spec.tsx         # Update test asserting absence of delete button
│       ├── src/app/strategy/
│       │   └── page.tsx                      # Remove handleDeleteStrategy and onDelete props
│       └── src/services/
│           ├── api-client.ts                 # Deprecate/remove deleteUserStrategy
│           └── api-client.spec.ts            # Update API client tests
```

## Complexity Tracking
*No constitution violations or unexpected complexity. Clean removal and enforcement.*
