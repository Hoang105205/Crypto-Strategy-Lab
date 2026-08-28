# Quickstart: Per-User Leaderboard Live Toggle

## Prerequisites

- Run npm commands from `workspace/` unless a command says otherwise.
- Install workspace dependencies.
- Use deterministic AuthContext identities for anonymous, user A, and user B in frontend integration tests.
- PostgreSQL/Redis are needed only for existing backend integration/E2E regression gates.
- Do not create a Prisma migration, socket room, socket handshake, namespace, or per-user SearchLoopRun.

## Architecture Gate

Before implementation is accepted, inspect the ownership boundary:

```powershell
rg -n "AuthProvider|InfrastructureProvider|LeaderboardLiveProvider|AppShell" apps/frontend/src/app/layout.tsx
rg -n "leaderboard:update" apps/frontend/src/contexts apps/frontend/src/hooks apps/frontend/src/app
rg -n "crypto-strategy-lab:leaderboard-live|crypto-strategy-lab:leaderboard-cache:v1" apps/frontend/src
```

Expected:

- Root order is Auth -> Infrastructure -> Leaderboard Live -> AppShell/routes.
- Production `leaderboard:update` registration exists only in the provider.
- Page hooks contain no competing listener.
- Preference and accepted-cache keys are explicit named constants.

## Wire and Scope Regression Gate

```powershell
rg -n "LeaderboardUpdated|triggeredByBacktestResultId|system-only|userId" ../kb/contracts/events.yaml libs/shared/src/events/index.ts libs/shared/src/types/infrastructure.ts
rg -n "SupabaseJwtGuard|CurrentUser|SearchLoopRun" ../kb/contracts/auth.yaml
```

Expected:

- Existing wire fields and auth semantics are unchanged by this feature amendment.
- `LeaderboardUpdated.topK` remains system-only and private trigger ID remains nullable/redacted.
- `SearchLoopRun` remains excluded from user scoping.

## Targeted Validation

### Frontend provider and consumers

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/contexts/leaderboard-live-context.spec.tsx src/hooks/use-dashboard-summary.spec.tsx src/hooks/use-leaderboard.spec.tsx src/app/page.spec.tsx src/components/common/app-shell.spec.tsx
```

### Existing frontend socket/component regression

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/hooks/use-infrastructure-socket.spec.tsx src/services/infrastructure-socket.spec.ts src/components/dashboard/loop-status-panel.spec.tsx src/components/dashboard/dashboard-grid.spec.tsx src/components/dashboard/leaderboard-preview.spec.tsx
```

### Type and full frontend gates

```powershell
npm.cmd exec -- tsc --noEmit
npm.cmd run test -w @crypto-strategy-lab/frontend
npm.cmd run build -w @crypto-strategy-lab/frontend
```

### Existing backend privacy/global-loop regression

```powershell
npm.cmd test --workspace=@crypto-strategy-lab/backend -- --runInBand src/queue/backtest.worker.spec.ts src/leaderboard/leaderboard.repository.spec.ts src/leaderboard/leaderboard.service.spec.ts src/leaderboard/leaderboard.controller.spec.ts src/leaderboard/leaderboard.integration.spec.ts src/dashboard/dashboard.service.spec.ts src/dashboard/push.gateway.spec.ts src/dashboard/dashboard.integration.spec.ts src/loop/loop.controller.spec.ts
```

## Validation Scenarios

### Scenario 1: First load defaults OFF

1. Clear `crypto-strategy-lab:leaderboard-live` and the accepted cache key.
2. Load the application.
3. Verify one current-session bootstrap can establish authorized data.
4. Emit `leaderboard:update` afterward.
5. Expected: toggle is OFF, listener count is zero, the event causes no refresh, and the snapshot stays frozen.

### Scenario 2: Explicit preference survives navigation/reload/restart

1. Select ON and navigate Dashboard -> `/news` -> `/leaderboard` -> Dashboard.
2. Reload and create a new browser context with the same persisted storage.
3. Repeat after explicitly selecting OFF.
4. Expected: each explicit choice is restored; no load or reconnect silently selects ON.

### Scenario 3: ON survives routes with one listener

1. Sign in as A, select ON, and record the SCORE snapshot.
2. Navigate away from Dashboard without remounting the root providers.
3. Emit a safe invalidation and update A's REST fixture.
4. Open `/leaderboard`, then return to Dashboard.
5. Expected: one provider handler throughout, current-session REST runs off-route, `/leaderboard` registers none, and Dashboard immediately shows maintained system+A data.

### Scenario 4: OFF freezes through routes and reconnect

