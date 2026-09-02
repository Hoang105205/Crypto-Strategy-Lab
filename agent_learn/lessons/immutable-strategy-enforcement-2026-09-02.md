# Lessons: immutable-strategy-enforcement — 2026-09-02

## What Worked
- Completely eliminating the DELETE button and `showDelete` logic from [`StrategyCard.tsx`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/frontend/src/components/strategy/StrategyCard.tsx) directly aligns with user expectations, removing any UI confusion regarding strategy deletion.
- Setting `canDelete: false` globally in [`StrategyController.getAllStrategies`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/backend/src/strategy/controllers/strategy.controller.ts) ensures that even if clients parse the response directly, deletion is consistently declared as disallowed.
- Returning an explicit HTTP 403 Forbidden with message referencing `ADR-0008 (Immutable Snapshots)` from `DELETE /api/strategies/:name` provides clear architectural feedback to API clients and automated tests.

## What Didn't Work
- Leaving a conditional `showDelete` button based on `canDelete !== false && !isSystem` caused user confusion because user-created composites showed a DELETE button, but clicking it caused an alert or 403 failure since the backend disallowed deletion. Total removal of the button is the clean, definitive solution.

## Deviations from Plan
- None. All tasks completed in sequence without blockers.

## KB Updates Needed
- [x] Updated [`kb/contracts/strategy.yaml`](file:///d:/DaiHoc/KienTrucPM/kb/contracts/strategy.yaml) to explicitly document the permanent 403 Forbidden status of `DELETE /api/strategies/:name` per ADR-0008.
