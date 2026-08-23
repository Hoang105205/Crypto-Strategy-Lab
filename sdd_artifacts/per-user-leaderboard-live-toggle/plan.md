# Implementation Plan: Per-User Leaderboard Live Toggle

**Feature**: `per-user-leaderboard-live-toggle` | **Date**: 2026-08-23 | **Spec**: `spec.md`

## Summary

Complete Phuong tasks A7 and A8 inside the existing Auth, Event Infrastructure, Dashboard, and Frontend boundaries. The backend will propagate nullable `userId` from `BacktestRequested` through persisted `BacktestResult`, `BacktestCompleted`, and `LeaderboardEntry`; apply the system-or-current-user predicate before every leaderboard list, detail, Top-K, rank, and `updatedAt` projection; and leave `SearchLoopRun` global.

The realtime MVP will not add Socket.IO rooms or socket authentication. `LeaderboardUpdated` remains a namespace-wide notification, but the globally relayed payload is made privacy-safe: `topK` contains system entries only, `updatedAt` is system-scoped, and a private trigger identifier is redacted to null. Live clients treat `leaderboard:update` as an invalidation and refetch the authoritative user-scoped REST snapshot. This preserves owner-private updates without broadcasting private rows and reuses the existing REST JWT path.

The frontend keeps the existing infrastructure socket singleton. The Live updates toggle controls only the exact `leaderboard:update` listener; loop lifecycle listeners remain active. OFF removes that listener and freezes the last leaderboard snapshot. Re-enable attaches the listener first and then refetches, with request generations and snapshot watermarks preventing gaps and stale overwrite. `LoopStatusPanel` becomes a read-only global-loop status surface plus the Live updates toggle; it no longer renders end-user start/pause/resume/stop controls.

## Technical Context

**Language/Version**: TypeScript 5.7.x; Node.js runtime used by the monorepo

**Primary Dependencies**: NestJS 11, Next.js 16.3.0 in the checked workspace (KB target still says 15.x), React 19.2, Prisma 6, EventEmitter2, Socket.IO 4.8, Supabase Auth

**Storage**: PostgreSQL through Prisma; Redis/BullMQ remains unchanged for backtest jobs

**Testing**: Jest 30 backend unit/integration/E2E, Vitest 2 frontend hook/component tests, Playwright 1.62 frontend E2E

**Target Platform**: Browser client plus NestJS modular-monolith backend

**Project Type**: Full-stack web application/API in an npm workspace monorepo

**Performance Goals**: Filter before Top-K; return at most configured K entries; one owned leaderboard listener per live view; no duplicate catch-up request caused by duplicate handlers; preserve bounded payloads

**Constraints**: App-level authorization per ADR-0016; no new module; no per-user loop; no socket disconnect from the toggle; no private namespace broadcast; no Prisma migration because all three nullable `userId` columns already exist in `schema.prisma`

## Constitution Check

*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Architecture Quality | ✅ PASS | Changes extend existing Auth, Leaderboard, Loop, Dashboard, Queue/Worker, shared-types, and frontend seams; no ad-hoc module or service is introduced. |
| II. Contract-Driven | ✅ PASS | Active YAML already requires `userId` on `BacktestRequested`, `BacktestCompleted`, and `LeaderboardEntryPayload`; feature contracts below define the privacy-safe realtime amendment before implementation. `kb/contracts/events.yaml` must be synchronized before source changes are considered complete. |
| III. Demonstrable Extension Points | ✅ PASS | No new extension point is claimed; isolation and realtime behavior are demonstrated with two-user REST/socket tests. |
| IV. Simplicity Over Cleverness | ✅ PASS | A system-only global notification plus scoped REST refetch is smaller and safer than adding socket authentication and per-user rooms for the MVP. |
| V. Knowledge Base as Truth | ✅ PASS | The 2026-08-18 assignment/summary decision resolves the stale search-loop flow explicitly; contract drift in shared TypeScript is corrected toward the active YAML. |
| VI. Explicit Over Implicit | ✅ PASS | Viewer scope is an explicit `string | null` argument at controller/service/repository boundaries; listener ownership and private-trigger redaction are explicit. |
| Security constraint | ✅ PASS | Every leaderboard read uses `userId IS NULL OR userId = currentUserId`; anonymous uses `userId IS NULL`; realtime never broadcasts private rows. |

## Architecture Decision

**Approach**: In-place modular-monolith extension with repository-level viewer scoping, end-to-end event identity propagation, and privacy-safe global invalidation over the existing socket channel.

