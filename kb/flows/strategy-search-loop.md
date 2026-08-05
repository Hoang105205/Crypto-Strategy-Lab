# Business Flow: Strategy Search Loop

> **Owner**: Member D
> **Status**: Draft
> **Last Updated**: 2026-08-05

## 1. Overview
- **Description**: Continuous automated search — generate candidate strategies, backtest them via the queue, evaluate, and feed the best back into generation
- **Primary Actor**: User (starts/pauses loop via Loop Status Panel)
- **Business Value**: Automatically discovers high-performing strategy combinations
- **Modules Involved**: Event Infrastructure (loop, queue), Strategy Engine (generator, backtester, evaluator)

## 2. Preconditions
- [TODO: fill during planning phase]

## 3. Flow Steps
1. User starts the loop — Frontend → LoopController via REST
2. LoopController requests candidates via `IStrategyGenerator` — Event Infrastructure → Strategy Engine via interface
3. Each candidate enqueued as a backtest job — Event Infrastructure → JobQueue
4. Workers execute backtests, `BacktestCompleted` events published — Event Infrastructure → EventBus
5. LoopController consumes results, decides next iteration (stop/pause/continue) — Event Infrastructure

## 4. Postconditions
- [TODO: fill during planning phase]

## 5. Alternative Paths
### User pauses or stops the loop
- [TODO]

## 6. Error & Exception Flows
### [TODO Error Scenario]
- [TODO]

## 7. Business Rules
- **BR-1**: Loop orchestration communicates via events/interfaces only — never imports Strategy Engine internals

## 8. Related
- **Contracts**: `kb/contracts/events.yaml`, `kb/contracts/strategy.yaml`
- **ADRs**: ADR-0005, ADR-0006
- **Module files**: `kb/modules/event-infrastructure.md`, `kb/modules/strategy-engine.md`
