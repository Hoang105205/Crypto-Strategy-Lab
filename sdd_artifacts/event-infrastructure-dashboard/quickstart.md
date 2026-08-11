# Quickstart: Event Infrastructure Dashboard

## Prerequisites

- Node.js compatible with the workspace and npm 10.x
- Dependencies installed from `workspace/`
- PostgreSQL available when running persistence-backed scenarios
- Current Prisma client generated
- Strategy integration providers available for a real backtest; test doubles are used for isolated feature tests

## Setup

From `workspace/`:

```powershell
npm install
npx prisma generate --schema apps/backend/prisma/schema.prisma
npm run build
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

1. Publish `BacktestRequested` with a producer UUID and successful test doubles.
2. Query status immediately and after completion.
3. ✅ Expected: the same UUID moves `QUEUED` → `PROCESSING` → `COMPLETED`; one `BacktestCompleted` is emitted.

### Scenario 3: Retry and dead letter

1. Configure a test Backtester to fail on all executions.
2. Advance fake time through 1s and 4s.
3. ✅ Expected: exactly three attempts, one terminal failure Event, one dead-letter Event, and one inspectable DLQ row.

### Scenario 4: USER priority

1. Occupy all workers, enqueue two Search Loop jobs, then enqueue a manual job.
2. Release one worker.
3. ✅ Expected: the manual job runs next; Search Loop jobs retain their relative FIFO order.

### Scenario 5: Idempotent Leaderboard

1. Deliver the same valid `BacktestCompleted` twice.
2. Query the Leaderboard.
3. ✅ Expected: one entry and one ranking broadcast; score and rank are deterministic.

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

- Bind a fake alternative `IJobQueue`; consumers compile and tests remain unchanged.
- Bind a second `IStrategyGenerator`; queue/worker/Leaderboard code remains unchanged.
- Bind a different scoring policy; Backtester/Worker tests remain unchanged.
- Add an Event subscriber; existing publisher and subscribers remain unchanged.
- Set worker concurrency to another valid value; only throughput changes.

