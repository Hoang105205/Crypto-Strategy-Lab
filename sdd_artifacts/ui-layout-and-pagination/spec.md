# Feature Specification: UI Layout and Pagination

**Feature**: `ui-layout-and-pagination`
**Created**: 2026-08-19
**Status**: Draft
**Input**: User description: "Bây giờ, phần UI tôi muốn là biểu đồ bên trái, bảng lệnh trades bên phải ở backtest runner. Tất nhiên là sẽ có dùng pagination của phần bảng lệnh trades nữa, client-side pagination. Tương tự với lại trong phần Catalog, các strategy cũng nên có phần pagination để di chuyển qua lại thay vì để kéo dài xuống UI như vậy."

## User Scenarios & Testing

### User Story 1 - Backtest Runner Split Layout (Priority: P1)

As a trader analyzing a backtest result, I want to see the equity curve chart on the left and the detailed trades table on the right side by side (on desktop), so that I can easily correlate price action with specific trade entries and exits without scrolling up and down.

**Why this priority**: Enhances analytical workflow and conforms to standard trading platform UX patterns (Binance Design).
**Independent Test**: Load a backtest result on a desktop viewport (>1024px). The chart should occupy the left portion (e.g., 7 or 8 columns) and the trades table should occupy the right portion (e.g., 5 or 4 columns). On mobile, they should stack vertically.

**Acceptance Scenarios**:
1. **Given** a successful backtest result on desktop, **When** the UI renders, **Then** the Equity Curve chart is on the left and the Trade Table is on the right.
2. **Given** a successful backtest result on mobile, **When** the UI renders, **Then** the chart is above the Trade Table.

---

### User Story 2 - Trades Table Client-Side Pagination (Priority: P1)

As a user viewing hundreds of trades from a backtest, I want the trades table to be paginated (e.g., 10 or 20 rows per page) with Next/Previous controls, so that the UI remains performant and I don't have to scroll through an infinitely long list.

**Why this priority**: Improves frontend performance and prevents UI lag when rendering thousands of DOM nodes.
**Independent Test**: Run a backtest that generates >50 trades. The table should only display the first page of trades. Clicking "Next" should display the next set without reloading the page.

**Acceptance Scenarios**:
1. **Given** a backtest with 100 trades, **When** viewing the table, **Then** only the first N trades are visible.
2. **Given** the first page of trades, **When** I click "Next", **Then** the next N trades replace the current view instantly (client-side).

---

### User Story 3 - Strategy Catalog Pagination (Priority: P2)

As a user browsing the strategy catalog, I want the list of available strategies to be paginated, so that the page doesn't stretch excessively as the number of strategies grows.

**Why this priority**: Ensures scalable UI as users create more composite strategies.
**Independent Test**: Navigate to the Strategy Builder tab. If there are >10 strategies, they should be divided into pages with navigation controls.

**Acceptance Scenarios**:
1. **Given** 15 strategies in the catalog, **When** the pagination size is 10, **Then** the first page shows 10 strategies and page 2 shows 5.
2. **Given** page 1, **When** I click page 2, **Then** the UI updates to show the remaining strategies.

---

### Edge Cases
- What happens when a backtest returns 0 trades? (Show empty state, hide pagination).
- How does the layout handle very narrow desktop windows (e.g., tablet landscape)? (Gracefully wrap or adjust grid span).

## Requirements

### Functional Requirements
- **FR-001**: System MUST split the Backtest Result view into a two-column layout on large screens.
- **FR-002**: System MUST implement client-side pagination for the `TradeTable` component.
- **FR-003**: System MUST implement client-side pagination for the `StrategyCard` grid in the Catalog view.

### Key Entities
- **Backtest Result View**: The UI section displaying the Chart and Table.
- **Pagination Component**: Reusable UI component with Prev/Next buttons and page numbers.

## Success Criteria
- **SC-001**: `TradeTable` renders only the current page's slice of the array.
- **SC-002**: Backtest layout does not require vertical scrolling to see the start of the trades table alongside the chart on 1080p screens.
- **SC-003**: Catalog strategy list uses a paginated grid.

## Assumptions
- Backtest trades array is fetched entirely at once (no server-side pagination for MVP), making client-side pagination feasible.
- Strategy list is also fetched entirely at once.

## KB Cross-References
- **Modules affected**: Strategy Engine Frontend (`workspace/apps/frontend/src/app/strategy/page.tsx`).
- **E2E flows affected**: Strategy Backtest.
- **Architecture constraints**: Next.js App Router (Client Components).
- **Constitution gates**: Strict adherence to `DESIGN.md` (Binance Yellow CTAs, dark canvas, hairline borders).
- **Glossary terms**: Strategy, Backtest, Trades.
