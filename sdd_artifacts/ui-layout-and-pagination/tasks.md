# SDD Tasks: UI Layout and Pagination

## Phase 1: Backtest Runner Layout Split
- [x] T01: Refactor the Backtest Results layout in `workspace/apps/frontend/src/app/strategy/page.tsx` to use a side-by-side grid (`md:grid md:grid-cols-12`).
- [x] T02: Assign the `EquityCurveChart` to the left column (`col-span-8`).
- [x] T03: Assign the Trade Table to the right column (`col-span-4`).

## Phase 2: Trade Table Pagination
- [x] T04: Add `tradePage` state to manage current page.
- [x] T05: Slice `tradeResults` before rendering the table rows.
- [x] T06: Add pagination controls (Prev/Next buttons) below the Trade Table.

## Phase 3: Strategy Catalog Pagination
- [x] T07: Add `strategyPage` state to manage current page for the Catalog grid.
- [x] T08: Slice the `strategies` array before mapping to `StrategyCard` components.
- [x] T09: Add pagination controls (Prev/Next buttons) below the Strategy grid.

## Phase 4: Pivot - Layout Revert & Search
- [x] T10: Revert Backtest Results back to top-bottom layout in `page.tsx`.
- [x] T11: Add Strategy Catalog search bar with 300ms debounce in `page.tsx`.
- [x] T12: Add Composite Child Strategy search bar with 300ms debounce in `ParameterEditor.tsx`.
- [x] T13: Change App Shell width to 90% in `app-shell.tsx`.
