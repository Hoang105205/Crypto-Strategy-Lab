# Implementation Plan: Strategy Registry Plugin System

**Feature**: `strategy-registry` | **Date**: 2026-08-11 | **Spec**: spec.md

## Summary
Refactor and enhance the existing `StrategyRegistry` service in `apps/backend/src/strategy/registry/strategy.registry.ts`. Ensure full compliance with ADR-0003:
- Add strict duplicate registration prevention throwing descriptive `Error` on name or composite key collision (`${getType()}:${getName()}`).
- Expose an `analyze(nameOrType: string, candles: ICandle[]): ISignal` delegation method.
- Maintain existing `get()`, `getAll()`, `has()`, and `register()` signatures.

## Technical Context
**Language/Version**: TypeScript (Node.js / NestJS)
**Primary Dependencies**: `@crypto-strategy-lab/shared` (`IStrategy`, `ICandle`, `ISignal`), `@nestjs/common` (`@Injectable`, `Logger`)
**Storage**: In-memory Map (`Map<string, IStrategy>`) within `@Injectable()` NestJS Singleton
**Testing**: Jest unit tests for `StrategyRegistry`
**Target Platform**: Node.js runtime (Modular Monolith)
**Project Type**: Backend Service Module (`StrategyModule`)
**Performance Goals**: Sub-millisecond lookup and delegation time for in-memory strategy instances
**Constraints**: Open-Closed Principle (ADR-0003), No modification to concrete strategy implementations when adding new ones

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Architecture Quality Over Trading Profitability | ✅ PASS | Implements Plugin Pattern for strategy modifiability |
| II. Contract-Driven | ✅ PASS | Adheres to `IStrategy` & `ISignal` contracts from `@crypto-strategy-lab/shared` |
| III. Extension Points Must Be Demonstrable | ✅ PASS | StrategyRegistry is the core extension point for adding strategies |
| IV. Simplicity Over Cleverness | ✅ PASS | Simple in-memory Map lookup with clear validation logic |
| V. Knowledge Base as Truth | ✅ PASS | Directly aligned with ADR-0003 & `kb/modules/strategy-engine.md` |
| VI. Explicit Over Implicit | ✅ PASS | Explicit collision errors and explicit delegation methods |

## Architecture Decision
Fits directly into `apps/backend/src/strategy/registry/strategy.registry.ts` within the `StrategyModule`.

**Approach**: Monolith addition / Module enhancement (refactoring existing NestJS provider)
**Rationale**: `StrategyRegistry` is a NestJS injectable singleton provider exported by `StrategyModule` for strategy registration and lookup across the strategy engine.
**Modules affected**: Strategy Engine (`apps/backend/src/strategy`)
**E2E flows affected**: `kb/flows/strategy-backtest.md`, `kb/flows/composite-with-sentiment.md`
**New modules needed**: None

## Source Code Structure
```
apps/backend/src/strategy/
├── registry/
│   ├── strategy.registry.ts        # Updated StrategyRegistry provider
│   └── strategy.registry.spec.ts   # Unit tests for StrategyRegistry
└── strategy.module.ts              # Exports StrategyRegistry
```
