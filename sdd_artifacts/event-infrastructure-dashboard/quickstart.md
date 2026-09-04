# Quickstart: Event Infrastructure Dashboard

> **Delivery note**: This quickstart describes the accepted BullMQ/Redis target. Run the queue
> scenarios after the implementation and Compose work in `tasks.md` (especially T012-T020 and T049)
> is complete.

## Prerequisites

- Node.js compatible with the workspace and npm 10.x
- Dependencies installed from `workspace/`
- PostgreSQL available when running persistence-backed scenarios
- Redis 7 available with AOF persistence for BullMQ scenarios
- Current Prisma client generated
- Strategy integration providers available for a real backtest; test doubles are used for isolated feature tests

## Setup

From `workspace/`:

```powershell
npm install
npx prisma generate --schema apps/backend/prisma/schema.prisma
npm run build
```

Start infrastructure from the repository root before the backend:

```powershell
docker compose up -d postgres redis
```

Required queue configuration (defaults shown):

```text
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
BACKTEST_QUEUE_NAME=backtest
BACKTEST_WORKER_CONCURRENCY=3
BACKTEST_MAX_ATTEMPTS=3
BACKTEST_JOB_RETENTION_AGE_SECONDS=86400
BACKTEST_JOB_RETENTION_COUNT=1000
```

After Hoàng reviews the migration, apply it in the project's normal development database workflow before persistence-backed validation.

Run applications:

```powershell
npm run dev
```

Run validation:

```powershell
npm run test
npm run lint
npm run build
```

## Validation Scenarios

### Scenario 1: Event subscriber isolation

1. Register two subscribers for one Event; make the first throw.
2. Publish with a known correlation identity.
3. ✅ Expected: the second subscriber receives a complete envelope; publication does not throw; failure log contains the correlation identity.

### Scenario 2: Successful asynchronous backtest

1. Call `IJobQueue.enqueue` with a producer UUID and successful test doubles, await acceptance, then publish observational `BacktestRequested`.
2. Query status immediately and after completion.
3. ✅ Expected: the same UUID moves `QUEUED` → `PROCESSING` → `COMPLETED`; one `BacktestCompleted` is emitted.

### Scenario 3: Retry and dead letter

1. Configure a test Backtester to fail on all executions.
2. Observe the BullMQ job move through the configured 1s and 4s retry delays.
3. ✅ Expected: exactly three attempts, one terminal failure Event, one dead-letter Event, and one inspectable DLQ row.

### Scenario 4: USER priority

1. Occupy all workers, enqueue two Search Loop jobs, then enqueue a manual job.
2. Release one worker.
3. ✅ Expected: the manual job runs next; Search Loop jobs retain their relative FIFO order.

### Scenario 5: Idempotent Leaderboard

1. Deliver the same valid `BacktestCompleted` twice.
2. Query the Leaderboard.
3. ✅ Expected: one entry and one ranking broadcast; score and rank are deterministic.

### Scenario 5a: Redis-backed restart recovery

1. Enqueue waiting and delayed backtest jobs.
2. Stop and restart NestJS without stopping Redis.
3. ✅ Expected: the same BullMQ `jobId` values remain and processing resumes; no job is resubmitted by the client.

### Scenario 5b: Redis outage and graceful shutdown

1. Stop Redis and submit a backtest; then restore Redis.
2. Send a shutdown signal while a worker is active.
3. ✅ Expected: enqueue fails with `QUEUE_UNAVAILABLE` rather than a false `202`; workers reconnect after Redis returns; graceful shutdown stops intake and closes connections cleanly.

### Scenario 6: Bounded Search Loop

1. Start a Loop with `maxCandidates=5` and successful fakes.
2. Observe progress until terminal state.
3. ✅ Expected: exactly five terminal candidate rows, no sixth request, and final reason `max_candidates_reached`.

### Scenario 7: Pause and in-flight completion

1. Pause while one candidate is processing.
2. Deliver its completion.
3. ✅ Expected: result is recorded, no successor is generated, and resume continues the same run.

### Scenario 8: Dashboard reconnect

1. Load Dashboard/Leaderboard snapshots, disconnect infrastructure socket, and create a newer ranking.
2. Reconnect.
3. ✅ Expected: last data remains visible while stale; snapshot resync catches up; sort and selected Strategy remain intact.

### Scenario 9: Responsive and accessible UI

1. Navigate shell, Loop controls, and Leaderboard using keyboard only at desktop and mobile widths.
2. Change ranking sort and inspect a row.
3. ✅ Expected: visible focus, accessible labels/`aria-sort`, no color-only state, and no dropped financial columns.

## Extensibility Checks

- Bind `BullMqJobQueue` behind `IJobQueue`; consumers remain unchanged from the former adapter contract.
- Bind a second `IStrategyGenerator`; queue/worker/Leaderboard code remains unchanged.
- Bind a different scoring policy; Backtester/Worker tests remain unchanged.
- Add an Event subscriber; existing publisher and subscribers remain unchanged.
- Set worker concurrency to another valid value; only throughput changes.
