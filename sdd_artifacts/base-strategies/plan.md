# Implementation Plan: Base Technical Strategies

**Feature**: `base-strategies` | **Date**: 2026-08-11 | **Spec**: spec.md

## Summary
Implement 4 foundational technical trading strategies (Moving Average, RSI, Bollinger Bands, Support/Resistance) that adhere to the `IStrategy` interface and return standardized `Signal` objects. These will be automatically registered into the `StrategyRegistry` upon application startup via `StrategyModule`.

## Technical Context
**Language/Version**: TypeScript (Node.js / NestJS)
**Primary Dependencies**: `@crypto-strategy-lab/shared` (`IStrategy`, `Candle`, `Signal`, `SignalAction`, `StrategyType`), `technicalindicators` (npm package for standard mathematical calculations).
**Storage**: N/A (Stateless strategies)
**Testing**: Jest unit tests mocking historical candles.
**Target Platform**: Node.js runtime (Modular Monolith)
**Project Type**: Backend Service Module (`StrategyModule`)
**Performance Goals**: Fast, synchronous calculation of signals based on in-memory candle arrays.
**Constraints**: Must strictly follow Open-Closed Principle (ADR-0003); no hardcoded logic in the strategy engine for these specific algorithms.

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Architecture Quality Over Trading Profitability | ✅ PASS | Focus is on clean implementation of `IStrategy`, not maximizing PnL. |
| II. Contract-Driven | ✅ PASS | Fully respects shared contracts (`IStrategy`, `Signal`, `Candle`). |
| III. Extension Points Must Be Demonstrable | ✅ PASS | Directly demonstrates the `StrategyRegistry` extension point. |
| IV. Simplicity Over Cleverness | ✅ PASS | Utilizing standard `technicalindicators` library rather than complex bespoke math. |
| V. Knowledge Base as Truth | ✅ PASS | Follows `kb/modules/strategy-engine.md`. |
| VI. Explicit Over Implicit | ✅ PASS | Each strategy is a standalone class explicitly registered in the NestJS module. |

## Architecture Decision
Fits directly into `apps/backend/src/strategy/strategies/` within the `StrategyModule`. Each strategy will be a NestJS `@Injectable()` provider. 

**Approach**: Monolith addition / Plugin implementations
**Rationale**: By making each strategy an `@Injectable()` provider, NestJS handles instantiation. We can inject the `StrategyRegistry` into the strategies (or a dedicated strategy loader) to register them upon initialization (`OnModuleInit`).
**Modules affected**: Strategy Engine (`apps/backend/src/strategy`)
**E2E flows affected**: `kb/flows/strategy-backtest.md`
**New modules needed**: None

## Source Code Structure
```
apps/backend/src/strategy/
├── strategies/
│   ├── index.ts                     # Barrel export for all strategies
│   ├── moving-average.strategy.ts   # MA implementation
│   ├── rsi.strategy.ts              # RSI implementation
│   ├── bollinger-bands.strategy.ts  # BB implementation
│   ├── support-resistance.strategy.ts # S/R implementation
│   └── tests/                       # Unit tests for strategies
│       ├── moving-average.spec.ts
│       ├── rsi.spec.ts
│       ├── bollinger-bands.spec.ts
│       └── support-resistance.spec.ts
└── strategy.module.ts               # Updated to provide and register strategies
```
