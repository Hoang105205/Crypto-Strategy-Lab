# Feature Specification: Strategy Registry Plugin System

**Feature**: `strategy-registry`
**Created**: 2026-08-11
**Status**: Draft
**Input**: User description: "Hoàn thiện Strategy Registry (Plugin System) dựa trên code hiện có, bổ sung hàm analyze() và thêm cơ chế quăng lỗi khi register() trùng tên chiến lược"

## User Scenarios & Testing

### User Story 1 - Register Strategy Plugin Safely (Priority: P1)

As a developer or module integrator, I want to register a strategy implementation into the central `StrategyRegistry` so that it can be looked up and executed uniformly without modifying existing registry or execution code, while ensuring duplicate registrations fail explicitly.

**Why this priority**: Core Open-Closed Principle requirement (ADR-0003). Duplicate strategy registrations can corrupt execution routing and lead to unexpected signal behaviors.
**Independent Test**: Register a strategy instance, verify registration succeeds; attempt to register another strategy instance with identical key or name, verify an Error is thrown.

**Acceptance Scenarios**:
1. **Given** an empty or existing `StrategyRegistry`, **When** a valid strategy instance implementing `IStrategy` is registered via `register()`, **Then** the strategy is stored and retrievable by name and key (`type:name`).
2. **Given** a strategy already registered with key `MA:MA-Default` or name `MA-Default`, **When** another strategy instance with the same name or key is registered via `register()`, **Then** the registry MUST throw an Error indicating strategy name/key collision.

---

### User Story 2 - Analyze Market Candles via Registry Delegation (Priority: P1)

As a backtest worker or signal analyzer, I want to call `analyze(name, candles)` on the `StrategyRegistry` so that I can delegate signal analysis to the registered strategy by name without managing concrete strategy references directly.

**Why this priority**: Required for uniform strategy analysis pipeline as defined in ADR-0003 and Strategy Engine module architecture.
**Independent Test**: Register a strategy, pass candle data to `registry.analyze("MA-Default", candles)`, verify it delegates to the strategy and returns the generated `ISignal`.

**Acceptance Scenarios**:
1. **Given** a registered strategy named "MA-Default", **When** `registry.analyze("MA-Default", candles)` is invoked, **Then** the registry retrieves "MA-Default", calls its `analyze(candles)` method, and returns the resulting `ISignal`.
2. **Given** no strategy is registered under "NonExistentStrategy", **When** `registry.analyze("NonExistentStrategy", candles)` is invoked, **Then** the registry MUST throw an Error indicating that the requested strategy was not found.

---

### Edge Cases
- What happens when a strategy returns invalid signal data? The registry passes through the signal or relies on strategy-level validation.
- What happens when `register()` is passed an invalid/null strategy object? The registry validates non-null input before registering.

## Requirements

### Functional Requirements
- **FR-001**: System MUST provide a `StrategyRegistry` service capable of storing and retrieving `IStrategy` implementations by name and by composite key (`type:name`).
- **FR-002**: System MUST throw an explicit Error when `register()` is called with a strategy whose name or composite key already exists in the registry.
- **FR-003**: System MUST expose an `analyze(nameOrType: string, candles: ICandle[]): ISignal` method that retrieves the matching strategy and delegates candle analysis to it.
- **FR-004**: System MUST throw an explicit Error when `analyze()` or `get()` is called for a strategy name/key that has not been registered when strict retrieval is expected.
- **FR-005**: System MUST provide a `getAll(): IStrategy[]` method returning a deduplicated list of all currently registered unique strategy instances.

### Key Entities
- **StrategyRegistry**: Central registry service managing registered `IStrategy` plugin instances.
- **IStrategy**: Interface implemented by all strategy plugins (exposing `getName()`, `getType()`, `analyze()`, `getParameters()`).
- **ISignal**: Signal entity produced by strategy analysis (BUY, SELL, HOLD).

## Success Criteria
- **SC-001**: 100% of valid strategy plugins registered can be retrieved and executed via `StrategyRegistry`.
- **SC-002**: Duplicate strategy registration attempts consistently throw a descriptive Error, satisfying ADR-0003 collision mitigation.
- **SC-003**: `registry.analyze(name, candles)` correctly delegates execution to the strategy instance and returns the generated signal.

## Assumptions
- Strategy implementations adhere strictly to the shared `IStrategy` contract from `@crypto-strategy-lab/shared`.
- `StrategyRegistry` is registered as a NestJS `@Injectable()` singleton provider within `StrategyModule`.

## KB Cross-References
- **Modules affected**: `kb/modules/strategy-engine.md`
- **E2E flows affected**: `kb/flows/strategy-backtest.md`, `kb/flows/composite-with-sentiment.md`
- **Architecture constraints**: Modular Monolith, Open-Closed Principle (ADR-0003)
- **Constitution gates**: Extension points must be demonstrable (CONSTITUTION.md §III)
- **Glossary terms**: Strategy Registry, Open-Closed Principle (OCP)
