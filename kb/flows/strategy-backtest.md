# Business Flow: Strategy Backtest

> **Owner**: Member B
> **Status**: Draft
> **Last Updated**: 2026-08-05

## 1. Overview
- **Description**: A user requests a backtest of a strategy; the job is queued, executed by a worker, evaluated, and the result returned
- **Primary Actor**: User (via Frontend Strategy Builder)
- **Business Value**: Users evaluate strategy quality before ranking or composing
- **Modules Involved**: Strategy Engine, Event Infrastructure (queue), Market Data (historical candles)

## 2. Preconditions
- [TODO: fill during planning phase]

## 3. Flow Steps
1. User selects strategy + parameters and requests backtest — Frontend → Strategy Engine via REST
2. Strategy Engine publishes `BacktestRequested` — Strategy Engine → EventBus
3. Worker picks up the job, fetches historical candles — Event Infrastructure → Market Data via `IMarketDataService`
4. Backtester simulates, Evaluator computes Return/WinRate/MDD/Sharpe — Strategy Engine (via worker)
5. `BacktestCompleted` published with result — Event Infrastructure → EventBus

## 4. Postconditions
- [TODO: fill during planning phase]

## 5. Alternative Paths
### [TODO Path Name]
- [TODO]

## 6. Error & Exception Flows
### Backtest job fails
- Worker retries; after max retries → dead-letter queue [TODO: detail]

## 7. Business Rules
- **BR-1**: [TODO]

## 8. Related
- **Contracts**: `kb/contracts/strategy.yaml`, `kb/contracts/events.yaml`
- **ADRs**: ADR-0006
- **Module files**: `kb/modules/strategy-engine.md`, `kb/modules/event-infrastructure.md`
