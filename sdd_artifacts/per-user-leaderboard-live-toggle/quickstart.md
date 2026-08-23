# Quickstart: Per-User Leaderboard Live Toggle

## Prerequisites

- Run commands from `workspace/`.
- Install workspace dependencies.
- PostgreSQL and Redis are available for integration/E2E scenarios that use the production modules.
- Auth infrastructure exists at `apps/backend/src/auth/`.
- `apps/backend/prisma/schema.prisma` already has nullable `userId` on StrategyVersion, BacktestResult, and LeaderboardEntry.
- Prepare two Supabase test users or deterministic guard/test identities: user A and user B.

No Prisma migration is created for this feature.

## Contract Gate

Before implementation is marked complete, verify:

```powershell
rg -n "userId|triggeredByBacktestResultId|LeaderboardUpdated" ../kb/contracts/events.yaml libs/shared/src/events/index.ts libs/shared/src/types/infrastructure.ts
```

Expected:

- BacktestRequested, BacktestCompleted, and LeaderboardEntry payloads include nullable `userId`.
- private-trigger result ID can be redacted to null;
- global `LeaderboardUpdated.topK` is documented as system-only.

## Targeted Validation

### Shared types

```powershell
npm.cmd run build --workspace=@crypto-strategy-lab/shared
```

### Backend unit and integration

```powershell
npm.cmd test --workspace=@crypto-strategy-lab/backend -- --runInBand src/queue/backtest.worker.spec.ts src/strategy/ports/backtest-result.port.spec.ts src/leaderboard/leaderboard.repository.spec.ts src/leaderboard/leaderboard.service.spec.ts src/leaderboard/leaderboard.controller.spec.ts src/leaderboard/leaderboard.integration.spec.ts src/loop/loop.controller.spec.ts src/dashboard/dashboard.service.spec.ts src/dashboard/push.gateway.spec.ts src/dashboard/dashboard.integration.spec.ts
```

### Frontend hook and component

```powershell
npm.cmd test --workspace=@crypto-strategy-lab/frontend -- --run src/hooks/use-leaderboard.spec.tsx src/hooks/use-dashboard-summary.spec.tsx src/components/dashboard/loop-status-panel.spec.tsx src/components/dashboard/dashboard-grid.spec.tsx src/components/dashboard/leaderboard-preview.spec.tsx
```

## Validation Scenarios

### Scenario 1: Anonymous list and detail

1. Seed a system entry, a user A entry, and a user B entry.
2. Request `GET /api/leaderboard` without a bearer token.
3. Request system detail and both private detail identifiers.
4. ✅ Expected: list and system detail contain only system data; both private details return the stable 404.

### Scenario 2: User A and user B REST isolation

1. Request list/summary/detail with user A identity.
2. Repeat with user B identity.
3. ✅ Expected: A sees system+A, B sees system+B; ranks are contiguous from 1; `updatedAt` ignores the other user's newest row; foreign detail returns 404.

### Scenario 3: Identity propagation

1. Submit a USER backtest as user A.
2. Observe queued request, persisted result, completion event, and created leaderboard entry.
3. Run one SEARCH_LOOP backtest through the same worker path.
4. ✅ Expected: all USER artifacts retain A; all SEARCH_LOOP artifacts retain null.

### Scenario 4: Privacy-safe realtime payload

1. Connect anonymous, A, and B Socket.IO clients to `/infrastructure`.
2. Complete a private user A backtest.
3. Inspect `leaderboard:update` at all three clients.
4. ✅ Expected: `topK` contains system entries only, private trigger ID is null, and no A metric/ID/timestamp appears.
5. Let each ON client refetch REST.
6. ✅ Expected: A receives system+A; B receives system+B; anonymous receives system only.

### Scenario 5: Live OFF freeze

1. Open the dashboard with Live updates ON and record the snapshot.
2. Turn Live updates OFF.
3. Emit a privacy-safe leaderboard notification and change the REST fixture/server state.
4. ✅ Expected: the leaderboard snapshot stays unchanged; loop realtime remains active; the shared socket stays connected; no loop POST request occurs.

### Scenario 6: Re-enable catch-up and race

1. While OFF, publish multiple updates.
2. Turn Live updates ON.
3. Emit another notification while the first catch-up REST request is pending.
4. Resolve the older request after the newer request.
5. ✅ Expected: exactly one listener is owned, the newest scoped snapshot wins, and no update gap or rollback occurs.

### Scenario 7: Reconnect and cleanup

1. Disconnect/reconnect while ON.
2. Verify one refetch and one effective listener.
3. Turn OFF, disconnect/reconnect, then unmount.
4. ✅ Expected: OFF remains OFF and frozen; unmount removes only the exact leaderboard handler; no shared socket disconnect or other-listener removal occurs.

### Scenario 8: Global SearchLoopRun

1. Read `/api/loop/current` and one loop detail as anonymous, A, and B.
2. Inspect repository/service calls.
3. ✅ Expected: all actors observe the same global run; no user filter or per-user loop field exists.

## E2E

```powershell
npm.cmd run test:e2e --workspace=@crypto-strategy-lab/backend -- --runInBand per-user-leaderboard.e2e-spec.ts
npm.cmd run test:e2e --workspace=@crypto-strategy-lab/frontend
```

Backend E2E must use isolated test data and deterministic auth identities. Frontend E2E uses the test-only emit endpoint in `e2e/infrastructure-fixture.mjs`; that fixture is not production socket protocol.

## Full Regression

```powershell
npm.cmd exec -- tsc --noEmit
npm.cmd run build
npm.cmd run test
npm.cmd run lint
git status --short
git diff --check
```

Because backend lint runs with `--fix`, inspect `git diff` immediately afterward and revert no user-owned changes.

## Manual Two-User Network Check

- Authenticated REST requests carry `Authorization: Bearer ...`.
- Toggle interaction sends no `POST /api/loop/start`, `/pause`, `/resume`, or `/stop`.
- Turning Live updates OFF sends no socket disconnect.
- No global socket payload contains a non-null leaderboard `userId`.
- A private data never appears in B REST or realtime, and B private data never appears in A.
- The system loop continues while both users turn Live updates OFF.