**Rationale**: `LeaderboardEntry` is owned by Event Infrastructure, so its repository is the authoritative place to apply the visibility predicate before best-per-version selection and Top-K. Controllers extract identity through the existing Auth module and services pass it explicitly. The queue worker is the existing bridge from `BacktestRequested` to `BacktestCompleted`, so it must persist and republish the producer's `userId`. The gateway cannot safely send private Top-K with `server.emit`, and the repository currently has no socket handshake identity. A safe system snapshot used as an invalidation signal avoids inventing a room protocol while letting each browser recover its own private view through authenticated REST.

**Modules affected**: Auth consumption; Event Infrastructure Leaderboard, Loop, Dashboard, Queue Worker; Strategy-owned result persistence port; shared contracts/types; Frontend dashboard and leaderboard hooks/components.

**E2E flows affected**: Leaderboard Update; Strategy Backtest identity propagation; Strategy Search Loop only as a global producer with `userId = null`; Dashboard Realtime; Leaderboard REST detail.

**New modules needed**: None.

### Realtime Privacy Decision

The existing `PushGateway` relays the bus payload unchanged with `server.emit`. Client-side filtering is rejected because the private data has already crossed the authorization boundary. Per-user Socket.IO rooms are also rejected for this feature because they would require a new socket-auth contract, token refresh/handshake behavior, room lifecycle, and gateway integration suite.

The selected wire behavior is:

1. `LeaderboardService` persists the completion with its `userId`.
2. It builds the emitted `LeaderboardUpdated.topK` with viewer scope null, which means system entries only.
3. It builds `updatedAt` using the same system-only scope.
4. `triggeredByBacktestResultId` is the result ID only for a system completion; it is null for a private completion.
5. `PushGateway` can continue exact relay because the producer guarantees a safe payload; gateway tests enforce that private entries never reach `server.emit`.
6. Frontend handlers do not apply `topK` directly. Receipt means “the leaderboard may have changed”; an ON client refetches its REST-scoped snapshot.

**Trade-off**: Every connected live client performs a REST read for each update, including private updates it cannot see. This is acceptable for the course MVP and produces no cross-user payload disclosure. If fan-out becomes material, a later ADR may add authenticated per-user rooms or coalesced invalidations; neither is introduced here.

## Current-Code Findings

| Path | Current behavior | Planned correction |
|------|------------------|--------------------|
| `workspace/libs/shared/src/events/index.ts` | `BacktestRequestedPayload` has `userId`; `BacktestCompletedPayload` does not. | Add required `userId: string | null` to completion payload. |
| `workspace/libs/shared/src/types/infrastructure.ts` | `LeaderboardEntryPayload` omits contract-required `userId`. | Add required `userId: string | null`. |
| `workspace/apps/backend/src/queue/backtest.worker.ts` | Worker does not pass `userId` to result persistence or completion event. | Copy `payload.userId` to both boundaries. |
| `workspace/apps/backend/src/strategy/ports/backtest-result.port.ts` | Persistence accepts the shared create type, but version detail mapping drops `userId`. | Persist input `userId` through the existing spread and map user ownership fields explicitly in detail projections. |
| `workspace/apps/backend/src/leaderboard/leaderboard.repository.ts` | Create/map omit `userId`; reads load all rows; API returns persisted global ranks. | Add identity propagation and viewer-scoped queries; filter before best-per-version/Top-K; assign view-local `1..N` ranks. |
| `workspace/apps/backend/src/leaderboard/leaderboard.service.ts` | List/detail have no viewer argument; emitted Top-K is global. | Pass viewer scope for REST; emit system-only safe notification after each completion. |
| `workspace/apps/backend/src/leaderboard/leaderboard.controller.ts` | No auth guard or current-user parameter. | Apply `SupabaseJwtGuard`; pass `@CurrentUser()` to list/detail. |
| `workspace/apps/backend/src/loop/loop.controller.ts` | No auth context and exposes global commands/reads. | Apply guard/decorator to methods but never pass user ID as a loop repository filter; backend loop remains global. |
| `workspace/apps/backend/src/dashboard/dashboard.controller.ts` | Summary has no current-user context. | Guard summary and pass current user to its leaderboard projection. |
| `workspace/apps/backend/src/dashboard/push.gateway.ts` | Exact namespace-wide relay of potentially private payload. | Preserve exact relay only after producer payload is guaranteed system-safe; add explicit privacy regression tests. |
| `workspace/apps/frontend/src/hooks/use-leaderboard.ts` | Applies `topK` directly and always owns a listener. | Treat event as invalidation/refetch; retain sort, selection, generations, and scoped `updatedAt` watermark. |
| `workspace/apps/frontend/src/hooks/use-dashboard-summary.ts` | Applies event `topK` directly; no live preference. | Add Live state; conditionally own only the leaderboard listener; preserve loop listeners; refetch and merge without stale overwrite. |
| `workspace/apps/frontend/src/components/dashboard/loop-status-panel.tsx` | Renders start/pause/resume/stop commands. | Remove command UI and expose accessible Live updates switch alongside read-only global-loop status. |
| `workspace/apps/frontend/src/app/page.tsx` | Constructs loop start config and passes command API. | Remove end-user loop-command wiring; pass Live state/callback from dashboard hook. |

