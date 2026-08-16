# Lessons: Event Infrastructure Dashboard T016 — 2026-08-16

## What Worked

- Injecting only shared domain tokens kept the Queue processor independent from Strategy implementations and Prisma.
- Strategy-owned create-once persistence by producer `jobId` made duplicate result writes safe.
- A per-job in-flight Promise coalesced overlapping stalled deliveries in the current in-process worker topology.
- Publishing terminal Events only when the durable DLQ mirror reports `created=true` prevented duplicate terminal effects.
- Stable worker failure codes kept raw dependency errors and connection details out of Events.

## What Didn't Work

- The original Redis test read `attemptsMade` from a stale BullMQ `Job` object; authoritative assertions must reload the job from Redis.
- A real 1s + 4s retry scenario cannot fit reliably inside Jest's default five-second timeout.

## Deviations from Plan

- T016 implements the processor only. Nest/BullMQ lifecycle wiring remains T019, and the concrete durable DLQ repository remains T017.
- Evaluator percentage-style win rates in `(1,100]` are normalized to `[0,1]` before persistence and publication.

## KB Updates Needed

- [ ] None; active worker, Event, retry, and module-boundary contracts already describe the implemented behavior.
