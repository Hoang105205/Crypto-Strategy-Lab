# Event Infrastructure Dashboard T043 - 2026-08-16

## What worked

- Calling `useDashboardSummary()` once at the page boundary and passing slices into presentational cards keeps REST/socket ownership out of the cards and gives Loop, Queue, and Leaderboard one coherent snapshot.
- Keeping `MultiTimeframeGrid` at the same component position across side-rail rerenders preserves its local timeframe state without modifying completed Market Data code.
- An event-time ref lock plus rendered pending state prevents rapid duplicate Loop commands even before React commits the disabled button state. Every successful command then refetches the backend-authoritative snapshot.
- Rendering retained data whenever it exists, while layering stale/error text and timestamps over it, avoids blanking useful operational state during disconnects or refresh failures.
- Taking the first five Leaderboard entries with `slice(0, 5)` preserves backend rank/order and avoids leaking ranking business logic into the frontend.
- Explicit semantic roles, accessible names, numeric typography, and `focus-visible` styles made the component contracts testable without relying on color or jsdom layout measurements.

## Adjustment made during implementation

- The initial GREEN run passed 9/11 tests. Native `<progress max>` did not expose the explicit `aria-valuemax` required by the contract, so the component now provides `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` directly.
- The first Dashboard DOM order placed the page PairSelector before chart timeframe selectors inside the Market Data region. Moving the page-level header outside that semantic region keeps the visual grid intact and makes the region accurately own only the chart controls/content.
- The sandboxed build could not download Google Fonts. Re-running the unchanged build with approved network access compiled successfully and generated all static routes.

## Reusable lesson

Realtime dashboards stay predictable when data acquisition has one owner and cards remain prop-driven. Preserve stateful domain widgets by keeping their React identity stable, use backend refetch after commands as convergence rather than predicting state locally, and treat stale/error presentation as an overlay on last-success data instead of a replacement for it.

## KB updates needed

- [ ] No KB update is required; the implementation follows the existing Dashboard, Shared UI States, Responsive Rules, REST, and realtime contracts without adding an architectural decision.
