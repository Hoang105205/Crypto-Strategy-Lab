# Feature Specification: Strategy Builder Frontend & UI Components

**Feature**: `strategy-frontend-builder`
**Created**: 2026-08-12
**Status**: Draft
**Input**: User description: "Triển khai giao diện Strategy Builder page và các UI components: StrategyCard, ParameterEditor, CompositeBuilder, TradeTable"

## User Scenarios & Testing

### User Story 1 - Strategy Display & Selection (Priority: P1)

As a trader, I want to view all available single and composite trading strategies formatted cleanly as cards (`StrategyCard`) so that I can inspect their parameters and select them for backtesting.

**Why this priority**: Core UI element for strategy discovery.
**Independent Test**: Render `StrategyCard` with mock strategy data. Verify title, type badge, parameter tags, and "Select Strategy" button display correctly adhering to `kb/DESIGN.md` dark theme.

**Acceptance Scenarios**:
1. **Given** strategy metadata, **When** `StrategyCard` renders, **Then** display strategy name, type badge (MA/RSI/Bollinger/SR/Composite), parameters list, and click action handlers.

---

### User Story 2 - Parameter Editing Form (Priority: P1)

As a trader, I want a `ParameterEditor` component so that I can dynamically edit parameters (such as MA period, RSI thresholds, or Bollinger standard deviation) before running backtests.

**Why this priority**: Customizing indicator parameters is essential for strategy optimization.
**Independent Test**: Change MA period input from 14 to 20 in `ParameterEditor`. Verify `onChange` callback triggers with updated parameter object `{ period: 20 }`.

**Acceptance Scenarios**:
1. **Given** a strategy parameter object, **When** inputs are changed, **Then** trigger `onChange` callback with typed numerical/text values.

---

### User Story 3 - Composite Strategy Builder (Priority: P1)

As a trader, I want a `CompositeBuilder` component so that I can select multiple child strategies, configure their weights or combiner type (MajorityVote vs WeightedScore), and submit a request to create a composite strategy.

**Why this priority**: Enables multi-strategy ensemble creation directly from the UI.
**Independent Test**: Select "MovingAverage" and "RelativeStrengthIndex", choose "WeightedScore", set weights (1.5, 1.0), and click "Build Composite". Verify `onBuildComposite` is triggered with the complete payload.

**Acceptance Scenarios**:
1. **Given** child strategy selection, **When** "Build Composite" is submitted, **Then** validate input and invoke composite creation API callback.

---

### User Story 4 - Trade Execution Results Table (Priority: P2)

As a trader, I want a `TradeTable` component to view the execution details (Entry/Exit date & price, side LONG/SHORT, PnL %, quantity) after a backtest finishes.

**Why this priority**: Visualizing individual trade logs is critical for analyzing backtest performance.
**Independent Test**: Pass an array of mock `Trade` objects. Verify green text formatting for positive PnL (`#0ecb81`), red for negative PnL (`#f6465d`), and correct date/currency formatting.

**Acceptance Scenarios**:
1. **Given** trade results array, **When** `TradeTable` renders, **Then** display formatted tabular rows with color-coded profit/loss indicators.

---

### User Story 5 - Strategy Builder Page Integration (Priority: P1)

As a user, I want a unified `Strategy Builder` page (`app/strategy/page.tsx`) integrating the header, strategy catalog, composite builder, parameter editor, backtest configuration form, and trade results table.

**Why this priority**: Primary fullstack entry point for Member B's module.
**Independent Test**: Navigate to `/strategy`. Verify page fetches strategies from backend REST API, allows parameter customization, submits backtests, and displays trade results.

**Acceptance Scenarios**:
1. **Given** `/strategy` route, **When** loaded, **Then** fetch `GET /api/strategies`, render strategy cards, and handle backtest submissions seamlessly.

## Requirements

### Functional Requirements
- **FR-001**: System MUST implement `StrategyCard` component.
- **FR-002**: System MUST implement `ParameterEditor` component.
- **FR-003**: System MUST implement `CompositeBuilder` component.
- **FR-004**: System MUST implement `TradeTable` component.
- **FR-005**: System MUST implement Next.js page `app/strategy/page.tsx` integrating all components and API calls.
- **FR-006**: All UI elements MUST strictly adhere to `kb/DESIGN.md` dark mode color tokens.

## Success Criteria
- **SC-001**: Page compiles cleanly in Next.js frontend without React or TypeScript errors.
- **SC-002**: Interactive state management allows creating composites and executing backtests smoothly.
- **SC-003**: Trade table formats currency and profit/loss colors correctly.

## KB Cross-References
- **Design System**: `kb/DESIGN.md`
- **Module Architecture**: `kb/modules/strategy-engine.md`