## End-to-End `userId` Trace

```text
USER request
StrategyController @CurrentUser()
  -> BacktestRequested.userId = currentUserId
  -> BullMQ stored payload preserves userId
  -> BacktestWorker saves BacktestResult.userId
  -> BacktestWorker publishes BacktestCompleted.userId
  -> LeaderboardService creates LeaderboardEntry.userId

SEARCH_LOOP request
StrategyLoopService sets userId = null
  -> same queue/worker/completion/leaderboard path
  -> system BacktestResult and LeaderboardEntry keep userId = null

REST viewer
SupabaseJwtGuard -> @CurrentUser() -> service -> repository
  -> filter visible rows
  -> best per strategy version
  -> sort and slice Top-K
  -> assign response ranks 1..N
  -> calculate updatedAt from the same visible rows
```

No component may infer ownership from `strategyVersionId`, `loopRunId`, or a later database lookup. The producer-supplied nullable user ID is carried unchanged.

## Source Code Structure

### Shared contract alignment

- `kb/contracts/events.yaml`: document safe global `LeaderboardUpdated` semantics and make `triggeredByBacktestResultId` nullable for private-trigger redaction.
- `workspace/libs/shared/src/events/index.ts`: add completion `userId` and nullable trigger type.
- `workspace/libs/shared/src/types/infrastructure.ts`: add leaderboard-entry `userId`.
- `workspace/libs/shared/src/types/strategy.ts`: keep existing optional result ownership; no schema redesign.

### Backend identity propagation

- `workspace/apps/backend/src/strategy/controllers/strategy.controller.ts`: existing USER producer remains the source of authenticated `userId`; regression tests only unless a type update requires fixture edits.
- `workspace/apps/backend/src/loop/strategy-loop.service.ts`: existing SEARCH_LOOP producer remains explicitly null; regression tests prove this invariant.
- `workspace/apps/backend/src/queue/backtest.worker.ts`: pass user ID to result persistence and completion.
- `workspace/apps/backend/src/queue/backtest.worker.spec.ts`: prove USER and SEARCH_LOOP propagation.
- `workspace/apps/backend/src/strategy/ports/backtest-result.port.ts`
- `workspace/apps/backend/src/strategy/ports/backtest-result.port.spec.ts`

### Backend scoped reads and safe publication

- `workspace/apps/backend/src/leaderboard/leaderboard.repository.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.repository.spec.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.service.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.service.spec.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.controller.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.controller.spec.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.integration.spec.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.module.ts`: import `AuthModule`.
- `workspace/apps/backend/src/loop/loop.controller.ts`
- `workspace/apps/backend/src/loop/loop.controller.spec.ts`
- `workspace/apps/backend/src/loop/loop.module.ts`: import `AuthModule`.
- `workspace/apps/backend/src/dashboard/dashboard.controller.ts`
- `workspace/apps/backend/src/dashboard/dashboard.service.ts`
- `workspace/apps/backend/src/dashboard/dashboard.service.spec.ts`
- `workspace/apps/backend/src/dashboard/dashboard.integration.spec.ts`
- `workspace/apps/backend/src/dashboard/dashboard.module.ts`: import `AuthModule`.
- `workspace/apps/backend/src/dashboard/push.gateway.ts`
- `workspace/apps/backend/src/dashboard/push.gateway.spec.ts`

### Frontend toggle and catch-up

