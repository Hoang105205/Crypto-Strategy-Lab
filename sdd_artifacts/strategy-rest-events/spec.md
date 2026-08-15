# Feature Specification: Strategy REST API & Event Bus Integration

**Feature**: `strategy-rest-events`
**Created**: 2026-08-12
**Status**: Draft
**Input**: User description: "Triển khai StrategyController với các REST endpoints GET/POST và phát sự kiện BacktestRequested"

## User Scenarios & Testing

### User Story 1 - List Available Strategies (Priority: P1)

As a frontend application or API client, I want to query `GET /api/strategies` to retrieve all registered single and composite strategies so that users can select them in the Strategy Builder UI.

**Why this priority**: Required for populating UI dropdowns and strategy cards.
**Independent Test**: Send `GET /api/strategies`. Verify HTTP 200 response returning an array of registered strategy metadata objects (name, type, parameters).

**Acceptance Scenarios**:
1. **Given** a set of registered strategies in `StrategyRegistry`, **When** `GET /api/strategies` is called, **Then** return HTTP 200 with list of strategies.

---

### User Story 2 - Create Composite Strategy Endpoint (Priority: P1)

As a trader, I want to call `POST /api/strategies/composite` to dynamically create a composite strategy from selected child strategies and a combiner.

**Why this priority**: Enables users to build custom multi-indicator strategy ensembles via API.
**Independent Test**: Send `POST /api/strategies/composite` with payload `{ name: "MyComposite", childStrategyNames: ["MovingAverage", "RelativeStrengthIndex"], combinerType: "MajorityVote" }`. Verify HTTP 201 response and registration in `StrategyRegistry`.

**Acceptance Scenarios**:
1. **Given** valid DTO payload, **When** `POST /api/strategies/composite` is called, **Then** instantiate `CompositeStrategy`, register in `StrategyRegistry`, create a `StrategyVersion` snapshot, and return HTTP 201.
2. **Given** invalid child strategy name, **When** called, **Then** return HTTP 400 Bad Request with descriptive error.

---

### User Story 3 - Request Backtest & Emit Event (Priority: P1)

As a user or client app, I want to call `POST /api/strategies/backtest` to submit a backtest request, which persists an immutable `StrategyVersion` and emits a `BacktestRequested` event for asynchronous processing.

**Why this priority**: Core integration bridge connecting Strategy Engine to Event Bus and Job Queue.
**Independent Test**: Send `POST /api/strategies/backtest` with `{ strategyName: "MovingAverage", pair: "BTCUSDT", timeframe: "1h", startDate, endDate }`. Verify event `BacktestRequested` is emitted with payload and HTTP 202 Accepted response contains `jobId` and `strategyVersionId`.

**Acceptance Scenarios**:
1. **Given** valid backtest DTO payload, **When** `POST /api/strategies/backtest` is called, **Then** create `StrategyVersion`, emit `BacktestRequested` event via EventEmitter, and return HTTP 202 Accepted.

## Requirements

### Functional Requirements
- **FR-001**: System MUST implement `StrategyController` decorated with NestJS `@Controller('api/strategies')`.
- **FR-002**: System MUST implement `GET /api/strategies` returning all deduplicated registered strategies.
- **FR-003**: System MUST implement `POST /api/strategies/composite` creating and registering a `CompositeStrategy`.
- **FR-004**: System MUST implement `POST /api/strategies/backtest` emitting the `BacktestRequested` event.
- **FR-005**: System MUST validate incoming DTOs (`CreateCompositeDto`, `RequestBacktestDto`).

### Key Entities & Contracts
- **Endpoints**: `GET /api/strategies`, `POST /api/strategies/composite`, `POST /api/strategies/backtest`.
- **Event**: `BacktestRequested` (`jobId`, `strategyVersionId`, `pair`, `timeframe`, `startDate`, `endDate`, `initialCapital`).
- **DTOs**: `CreateCompositeDto`, `RequestBacktestDto`.

## Success Criteria
- **SC-001**: Endpoints return correct HTTP status codes (200, 201, 202, 400).
- **SC-002**: `BacktestRequested` event is emitted with complete payload when backtest is requested.
- **SC-003**: Unit tests mock service calls and verify controller routes and event emission.

## KB Cross-References
- **Contracts**: `kb/contracts/strategy.yaml`
- **Flows**: `kb/flows/strategy-backtest.md`
