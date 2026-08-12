# Implementation Plan: Composite Strategy & Signal Combiners

**Feature**: `composite-strategy` | **Date**: 2026-08-12 | **Spec**: spec.md

## Summary
Implement the `CompositeStrategy` class along with two signal combiner implementations (`MajorityVoteCombiner` and `WeightedScoreCombiner`). The composite strategy enables combining multiple `IStrategy` instances into a single high-level trading strategy, adhering to the Gang of Four Composite Pattern and ADR-0008.

## Technical Context
**Language/Version**: TypeScript (Node.js / NestJS)
**Primary Dependencies**: `@crypto-strategy-lab/shared` (`IStrategy`, `ICombiner`, `Candle`, `Signal`, `SignalAction`, `StrategyType`, `CombinerType`).
**Storage**: Stateless in-memory signal combination.
**Testing**: Jest unit tests covering combiners and composite execution.
**Target Platform**: Backend Service (`StrategyModule`)
**Constraints**: Must strictly follow ADR-0008 and `IStrategy` / `ICombiner` interfaces.

## Constitution Check
*GATE: Must pass before implementation.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Architecture Quality Over Trading Profitability | ✅ PASS | Design focuses on clean GoF Composite pattern. |
| II. Contract-Driven | ✅ PASS | Adheres strictly to `IStrategy` and `ICombiner` contracts. |
| III. Extension Points Must Be Demonstrable | ✅ PASS | Allows adding new `ICombiner` types seamlessly. |
| IV. Simplicity Over Cleverness | ✅ PASS | Clear, readable mathematical scoring and voting logic. |
| V. Knowledge Base as Truth | ✅ PASS | Aligned with `kb/contracts/strategy.yaml` and ADR-0008. |
| VI. Explicit Over Implicit | ✅ PASS | Explicit signal combination output with clear metadata. |

## Source Code Structure
```
apps/backend/src/strategy/
├── combiners/
│   ├── majority-vote.combiner.ts    # Majority Vote implementation
│   ├── weighted-score.combiner.ts   # Weighted Score implementation
│   ├── index.ts                     # Barrel export for combiners
│   └── tests/                       # Combiner unit tests
│       ├── majority-vote.spec.ts
│       └── weighted-score.spec.ts
├── composite/
│   ├── composite.strategy.ts        # CompositeStrategy class implementing IStrategy
│   ├── index.ts                     # Barrel export
│   └── tests/
│       └── composite.strategy.spec.ts
└── strategy.module.ts               # Expose composite & combiners as providers
```
