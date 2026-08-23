# Research: Per-User Leaderboard Live Toggle

## Codebase Baseline

The checked workspace already contains the nullable Prisma ownership columns and Auth infrastructure. It does not yet carry ownership through the full worker/completion/leaderboard pipeline, and its global gateway currently relays the complete `LeaderboardUpdated` payload to every socket.

Relevant version drift from the KB is non-blocking: the workspace uses Next.js 16.3.0 and Jest 30 while `kb/ARCHITECTURE.md` still lists Next.js 15.x and Jest 29.x. This feature uses installed versions and introduces no upgrade.

## Decisions

### D1: Apply visibility in LeaderboardRepository before projection

- **Chosen**: Pass `currentUserId: string | null` explicitly from controller to service to repository. Anonymous uses `{ userId: null }`; authenticated uses `{ OR: [{ userId: null }, { userId: currentUserId }] }`.
- **Rationale**: Filtering before best-per-version selection, sorting, Top-K, detail lookup, and `updatedAt` prevents both row disclosure and metadata/ranking distortion. One repository helper keeps all paths consistent.
- **Alternatives considered**:
  - Filter returned DTOs in controllers: rejected because global Top-K may already have displaced valid owner entries and global timestamps/ranks leak metadata.
  - RLS: rejected by ADR-0016 and the current Prisma connection model.
  - Service-only filtering: rejected because it requires loading forbidden rows into the business layer and is easier to omit from one read path.
- **KB reference**: `kb/contracts/auth.yaml` data scoping; ADR-0016; Constitution security constraint.

### D2: Carry producer ownership unchanged through the worker

- **Chosen**: `BacktestRequested.userId` is the source of truth. The worker passes it into `BacktestResultCreateInput` and `BacktestCompleted`; Leaderboard copies completion ownership into `LeaderboardEntry`.
- **Rationale**: Both producers already know origin: `StrategyController` assigns the authenticated ID for USER jobs, while `StrategyLoopService` explicitly assigns null for SEARCH_LOOP. Copying the value is deterministic and avoids cross-module inference.
- **Alternatives considered**:
  - Infer owner from `StrategyVersion`: rejected because system strategies may be manually backtested by a user and ownership belongs to the request/result.
  - Look up the user from `jobId` inside Leaderboard: rejected because it adds coupling and a database round trip.
  - Derive null from `loopRunId`: rejected because event contracts already provide the authoritative field.
- **KB reference**: `kb/contracts/events.yaml` BacktestRequested/BacktestCompleted; ADR-0016.

### D3: Use a system-safe global notification plus scoped REST refetch

- **Chosen**: Continue relaying `leaderboard:update` globally, but only with system-scoped `topK` and `updatedAt`. Make `triggeredByBacktestResultId` nullable and redact it for private completions. Clients treat the event as invalidation and refetch their scoped REST snapshot.
- **Rationale**: This is the smallest safe solution compatible with the current unauthenticated socket singleton and `server.emit`. Private rows and identifiers never cross the global socket boundary, while the owner still catches up immediately through authenticated REST.
- **Alternatives considered**:
  - Client-side filter of full Top-K: rejected; receiving forbidden data is already a leak.
  - Authenticated per-user Socket.IO rooms: rejected for MVP because no handshake/refresh/room contract exists and correct implementation would require a larger security design and integration suite.
  - Broadcast only system-triggered events: rejected because a user's new private leaderboard entry would not cause immediate owner catch-up.
  - Empty new channel/event: rejected because A8 explicitly names `leaderboard:update`; changing channel would add avoidable surface area.
- **Trade-off**: Live clients perform a REST read for each update. The signal also reveals that some leaderboard activity occurred, but carries no owner, private ID, metric, rank, or private timestamp. This is accepted for the MVP; payload privacy is the binding requirement.
- **KB reference**: `kb/contracts/events.yaml` LeaderboardUpdated; `kb/flows/leaderboard-update.md`; Constitution IV.

### D4: Keep exact gateway relay, enforce safety at the publisher and test both boundaries

- **Chosen**: `LeaderboardService` constructs the privacy-safe payload; `PushGateway` remains a transport-only exact relay. Service tests assert safe construction and gateway tests assert no private row/private trigger reaches `server.emit`.
- **Rationale**: Leaderboard owns ranking and knows the completion's user ID. Gateway should not duplicate repository or ranking logic.
- **Alternatives considered**:
  - Sanitize in the gateway: rejected because gateway lacks repository scope and would duplicate domain policy.
  - Give gateway direct Prisma access: rejected by module boundary and single-responsibility rules.
- **KB reference**: ADR-0011 Observer; `kb/modules/event-infrastructure.md` PushGateway responsibility.

### D5: Re-enable by subscribe-first, then refetch

