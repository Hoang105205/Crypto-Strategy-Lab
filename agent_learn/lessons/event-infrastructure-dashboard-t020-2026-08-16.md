# Lessons: Event Infrastructure Dashboard T020 — 2026-08-16

## What Worked

- Unique BullMQ queue names plus queue-scoped `obliterate` made Redis integration deterministic without `FLUSHDB` or shared-key damage.
- Barriers and polling around authoritative BullMQ state proved priority, exact peak concurrency, graceful shutdown, retry delays, and retention without blind sleeps.
- Short lock/stalled intervals on fixture-only BullMQ workers produced a real stalled recovery while keeping production lock policy unchanged.
- Separating producer outage from worker transport recovery demonstrated the intended fail-fast versus persistent connection policies without stopping shared Redis.
- Running the production processor against approved port fakes exercised infrastructure behavior without live Binance, sentiment, or Strategy implementations.

## What Didn't Work

- Unit fixtures hid that Redis JSON turns request `Date` objects into ISO strings; the production worker initially passed strings into the Market Data port.
- Terminal PostgreSQL mirroring and Events did not initially mark the BullMQ job metadata as dead-lettered, so status/manual retry remained inconsistent.
- Calling `ioredis.disconnect(true)` is a manual close, not a realistic transient network fault; destroying the isolated socket correctly exercised `retryStrategy` and emitted `reconnecting`/`ready`.
- A broad source audit initially treated the composition-root `StrategyRuntimeModule` import as a forbidden implementation import; the correct boundary audit targets processor imports and Strategy-owned Prisma table access.

## Deviations from Plan

- T020 made two minimal production corrections discovered by executable integration tests: Redis date rehydration and terminal BullMQ metadata marking.
- Restart evidence reconstructs Nest-owned queue/worker resources while Redis stays running; no Redis process restart is claimed.
- Workspace Compose does not explicitly enable AOF, so no AOF claim was made. That operational delivery remains T049.

## KB Updates Needed

- [ ] T049: make Docker Compose Redis AOF/healthcheck configuration match ADR-0013 and the module KB, then document the exact restart fixture and result.
