# Lessons: fix-strategy-engine-bugs — 2026-08-14

## What Worked
- Injecting interfaces using string tokens (`@Inject('IJobQueue')` and `@Inject('IEventBus')`) correctly decoupled the Strategy Engine from the Event Infrastructure module.
- Removing the local RxJS `EventBusService` restored the intended Event-Driven Architecture and Module Boundaries.

## What Didn't Work
- Creating local implementations of shared infrastructure (e.g. `EventBusService` using RxJS) causes event isolation and breaks cross-module communication (like the Job Queue Worker or Leaderboard updates).

## Deviations from Plan
- None.

## KB Updates Needed
- `kb/contracts/strategy.yaml` was successfully updated with the undocumented `DELETE` endpoint. No further KB updates needed.