- **Chosen**: When Live changes to ON, attach the exact stable handler first, then issue catch-up REST refetch. Each signal launches a newer request generation. A response is committed only when it is the latest generation and its scoped `updatedAt` is not older than the current accepted watermark.
- **Rationale**: Refetch-first creates a gap where an update can occur after the response snapshot but before subscription. Subscribe-first closes the gap; generation and watermark checks prevent a concurrent older response from rolling the UI back.
- **Alternatives considered**:
  - Refetch then subscribe: rejected due to missed-update window.
  - Apply the socket `topK`: rejected because it is intentionally system-only and not the user's authoritative view.
  - Disconnect/reconnect the socket: rejected because loop and queue consumers share it.
- **KB reference**: `kb/flows/leaderboard-update.md` reconnect catch-up; `kb/DESIGN.md` stale realtime state.

### D6: Separate leaderboard listener ownership from loop listeners

- **Chosen**: In `useDashboardSummary`, mount/connect/disconnect and `loop:*` subscriptions remain active independently. A separate effect owns only `leaderboard:update` based on `liveUpdatesEnabled`.
- **Rationale**: OFF must freeze only the leaderboard. The global system-loop status continues to update, and the socket remains connected.
- **Alternatives considered**:
  - Tear down the whole dashboard subscription effect: rejected because it freezes loop status and risks duplicate listener churn.
  - Disconnect the singleton: rejected by A8 and other consumers.
- **KB reference**: 2026-08-18 global-loop decision; A8 assignment.

### D7: Make LoopStatusPanel read-only for loop lifecycle

- **Chosen**: Remove start/pause/resume/stop UI props, pending state, and command buttons. Retain system-loop status/progress, retry for read failures, and add the accessible Live updates switch.
- **Rationale**: The 2026-08-18 decision supersedes the stale flow. Keeping command controls would communicate and execute a behavior explicitly removed from end users.
- **Alternatives considered**:
  - Disable command buttons: rejected because disabled controls still imply user ownership and add confusion.
  - Rename Start/Stop to Live while reusing command callbacks: rejected because it could still call loop REST endpoints.
- **KB reference**: `plans/new-requirements-summary.md` dated 2026-08-18; stale `kb/flows/strategy-search-loop.md` noted in spec.

### D8: Preserve backend loop endpoints but never scope loop data by user

- **Chosen**: Add `SupabaseJwtGuard` and `@CurrentUser()` to `LoopController` as assigned, but do not pass identity into `LoopStatusService`, `StrategyLoopService`, or `LoopRepository`. Remove end-user command calls only from frontend UI.
- **Rationale**: A7 explicitly requires guard/decorator on the controller and explicitly prohibits per-user loop filtering. Removing or redesigning operator/system endpoints is beyond this feature.
- **Alternatives considered**:
  - Add `userId` to loop service/repository: rejected as direct scope violation.
  - Delete loop endpoints: rejected because the user requested no toggle calls, not a backend API removal, and other operational code/tests may depend on them.
- **KB reference**: `kb/contracts/auth.yaml` does-not-apply list; A7 assignment.

### D9: Compute response ranks after visibility filtering

- **Chosen**: Ignore persisted global rank for public projection. After visible best-per-version sorting and Top-K slice, map ranks to `index + 1`. Detail derives its rank from the same visible sorted projection.
- **Rationale**: Stored rank currently represents the mixed global table and cannot be correct for anonymous, A, and B simultaneously.
- **Alternatives considered**:
  - Persist one rank per user: rejected because it requires a different data model and per-user materialization.
  - Return gaps: rejected by acceptance requirement.
- **KB reference**: Feature FR-006; Leaderboard Top-K glossary term.

### D10: No Prisma migration or new index

- **Chosen**: Reuse existing nullable columns. Do not edit Prisma models or migrations.
- **Rationale**: `workspace/apps/backend/prisma/schema.prisma` already contains `userId` on StrategyVersion, BacktestResult, and LeaderboardEntry. Course-scale Top-K does not justify an unrequested migration.
- **Alternatives considered**:
  - Add per-user loop columns: rejected by scope.
  - Add compound indexes immediately: rejected until query measurement justifies a separately reviewed migration.
- **KB reference**: Constitution IV; ADR-0016.

## Resolved Questions

- No clarification markers exist in the feature spec.
- Default Live updates state is ON for a new mount; cross-session persistence is out of scope.
- Anonymous leaderboard reads are supported by the optional-auth guard and return system entries only.
- Foreign private detail returns the same stable 404 as a nonexistent entry.
- `DashboardController` is included because `/api/dashboard/summary` is a leaderboard read path.
- Current `SupabaseJwtGuard` behavior for an invalid token differs from the YAML's stated 401 behavior; changing Auth-owned verification semantics is outside A7/A8. Feature tests cover missing token as anonymous and valid mocked identities. This drift should be reported separately to the Auth owner and must not be used to weaken leaderboard scoping.
