# Lessons: Event Infrastructure Dashboard T015 — 2026-08-15

## What Worked

- Re-read the Redis job after `Queue.add` and compare an enqueue token so BullMQ's silent custom-ID deduplication becomes an explicit `DUPLICATE_JOB_ID`, including concurrent enqueue races.
- Kept queue state authoritative in BullMQ and projected delayed work as queued while distinguishing a terminal dead-letter marker inside retained failed jobs.
- Used `attemptsStarted` for the contract's current attempt and BullMQ retry reset options for both attempts made and attempts started.
- Proved the adapter and connection teardown against Redis 7 with Jest open-handle detection.

## What Didn't Work

- BullMQ's generic Redis client type does not guarantee a typed `ping()` method. Successful Redis-backed snapshot operations are used as the health proof; failures become `QUEUE_UNAVAILABLE` rather than returning stale counts.

## Deviations from Plan

- None. No Worker, Dead-letter repository, controller, Event subscriber, or in-memory fallback was added.

## KB Updates Needed

- [ ] None; the implementation follows the active queue contract and ADR-0013.
