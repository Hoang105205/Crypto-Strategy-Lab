# Lessons: Event Infrastructure Dashboard T019 — 2026-08-16

## What Worked

- Splitting Strategy runtime providers into `StrategyRuntimeModule` allowed `QueueModule` to consume Strategy-owned ports while `StrategyModule` consumed the exported `IJOB_QUEUE`, without a module cycle.
- `useExisting` placed exactly one `BullMqJobQueue` instance behind the centralized `IJOB_QUEUE` token and removed the active legacy string token.
- Separate producer and worker Redis owners kept HTTP enqueue fail-fast while the in-process worker remained persistent through producer-side outage.
- Idempotent Nest lifecycle hooks closed BullMQ resources before their externally owned Redis clients; the module suite passed with Jest open-handle detection.
- A controlled enqueue promise proved that the USER producer publishes `BacktestRequested` only after Redis acceptance and publishes nothing on rejection.

## What Didn't Work

- The first static audit scanned every production provider for `forwardRef` and caught an unrelated pre-existing Market Data provider reference. The relevant rule is that `QueueModule` and `StrategyModule` must not use `forwardRef` to hide their module dependency direction.

## Deviations from Plan

- No SEARCH_LOOP producer exists in the current Phase 4 skeleton, so T019 did not invent one. `QueueModule` exports `IJOB_QUEUE` as the future producer seam.
- Redis failure evidence disconnects the producer connection after a successful module boot, then verifies stable `QUEUE_UNAVAILABLE` while the independently owned worker remains running.

## KB Updates Needed

- [ ] None; the BullMQ topology, split connection policy, and public token seam already match ADR-0013 and the feature contracts.
