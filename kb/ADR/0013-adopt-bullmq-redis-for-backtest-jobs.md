# ADR-0013: Adopt BullMQ with Redis for Backtest Jobs

## Status
Accepted

## Delivery Status
This ADR defines the accepted target architecture. Source-code and Compose delivery are tracked by
`sdd_artifacts/event-infrastructure-dashboard/tasks.md`; accepting this ADR does not claim those
implementation tasks are already complete.

## Context
The first Event Infrastructure plan used an in-memory queue to demonstrate the Job Queue/Worker
pattern quickly. That queue loses waiting and active state when the NestJS process restarts and
cannot coordinate more than one backend process. The project now requires the documented
BullMQ/Redis upgrade to be part of the required delivery architecture rather than a future
migration path.

The existing `IJobQueue`, `JobRequest`, and typed Event contracts already isolate business flows
from the queue implementation. This lets the project replace the queue backend without changing
the Strategy Engine, Loop Controller, Leaderboard, Dashboard, or public REST payloads.

## Decision Drivers
- Waiting and delayed-retry jobs must survive a backend restart.
- Queue state, priority, retry, concurrency, and inspection must use a proven implementation.
- `source=USER` jobs must be processed before `source=SEARCH_LOOP` jobs, with FIFO ordering inside
  the same priority.
- The queue must retain the producer-generated UUID as the BullMQ `jobId` for deduplication and
  end-to-end tracing.
- Local setup must remain reproducible through Docker Compose.
- The modular-monolith boundary and current in-process typed Event Bus must remain intact.

## Considered Options
1. Keep the custom in-memory queue permanently.
2. Replace it with RabbitMQ.
3. Replace it with Kafka.
4. Adopt BullMQ backed by Redis.

## Decision Outcome
Chosen option: **BullMQ backed by Redis**.

`BullMqJobQueue` implements `IJobQueue` and owns a BullMQ queue named `backtest`. A producer-supplied
`jobId` is passed as BullMQ's custom `jobId`; a duplicate enqueue is reported as a conflict rather
than silently treated as a new job. Jobs use priority `1` for `USER` and `10` for `SEARCH_LOOP`;
equal-priority jobs remain FIFO. The default worker concurrency is `3` and is configured through
`BACKTEST_WORKER_CONCURRENCY`.

Request producers call and await `IJobQueue.enqueue()` directly. They return `202 Accepted` only
after BullMQ confirms the job is stored in Redis. After successful enqueue, the producer publishes
`BacktestRequested` as an observational notification using the same `jobId` and `correlationId`;
the queue does not subscribe to that Event. This separates an acknowledged command from a
fire-and-forget Event and prevents false queued responses when Redis is unavailable.

Each job has **three total attempts**. Retryable failures use the existing deterministic schedule:
one second before attempt 2 and four seconds before attempt 3. This is implemented as a custom
BullMQ backoff strategy. Non-retryable failures skip remaining attempts. Terminal failures stay in
BullMQ's failed set for operational inspection and are mirrored to the existing PostgreSQL
`DeadLetterJob` record so the stable REST/Dashboard contract and audit history do not depend on
Redis retention settings. Manual recovery resets the attempt counters and retries the same job.

Completed and failed jobs are retained with bounded count/age policies configured by environment
variables. Redis persistence uses AOF in Docker Compose. Queue-producing HTTP paths fail fast when
Redis is unavailable; workers use persistent reconnect behavior and resume once Redis returns.
Workers close gracefully during application shutdown so active jobs can finish; an ungraceful
shutdown relies on BullMQ's stalled-job recovery and the worker processor remains idempotent.

For this delivery, BullMQ workers run inside the NestJS backend process. This provides a durable
Redis-backed queue without changing the in-process `IEventBus` implementation. Moving workers to
separate processes is a later topology change and requires a cross-process `IEventBus` adapter
before domain events such as `BacktestCompleted` can reach Leaderboard and Loop subscribers.

## Consequences
- Positive: waiting, prioritized, retry-delayed, completed, and failed queue state is stored in
  Redis rather than process memory.
- Positive: retry, priority, concurrency, stalled-job recovery, and queue inspection use BullMQ
  primitives instead of custom scheduling code.
- Positive: business consumers remain unchanged because they depend on `IJobQueue` and typed Event
  contracts.
- Positive: after the SDD tasks are implemented, the upgrade can be demonstrated by restarting
  NestJS while Redis stays up and observing waiting jobs resume.
- Negative: Redis is now a required runtime dependency for backend startup and queue operations.
- Negative: operational correctness depends on Redis persistence, retention, health checks, and
  graceful shutdown configuration.
- Negative: BullMQ provides at-least-once processing behavior around stalls and failures, so result
  persistence and terminal-event publication must remain idempotent.
- Constraint: separate worker processes are not claimed in the current topology because
  EventEmitter2 is process-local.

## Configuration
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_DB`
- `BACKTEST_QUEUE_NAME=backtest`
- `BACKTEST_WORKER_CONCURRENCY=3`
- `BACKTEST_MAX_ATTEMPTS=3`
- `BACKTEST_JOB_RETENTION_AGE_SECONDS`
- `BACKTEST_JOB_RETENTION_COUNT`

## Links
- Supersedes ADR-0012 (In-Memory Queue with BullMQ Migration Path).
- Supersedes ADR-0006 only for the concrete in-memory backend; the Job Queue/Worker decision remains.
- Relates to ADR-0005 (Event-Driven Communication).
- Relates to ADR-0011 (Leaderboard as Observer).
