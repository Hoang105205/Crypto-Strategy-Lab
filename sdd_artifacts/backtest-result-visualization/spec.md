# Feature Specification: backtest-result-visualization

**Feature**: `backtest-result-visualization`
**Created**: 2026-08-19
**Status**: Draft
**Input**: User description: "Add userId filtering to Strategy Engine controllers using @CurrentUser(). Extend Backtester output with stopLoss, takeProfit, transactionCost, slippage, and volumeUsd. Integrate the EquityCurveChart and Trade Detail table on the frontend to visualize the backtest result data."

## User Scenarios & Testing

### User Story 1 - Private Strategy & Backtest Scoping (Priority: P1)

As a logged-in user, I want my created strategies and backtests to be securely isolated, so that other users cannot see or modify my private trading parameters.

**Why this priority**: Required for multi-tenant scalability (Auth integration).
**Independent Test**: Log in as User A, create a strategy. Log in as User B, verify User A's strategy is not visible.

**Acceptance Scenarios**:
1. **Given** a REST request to `GET /api/strategies`, **When** the controller handles it, **Then** it returns only strategies where `userId IS NULL` (system) or `userId = request.user.id`.
2. **Given** a REST request to `GET /api/strategies/backtest/:id`, **When** User B requests User A's backtest, **Then** the system returns 404 Not Found.

---

### User Story 2 - Comprehensive Trade Metrics (Priority: P1)

As a trader analyzing a backtest, I want to see detailed execution costs (slippage, transaction costs) and risk management parameters (Stop Loss, Take Profit), so that I can evaluate the realistic performance of my strategy.

**Why this priority**: Enhances the domain fidelity of the backtesting engine.
**Independent Test**: Run a backtest with a non-zero commission and slippage config, check the resulting trades array for populated values.

**Acceptance Scenarios**:
1. **Given** a backtest configuration with 0.1% commission, **When** a trade is executed, **Then** the `transactionCost` field accurately reflects 0.1% of the `volumeUsd`.
2. **Given** a backtest with a 2% Stop Loss, **When** reviewing the trades, **Then** the `stopLoss` field is populated correctly based on entry price.

---

### User Story 3 - Visual Equity Curve (Priority: P2)

As a user, I want to see an Equity Curve chart for my backtest, so that I can visually understand the growth or drawdown of my portfolio over time.

**Why this priority**: Massive UX improvement for strategy analysis.
**Independent Test**: Perform a backtest, verify the line chart renders without crashing.

**Acceptance Scenarios**:
1. **Given** a completed backtest with 50 trades, **When** viewing the results on the frontend, **Then** an Equity Curve line chart is rendered plotting the cumulative return over time using `lightweight-charts`.

---

## Edge Cases
- What happens if an unauthenticated user calls a public endpoint? (The `@CurrentUser()` decorator returns `null`, so they only see system-level data).
- How does the system handle backtest trades with 0 volume? (transactionCost and slippage should compute to 0, not NaN or Infinity).

## Requirements

### Functional Requirements
- **FR-001**: Strategy Engine REST controllers MUST use `@CurrentUser()` from `SupabaseJwtGuard` to extract the user ID.
- **FR-002**: Prisma queries in Strategy Engine MUST apply the filter `WHERE userId IS NULL OR userId = :currentUserId` when fetching StrategyVersions and BacktestResults.
- **FR-003**: `BacktesterService` MUST compute and output `stopLoss`, `takeProfit`, `transactionCost`, `slippage`, and `volumeUsd` for each `Trade` according to the formulas in `kb/contracts/strategy.yaml`.
- **FR-004**: Frontend `TradeDetailTable` MUST display the newly extended Trade fields.
- **FR-005**: Frontend `EquityCurveChart` MUST be integrated into the Strategy Builder page (and Leaderboard details if applicable) to display the backtest equity progression.

### Key Entities
- **AuthUser**: Extracted from JWT token via `@CurrentUser()` guard.
- **Trade**: Execution record, now enriched with financial fidelity fields.
- **BacktestResult**: Persisted aggregate result, now scoped by `userId`.

## Success Criteria
- **SC-001**: Cross-user data bleed is completely prevented at the controller/query level.
- **SC-002**: The Trade Detail table successfully renders real numerical values for SL, TP, Cost, Slippage, and Volume USD without `undefined` errors.
- **SC-003**: The EquityCurveChart renders correctly using `lightweight-charts` v5.

## Assumptions
- Supabase authentication infrastructure is already in place and `SupabaseJwtGuard` is globally available.
- Reference frontend components (`TradeDetailTable`, `EquityCurveChart`) written by Hoàng are functionally complete and just need wiring.

## KB Cross-References
- **Modules affected**: Strategy Engine, Frontend (Strategy Builder)
- **E2E flows affected**: Flow 1 (Strategy Backtest)
- **Architecture constraints**: Constitution I (Architecture Quality), II (Contract-Driven).
- **Contracts**: `kb/contracts/auth.yaml` and `kb/contracts/strategy.yaml`.