- `workspace/apps/frontend/src/hooks/use-leaderboard.ts`
- `workspace/apps/frontend/src/hooks/use-leaderboard.spec.tsx`
- `workspace/apps/frontend/src/hooks/use-dashboard-summary.ts`
- `workspace/apps/frontend/src/hooks/use-dashboard-summary.spec.tsx`
- `workspace/apps/frontend/src/components/dashboard/loop-status-panel.tsx`
- `workspace/apps/frontend/src/components/dashboard/loop-status-panel.spec.tsx`
- `workspace/apps/frontend/src/components/dashboard/dashboard-grid.spec.tsx`
- `workspace/apps/frontend/src/components/dashboard/leaderboard-preview.spec.tsx`
- `workspace/apps/frontend/src/app/page.tsx`
- `workspace/apps/frontend/src/app/leaderboard/page.tsx`: no new room protocol; existing always-live full leaderboard uses invalidation/refetch semantics.
- `workspace/apps/frontend/src/services/infrastructure-socket.ts`: no functional change; regression assertion proves toggle never calls the exported disconnect seam.

### E2E

- `workspace/apps/backend/test/per-user-leaderboard.e2e-spec.ts`: add anonymous/A/B list, detail anti-enumeration, dashboard scope, global-loop read, and privacy-safe socket acceptance.
- `workspace/apps/frontend/e2e/leaderboard.spec.ts`: add Live ON/OFF/re-enable, reconnect, sort/selection retention, and absence of loop command requests.
- `workspace/apps/frontend/e2e/infrastructure-fixture.mjs`: add a test-only HTTP trigger that emits the privacy-safe `leaderboard:update` notification; do not add rooms or auth behavior.

## Implementation Phases

### Phase 0 - Contract and RED tests

1. Amend `kb/contracts/events.yaml` and the feature contracts to declare required user fields and safe global notification semantics before source changes.
2. Update shared-type compile fixtures and add failing tests for `BacktestCompleted.userId`, `LeaderboardEntryPayload.userId`, nullable private trigger, USER propagation, and SEARCH_LOOP null propagation.
3. Add failing repository/service/controller tests for anonymous, A, B, list, detail, Top-K-before-filter, scoped `updatedAt`, and view-local ranks.
4. Add failing gateway tests that reject any private `topK` row or private trigger ID at `server.emit`.
5. Replace frontend command-oriented component expectations with failing read-only/toggle expectations and add hook lifecycle/race tests.

### Phase 1 - Identity propagation

1. Align shared interfaces with YAML.
2. Pass `payload.userId` into `BacktestResultPort.save` and `BacktestCompleted` in the worker.
3. Carry completion `userId` into `LeaderboardCreateInput`, Prisma create, repository mapper, and all response fixtures.
4. Verify system-loop requests remain null and no `SearchLoopRun`/`SearchLoopCandidate` field changes occur.

### Phase 2 - Scoped backend reads

1. Add one repository visibility predicate helper: anonymous maps to `{ userId: null }`; authenticated maps to `OR [{ userId: null }, { userId: currentUserId }]`.
2. Require viewer ID on `getTopK`, `findBestByStrategyVersionId`, and `getUpdatedAt`.
3. Filter rows before best-per-version selection and Top-K slicing. Map list results with `rank = index + 1`.
4. For detail, rank the visible best-per-version SCORE projection first, then find the requested strategy version so the returned rank is viewer-local and an out-of-scope ID yields null/404.
5. Thread viewer ID through Leaderboard and Dashboard services/controllers.
6. Add `SupabaseJwtGuard`/`@CurrentUser()` to Leaderboard, Loop, and Dashboard controllers. Loop methods accept auth context but do not pass it into loop state reads/writes.

### Phase 3 - Privacy-safe realtime

1. After each completion, build `LeaderboardUpdated` from repository reads using null viewer scope.
2. Redact `triggeredByBacktestResultId` for private completion; assert every emitted `topK` entry has null `userId`.
3. Keep `PushGateway` exact relay and lifecycle isolation, but strengthen unit/integration assertions so private payloads cannot reach namespace `server.emit`.
4. Change `useLeaderboard` and `useDashboardSummary` to treat the channel as an invalidation and refetch REST rather than applying event `topK`.

### Phase 4 - Live toggle and global-loop UI

1. Add `liveUpdatesEnabled` (default true) and a setter to dashboard state.
2. Keep connect/disconnect and `loop:*` handlers registered independently of the toggle.
3. When ON, attach exactly one stable leaderboard handler before catch-up refetch. When OFF or unmounted, remove that exact handler only.
4. Preserve the visible leaderboard during OFF reconnect/background summary refresh; loop/queue status may continue updating.
5. On re-enable, increment/refetch through the existing request-generation path. A later invalidation starts a newer generation; an older response cannot overwrite it. Accepted snapshots advance a scoped `updatedAt` watermark.
6. Remove loop command props/state/buttons from `LoopStatusPanel` and Home; render the accessible `role="switch"`/`aria-checked` Live updates control with explanatory text that the system loop continues.

