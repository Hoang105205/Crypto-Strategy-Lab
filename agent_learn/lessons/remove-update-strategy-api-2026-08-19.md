# Lessons: remove-update-strategy-api — 2026-08-19

## What Worked
- Replacing the "Update" action in the UI with a "Save as New" semantic cleanly enforces the Strategy Versioning principle without complex backend logic.
- Splitting the logic in `handleParametersUpdate` into a branch for Composite (which posts a new one) and Base (which just updates local state) keeps the Backtest payload decoupled from backend state for Base strategies.

## What Didn't Work
- Attempting to manually update the frontend `strategies` array with an in-place map function for Composite strategies was causing the UI to show an overwritten state before the server fetched the new list.

## Deviations from Plan
- Discovered that the Backend API actually NEVER had a `PUT` or `PATCH` endpoint, so T001 and T002 were inherently satisfied. 

## KB Updates Needed
*(No KB updates required as this aligns with the existing Constitution and ADR-0008)*
