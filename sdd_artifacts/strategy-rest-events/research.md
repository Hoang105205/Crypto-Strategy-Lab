# Research & Design Decisions: Strategy REST API & Event Bus

## 1. REST Endpoints Routing
- `@Controller('api/strategies')`
- `GET /`: Retrieves all registered strategy summaries from `StrategyRegistry`.
- `POST /composite`: Receives `CreateCompositeDto`, verifies child strategy existence, instantiates `CompositeStrategy`, registers in `StrategyRegistry`, saves a `StrategyVersion`, and returns HTTP 201.
- `POST /backtest`: Receives `RequestBacktestDto`, creates `StrategyVersion`, generates `jobId`, emits `BacktestRequestedEvent`, and returns HTTP 202 Accepted `{ jobId, strategyVersionId }`.

## 2. Event Bus Design
- Create lightweight `EventBusService` in `apps/backend/src/strategy/events/` that wraps NestJS event emission or in-memory Subject.
- Event `BacktestRequested`:
  ```typescript
  export class BacktestRequestedEvent {
    jobId: string;
    strategyVersionId: string;
    pair: string;
    timeframe: string;
    startDate: Date;
    endDate: Date;
    initialCapital: number;
    executedAt: Date;
  }
  ```
