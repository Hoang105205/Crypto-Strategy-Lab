# Implementation Plan: Backtest Engine, Evaluator, Search Generators & Versioning

**Feature**: `backtest-search-engine` | **Date**: 2026-08-12 | **Spec**: spec.md

## Summary
Implement 4 core components of the Strategy Engine:
1. `Backtester` implementing `IBacktester` (Simulate trade execution over historical candles).
2. `Evaluator` implementing `IEvaluator` (Quantitative metrics calculation: Return, WinRate, MaxDrawdown, Sharpe, ProfitFactor).
3. `RandomGenerator` and `DomainGuidedGenerator` implementing `IStrategyGenerator` (Automated candidate generation for search loops).
4. `StrategyVersioningService` (Persist immutable strategy snapshots).

## Technical Context
**Language/Version**: TypeScript (Node.js / NestJS)
**Dependencies**: `@crypto-strategy-lab/shared` (`IBacktester`, `IEvaluator`, `IStrategyGenerator`, `Trade`, `EvaluationMetrics`, `StrategyVersion`, `BacktestConfig`).
**Testing**: Jest unit tests.
**Target Platform**: Backend Service (`StrategyModule`).

## Source Code Structure
```
apps/backend/src/strategy/
├── backtester/
│   ├── backtester.service.ts       # Implementation of IBacktester
│   ├── index.ts
│   └── tests/
│       └── backtester.spec.ts
├── evaluator/
│   ├── evaluator.service.ts        # Implementation of IEvaluator
│   ├── index.ts
│   └── tests/
│       └── evaluator.spec.ts
├── generators/
│   ├── random.generator.ts         # Random IStrategyGenerator
│   ├── domain-guided.generator.ts  # DomainGuided IStrategyGenerator
│   ├── index.ts
│   └── tests/
│       ├── random.generator.spec.ts
│       └── domain-guided.generator.spec.ts
├── versioning/
│   ├── strategy-versioning.service.ts # Manages immutable StrategyVersion snapshots
│   ├── index.ts
│   └── tests/
│       └── strategy-versioning.spec.ts
└── strategy.module.ts              # Provide and export all 4 services
```
