# Convergence Report: backtest-result-visualization

**Date**: 2026-08-19
**Overall Status**: 🔴 Diverged

## Gap Summary
| Classification | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| missing | 2 | 0 | 0 | 0 | 2 |
| partial | 0 | 0 | 0 | 0 | 0 |
| contradicts | 1 | 0 | 0 | 0 | 1 |
| unrequested | 0 | 0 | 0 | 0 | 0 |

## Constitution Compliance
| Principle | Status | Gaps |
|---|---|---|
| ADR-0016 (Data Isolation) | ❌ | User-created Composite strategies are being registered into the global in-memory `StrategyRegistry`, making them visible and mutable by all users. |

## Detailed Gaps

### [CRITICAL] CV001: `GET /api/strategies` does not filter by userId
- **Classification**: missing
- **Location**: `apps/backend/src/strategy/controllers/strategy.controller.ts:41`
- **Description**: `getAllStrategies` returns `this.registry.getAll()` which contains all strategies in the global memory registry. This exposes private composite strategies to all users, violating Spec FR-002 and US1.

### [CRITICAL] CV002: `DELETE /api/strategies/:name` does not check ownership
- **Classification**: missing
- **Location**: `apps/backend/src/strategy/controllers/strategy.controller.ts:50`
- **Description**: `deleteStrategy` unconditionally unregisters any strategy by name from the global registry without checking if the `currentUser` owns it.

### [CRITICAL] CV003: `POST /api/strategies/composite` overwrites global strategies blindly
- **Classification**: contradicts
- **Location**: `apps/backend/src/strategy/controllers/strategy.controller.ts:59`
- **Description**: `createComposite` unregisters existing strategies with the same name from the global registry and registers the new one (if the constructor registers it). This allows users to overwrite system strategies or other users' strategies in memory.

## Recommendations
1. Refactor `StrategyController` to separate System Strategies (from `StrategyRegistry`) and User Strategies (from `StrategyVersion` in Prisma). `getAllStrategies` should combine system strategies and the user's own `StrategyVersion` records.
2. Prevent `CompositeStrategy` from automatically registering into the global `StrategyRegistry` if it is a user-created strategy, or remove the automatic registration entirely and manage it explicitly.
3. Add ownership checks in `deleteStrategy` before allowing deletion.
