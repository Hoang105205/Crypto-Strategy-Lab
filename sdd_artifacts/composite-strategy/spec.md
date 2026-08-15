# Feature Specification: Composite Strategy & Combiners

**Feature**: `composite-strategy`
**Created**: 2026-08-12
**Status**: Draft
**Input**: User description: "Triển khai Composite Strategy kế thừa IStrategy và 2 bộ tổng hợp tín hiệu (MajorityVoteCombiner, WeightedScoreCombiner) tuân thủ ICombiner"

## User Scenarios & Testing

### User Story 1 - Majority Vote Signal Combiner (Priority: P1)

As a trading system, I want to combine multiple trading signals using majority voting so that a BUY or SELL action is only emitted if the majority of child strategies agree.

**Why this priority**: Simple, intuitive consensus mechanism for ensemble strategy decisions.
**Independent Test**: Pass 3 signals (`BUY`, `BUY`, `HOLD`) to `MajorityVoteCombiner`. Verify it returns `BUY`. Pass (`BUY`, `SELL`, `HOLD`) where there is no clear majority. Verify it returns `HOLD`.

**Acceptance Scenarios**:
1. **Given** a set of signals where one action (BUY or SELL) has a strict majority count over all other actions, **When** combined, **Then** return that majority action with average confidence of the winning signals.
2. **Given** a set of signals with a tie or no strict majority, **When** combined, **Then** return `HOLD` signal with `confidence: 0`.

---

### User Story 2 - Weighted Score Signal Combiner (Priority: P1)

As a trader or strategy builder, I want to assign numerical weights to child strategies so that higher-confidence or historically better-performing strategies have a greater influence on the final combined signal.

**Why this priority**: Enables sophisticated multi-factor strategy weighting.
**Independent Test**: Assign weight 2.0 to Strategy A (BUY, confidence 0.8 -> score +1.6) and weight 1.0 to Strategy B (SELL, confidence 0.9 -> score -0.9). Verify the combined score is positive (> threshold), resulting in a `BUY` signal.

**Acceptance Scenarios**:
1. **Given** weighted strategies, **When** net weighted score exceeds positive threshold (e.g. +0.2), **Then** return `BUY`.
2. **Given** weighted strategies, **When** net weighted score drops below negative threshold (e.g. -0.2), **Then** return `SELL`.
3. **Given** weighted score between [-0.2, 0.2], **When** combined, **Then** return `HOLD`.

---

### User Story 3 - Composite Strategy Implementation (Priority: P1)

As a strategy engine component, I want a `CompositeStrategy` class that implements `IStrategy` and delegates analysis to multiple child strategies using an injected or configured `ICombiner`.

**Why this priority**: Fulfills the Gang of Four (GoF) Composite Pattern requirement and ADR-0008.
**Independent Test**: Instantiate `CompositeStrategy` with MA, RSI, and `MajorityVoteCombiner`. Pass candle data. Verify it executes both strategies' `analyze()` methods and combines their output.

**Acceptance Scenarios**:
1. **Given** a `CompositeStrategy` configured with children [Strategy1, Strategy2] and a Combiner, **When** `analyze(candles)` is called, **Then** execute `analyze()` on all children and return the `combine(signals)` result.
2. **Given** `CompositeStrategy`, **When** `getType()` is called, **Then** return `StrategyType.COMPOSITE`.
3. **Given** `CompositeStrategy`, **When** `getParameters()` is called, **Then** return detailed configuration including child strategy parameters and combiner type.

## Requirements

### Functional Requirements
- **FR-001**: System MUST implement `MajorityVoteCombiner` adhering to `ICombiner`.
- **FR-002**: System MUST implement `WeightedScoreCombiner` adhering to `ICombiner` (accepting a map of strategy weights).
- **FR-003**: System MUST implement `CompositeStrategy` adhering to `IStrategy`.
- **FR-004**: `CompositeStrategy` MUST allow dynamic addition of child `IStrategy` instances and an `ICombiner`.
- **FR-005**: `CompositeStrategy` MUST register itself into `StrategyRegistry` upon NestJS initialization (`OnModuleInit`).
- **FR-006**: All combiners MUST return a valid `Signal` object with proper `action`, `confidence`, and `metadata` explaining the combination decision.

### Key Entities
- **ICombiner**: Shared interface (`combine(signals: Signal[]): Signal`).
- **MajorityVoteCombiner**: Implements majority-based consensus.
- **WeightedScoreCombiner**: Implements weighted numerical scoring logic.
- **CompositeStrategy**: Implements `IStrategy` wrapper combining multiple child strategy outputs.

## Success Criteria
- **SC-001**: All combiner implementations pass unit tests covering majority, tie, weighted buy, weighted sell, and edge cases (empty signals).
- **SC-002**: `CompositeStrategy` successfully executes multiple child strategies and returns combined signals without runtime errors.
- **SC-003**: `CompositeStrategy` can be registered and retrieved from `StrategyRegistry`.

## KB Cross-References
- **Architecture Reference**: ADR-0008 (Composite Strategy & Signal Combiners)
- **Module**: `kb/modules/strategy-engine.md`
- **Shared Contracts**: `libs/shared/src/interfaces/strategy.ts`, `libs/shared/src/types/enums.ts` (`StrategyType.COMPOSITE`, `CombinerType.MAJORITY_VOTE`, `CombinerType.WEIGHTED_SCORE`).
