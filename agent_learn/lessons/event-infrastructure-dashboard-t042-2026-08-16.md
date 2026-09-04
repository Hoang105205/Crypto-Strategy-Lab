# Event Infrastructure Dashboard T042 - 2026-08-16

## What worked

- Runtime-loaded production modules let all four RED suites collect independently before T043 exists, so each failure points to its intended missing component rather than stopping at transform time.
- A slot-based `DashboardGrid` contract makes Market Data ownership explicit: side-rail realtime updates must not remount the existing chart grid or reset its selected timeframe.
- Rendering the real `MultiTimeframeGrid`, `PairSelector`, and `StatusIndicator` while mocking only their external/heavy boundaries verifies composition without erasing their public behavior.
- DOM structure, semantic regions, and responsive utility classes are reliable jsdom contracts for the 8/4 desktop layout and mobile stack; pixel measurement is not.
- Deferred action promises make pending-state and double-click protection executable instead of merely checking a static disabled prop.
- Stale-state tests rerender last-success data alongside provider failures and realtime changes, proving that status presentation is independent from retained domain data.

## Adjustment made during implementation

- Loading-layout assertions initially tried to combine `toHaveStyle` with an asymmetric matcher. Reading the rendered `minHeight` style directly avoids a matcher-shape ambiguity while retaining the dimension-preservation contract.
- Focus accessibility was strengthened by requiring `focus-visible` styling on interactive controls and links in addition to accessible roles and names.

## Reusable lesson

For RED-first UI work, define contracts at stable public boundaries: semantic content, user actions, route targets, breakpoint classes, and preservation of child state across rerenders. Mock transport and expensive rendering boundaries only; over-mocking existing components can produce a green test that says nothing about real composition.

## KB updates needed

- [ ] No KB update is required; the tests implement the existing Dashboard, Shared UI States, Responsive Rules, and active REST/realtime contracts without introducing a new architectural decision.