1. Establish a valid snapshot, select OFF, and record rows/timestamp.
2. Navigate across routes, emit events, and disconnect/reconnect the infrastructure socket.
3. Expected: preference remains OFF, no leaderboard handler/refetch is created by events/reconnect, and rows/timestamp remain unchanged. Loop/connection consumers continue independently.

### Scenario 5: OFF reload/browser restart cache restoration

1. As A, establish an accepted snapshot and turn OFF.
2. Reload or restart with the same A session.
3. Expected: the exact A-stamped envelope restores before any live ownership decision and remains frozen.
4. Repeat with malformed/unknown-version storage.
5. Expected: malformed cache is discarded; one current-session bootstrap may establish a safe snapshot while preference stays OFF.

### Scenario 6: Re-enable subscribe-before-refetch race

1. Miss updates while OFF.
2. Select ON and hold the catch-up REST response.
3. Emit an invalidation and return a newer REST response first.
4. Resolve the older response last.
5. Expected: the handler was attached before catch-up, exactly one handler remains, and the older result cannot overwrite the newer snapshot.

### Scenario 7: Reconnect ON and OFF

1. Reconnect while ON.
2. Expected: one handler and current-session reconciliation.
3. Turn OFF and reconnect again.
4. Expected: zero handler, no automatic leaderboard reconciliation, frozen cache, and unchanged OFF preference.

### Scenario 8: Page unmount versus provider unmount

1. With ON, unmount Dashboard and `/leaderboard` through client-side navigation.
2. Expected: provider/cache/preference/one handler remain.
3. Unmount `LeaderboardLiveProvider` while another consumer owns an infrastructure listener.
4. Expected: provider removes only its exact handler and aborts its requests; foreign handlers remain and the shared socket disconnect function is not called.

### Scenario 9: Anonymous, A, and B cache scope

1. Return system, A, and B fixtures from the server according to current session.
2. Run bootstrap, invalidation, explicit retry, and reconnect reconciliation for anonymous, A, and B.
3. Expected: anonymous cache is system-only; A cache is system+A; B cache is system+B. No event rows are merged or filtered client-side.

### Scenario 10: A -> B before render

1. Accept and persist A cache; start another delayed A REST request.
2. Switch AuthContext to B.
3. Inspect the first B render and resolve the A request afterward.
4. Expected: A snapshot is absent before B paints; A memory/storage/request generation is invalidated; delayed A response cannot commit; B accepts only system+B.

### Scenario 11: A -> anonymous before render

1. Repeat Scenario 10 but sign out A.
2. Expected: no A row/metadata renders; anonymous accepts only system data; explicit ON/OFF preference is unchanged.

### Scenario 12: `/leaderboard` criterion integration

1. Select a non-SCORE criterion and strategy detail on `/leaderboard`.
2. Navigate away while ON and emit an invalidation.
3. Return to `/leaderboard` and Dashboard.
4. Expected: provider reconciles SCORE plus the retained criterion, selection remains if still visible, `/leaderboard` adds no handler, and Dashboard still renders SCORE Top-5.

### Scenario 13: Global Search Loop non-interference

1. Observe the same global loop as anonymous, A, and B.
2. Toggle Live, navigate, reload, reconnect, and change identity.
3. Expected: zero `POST /api/loop/*` calls, no `SearchLoopRun` ownership change, and the global process continues.

## E2E

```powershell
npm.cmd run test:e2e --workspace=@crypto-strategy-lab/backend -- --runInBand per-user-leaderboard.e2e-spec.ts
npm.cmd run test:e2e --workspace=@crypto-strategy-lab/frontend
```

The frontend fixture may delay REST responses and change deterministic identities, but it must emit only the existing safe payload on the existing namespace/channel. It must not simulate a production room, handshake, or privacy filter.

## Full Regression and Diff Safety

```powershell
npm.cmd run test
npm.cmd run build
# Diagnostic only: records repository-wide debt outside this feature.
npm.cmd run lint
git status --short
git diff --check
```

T040's release gate uses the configured lint rules and non-mutating format checks on `libs/shared` plus the exact backend/frontend feature file set. The root lint command above is diagnostic only for separately owned repository debt. Backend lint may run with `--fix`; restrict it to exact feature paths, inspect the diff immediately, and preserve unrelated user-owned changes.

## Manual Network Check

- Each reconciliation reads the token current at request time.
- While ON off-route, safe invalidation produces REST reads even with Dashboard absent.
- While OFF, event/reconnect produces no leaderboard REST read.
- No page route registers `leaderboard:update`.
- Toggle/provider cleanup sends no socket disconnect and no loop lifecycle request.
- No global socket payload contains a non-null leaderboard `userId`.
- A data never appears in B/anonymous cache, storage-backed render, rank, timestamp, or delayed response commit.
