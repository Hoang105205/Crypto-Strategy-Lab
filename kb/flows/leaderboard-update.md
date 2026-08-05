# Business Flow: Leaderboard Update

> **Owner**: Member D
> **Status**: Draft
> **Last Updated**: 2026-08-05

## 1. Overview
- **Description**: When a backtest completes, the leaderboard re-ranks the Top-K strategies and pushes the update to the frontend in real time
- **Primary Actor**: Event Infrastructure (triggered by `BacktestCompleted` event)
- **Business Value**: Users watch strategy rankings evolve live without polling
- **Modules Involved**: Event Infrastructure, Frontend

## 2. Preconditions
- [TODO: fill during planning phase]

## 3. Flow Steps
1. `BacktestCompleted` published with evaluation metrics — Event Infrastructure → EventBus
2. Leaderboard service (Observer) consumes the event — Event Infrastructure (internal)
3. Top-K ranking recomputed and persisted — Event Infrastructure → PostgreSQL
4. `LeaderboardUpdated` published → WebSocket pushes to frontend — Event Infrastructure → Frontend
5. Leaderboard table re-renders with new ranking — Frontend

## 4. Postconditions
- [TODO: fill during planning phase]

## 5. Alternative Paths
### [TODO Path Name]
- [TODO]

## 6. Error & Exception Flows
### [TODO Error Scenario]
- [TODO]

## 7. Business Rules
- **BR-1**: Leaderboard only reacts to events — the Strategy Engine is unaware of the leaderboard's existence

## 8. Related
- **Contracts**: `kb/contracts/events.yaml`
- **ADRs**: ADR-0011
- **Module files**: `kb/modules/event-infrastructure.md`
