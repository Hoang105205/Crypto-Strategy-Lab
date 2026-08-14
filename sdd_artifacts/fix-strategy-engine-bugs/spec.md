# Feature Specification: Fix Strategy Engine Bugs

**Feature**: `fix-strategy-engine-bugs`
**Created**: 2026-08-14
**Status**: Draft
**Input**: User description: "Sửa lỗi StrategyController không sử dụng IJobQueue, xóa local EventBusService và thêm DELETE /api/strategies/:name vào strategy.yaml"

## User Scenarios & Testing

### User Story 1 - Integrate with IJobQueue (Priority: P1)

As the Strategy Engine, I want to submit backtest jobs to the shared `IJobQueue` so that the Job Queue Worker can process them asynchronously.

**Why this priority**: Without this, backtests are never executed and the Event-Driven Architecture is broken.
**Independent Test**: Send a POST request to `/api/strategies/backtest` and verify that the job appears in BullMQ/Redis and the `BacktestRequested` event is emitted on the shared `IEventBus`.

**Acceptance Scenarios**:
1. **Given** a valid backtest request, **When** the StrategyController processes it, **Then** it `await IJobQueue.enqueue()` and only after success, publishes `BacktestRequested` via `IEventBus`.
2. **Given** the Job Queue is down, **When** a backtest is requested, **Then** it returns `503 QUEUE_UNAVAILABLE` and does not publish the event.

---

### User Story 2 - Document API Endpoint (Priority: P2)

As a frontend developer or API consumer, I want the `DELETE /api/strategies/:name` endpoint to be documented in the API contract so that I know it exists and how to use it.

**Why this priority**: Contracts are the Single Source of Truth (SSoT). Undocumented APIs break team trust.
**Independent Test**: Read `kb/contracts/strategy.yaml` and verify the `DELETE` endpoint is present.

**Acceptance Scenarios**:
1. **Given** the `strategy.yaml` file, **When** I read the endpoints section, **Then** I see `DELETE /api/strategies/:name` with its request/response format.

## Requirements

### Functional Requirements
- **FR-001**: System MUST delete the local `apps/backend/src/strategy/events/event-bus.service.ts` file and remove its usage.
- **FR-002**: System MUST inject the shared `IJobQueue` and `IEventBus` into `StrategyController`.
- **FR-003**: System MUST `await this.jobQueue.enqueue()` before calling `this.eventBus.publish()`.
- **FR-004**: System MUST add the `DELETE /api/strategies/:name` endpoint to `kb/contracts/strategy.yaml`.

### Key Entities
- **IJobQueue**: The shared interface for submitting background jobs.
- **IEventBus**: The shared interface for publishing domain events.

## Success Criteria
- **SC-001**: `EventBusService` is completely removed from the `strategy` module.
- **SC-002**: Backtest jobs are successfully pushed to Redis/BullMQ.
- **SC-003**: `kb/contracts/strategy.yaml` contains the `DELETE` endpoint.

## Assumptions
- The shared `IJobQueue` and `IEventBus` interfaces are already implemented and exported from `@crypto-strategy-lab/shared` or the shared module.

## KB Cross-References
- **Modules affected**: Strategy Engine (Huy)
- **E2E flows affected**: Strategy Backtest (`kb/flows/strategy-backtest.md`)
- **Architecture constraints**: Event-Driven Communication (ADR-005)
- **Constitution gates**: Module Boundaries (must use shared interfaces)
- **Glossary terms**: Backtest, Job Queue, Event Bus