### Phase 5 - Verification

1. Run targeted shared/backend/frontend tests.
2. Run integration tests with system, A, and B fixtures.
3. Run backend and frontend E2E, including two concurrent user contexts and the real Socket.IO namespace fixture.
4. Run builds, full test suites, lint with post-lint diff inspection, and `git diff --check`.
5. Manually verify Network: bearer REST, no loop POST from toggle, no socket disconnect, no private B data in A payloads or responses.

## Test Matrix

| Level | Exact files | Required evidence |
|-------|-------------|-------------------|
| Shared/type | `workspace/libs/shared/src/events/index.ts`, `workspace/libs/shared/src/types/infrastructure.ts`; compiler/build fixtures across affected specs | Required `userId` fields match YAML and all producers/consumers compile. |
| Worker unit | `workspace/apps/backend/src/queue/backtest.worker.spec.ts` | USER ID saved and completed unchanged; SEARCH_LOOP stays null. |
| Strategy port unit | `workspace/apps/backend/src/strategy/ports/backtest-result.port.spec.ts` | Persisted/mapped ownership survives idempotent save and detail projection. |
| Repository unit | `workspace/apps/backend/src/leaderboard/leaderboard.repository.spec.ts` | Anonymous/system only; A=system+A; B=system+B; filter before best/Top-K; ranks `1..N`; scoped `updatedAt`; detail selection scoped. |
| Service unit | `workspace/apps/backend/src/leaderboard/leaderboard.service.spec.ts` | Entry ownership propagation; private-safe event; cross-user detail null; scoped arguments forwarded. |
| Controller unit/integration | `workspace/apps/backend/src/leaderboard/leaderboard.controller.spec.ts`, `workspace/apps/backend/src/leaderboard/leaderboard.integration.spec.ts`, `workspace/apps/backend/src/loop/loop.controller.spec.ts` | Guard/decorator metadata and A/B delegation; 404 anti-enumeration; loop identity ignored for global state. |
| Dashboard unit/integration | `workspace/apps/backend/src/dashboard/dashboard.service.spec.ts`, `workspace/apps/backend/src/dashboard/dashboard.integration.spec.ts` | Scoped Top-5/updatedAt; global loop and queue unchanged. |
| Gateway unit/integration | `workspace/apps/backend/src/dashboard/push.gateway.spec.ts`, `workspace/apps/backend/src/dashboard/dashboard.integration.spec.ts` | Exact channel relay, system-only rows, null private trigger, no lifecycle regressions. |
| Frontend hook | `workspace/apps/frontend/src/hooks/use-leaderboard.spec.tsx`, `workspace/apps/frontend/src/hooks/use-dashboard-summary.spec.tsx` | Invalidation refetch; listener-first re-enable; request generation/watermark; ON/OFF/reconnect; loop listeners unaffected. |
| Frontend component | `workspace/apps/frontend/src/components/dashboard/loop-status-panel.spec.tsx`, `dashboard-grid.spec.tsx`, `leaderboard-preview.spec.tsx` | Accessible switch; frozen snapshot; no command controls/calls; read-only system status. |
| Backend E2E | `workspace/apps/backend/test/per-user-leaderboard.e2e-spec.ts` | Anonymous/A/B REST isolation, foreign detail 404, dashboard isolation, same global loop, safe socket payload. |
| Frontend E2E | `workspace/apps/frontend/e2e/leaderboard.spec.ts`, `workspace/apps/frontend/e2e/infrastructure-fixture.mjs` | ON updates via refetch, OFF freezes, re-enable catches up, reconnect respects OFF, no duplicate listener symptoms, no loop POST/socket disconnect. |

## Migration and Data Notes

- `workspace/apps/backend/prisma/schema.prisma` already contains nullable `userId` on `StrategyVersion`, `BacktestResult`, and `LeaderboardEntry`.
- This feature creates no Prisma migration and changes no `SearchLoopRun` or `SearchLoopCandidate` field.
- No new index is added because that would require a migration. Dataset size and Top-K are bounded for the course MVP; a future measured optimization may add a `LeaderboardEntry(userId, updatedAt)` index through a separately reviewed migration.
- Existing global stored `rank` may remain for persistence compatibility. Public list/detail projections compute viewer-local ranks after filtering; they do not trust the stored global rank.

## Constitution Re-check After Design

All gates remain PASS. The design introduces no new technology, module, database model, migration, or cross-module database access. The only contract amendment narrows global realtime exposure and is documented before implementation. No complexity exception is required.

## Complexity Tracking

No constitution violation requires justification.
