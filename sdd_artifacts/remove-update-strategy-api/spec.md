# Feature Specification: Remove Update Strategy API

**Feature**: `remove-update-strategy-api`
**Created**: 2026-08-19
**Status**: Draft
**Input**: User description: "bỏ API update strategy (chỉnh sửa/cập nhật composite strategy)"

## User Scenarios & Testing

### User Story 1 - Immutability Enforcement (Priority: P1)

Users cannot update an existing strategy. If they wish to change parameters or composite weights, they must create a new strategy variant.

**Why this priority**: Enforces the Strategy Versioning principle (immutability), ensuring past backtest results linked to a strategy ID remain historically accurate.
**Independent Test**: Send a `PUT` or `PATCH` request to the strategy endpoint and receive a 404 or 405 Method Not Allowed error.

**Acceptance Scenarios**:
1. **Given** an existing strategy, **When** a user attempts to save changes to it, **Then** the system rejects the operation or forces a "Save as New" flow.

---

## Requirements

### Functional Requirements
- **FR-001**: System MUST NOT expose any API endpoints (`PUT`, `PATCH`) to update an existing strategy.
- **FR-002**: Frontend UI MUST NOT offer a "Save changes" button that updates an existing strategy in-place (must use "Save as New" or equivalent).

### Key Entities
- **Strategy**: Represents a trading algorithm. Once created, its parameters and logic are immutable.

## Success Criteria
- **SC-001**: API returns 404/405 for update requests.
- **SC-002**: Frontend gracefully handles modifications by creating new strategy records rather than mutating existing ones.

## Assumptions
- The `id` of a strategy is strictly tied to its exact parameters/weights.

## KB Cross-References
- **Modules affected**: Strategy Engine
- **E2E flows affected**: strategy-backtest.md (Strategies used in backtests must be immutable)
- **Architecture constraints**: Strategy Versioning
