# Member D Update Review — 2026-08-19

**Reviewer**: Hoàng (Architect)
**Scope**: Phương / Member D — impact of the 2026-08-18 auth and per-user leaderboard requirements
**Overall Health**: 🔴 New scope not implemented

## Summary

The existing Event Infrastructure and Dashboard implementation remains broad and mostly complete for its original scope. The new requirements add two assigned items, A7 and A8, but the current code has not implemented either item. A safe implementation also needs to cover the Dashboard BFF and WebSocket path; filtering only the Leaderboard REST endpoint would not satisfy per-user isolation.

## Required Work

### [CRITICAL] [MD-001]: Persist and propagate leaderboard ownership

**Evidence**:
- `kb/contracts/events.yaml:52-56` requires `LeaderboardEntryPayload.userId`.
- `workspace/libs/shared/src/types/infrastructure.ts:67-80` omits `userId`.
- `workspace/apps/backend/src/leaderboard/leaderboard.service.ts:85-98` creates an entry without `userId`.
- `workspace/apps/backend/src/leaderboard/leaderboard.repository.ts:16-29,46-55,165-179` neither accepts nor maps `userId`.
- `workspace/libs/shared/src/events/index.ts:36-76` omits `userId` from backtest request/completion event types, although the KB contract requires it.

**Impact**: User-owned backtests cannot become user-owned leaderboard entries. Any later query filter would treat ownership incorrectly or return incomplete data.

**Action for Phương**: Update Leaderboard create/read/map paths and their tests to consume and persist `BacktestCompleted.userId`. Coordinate with the shared-types owner and Strategy/Worker owners so `userId` is propagated end-to-end; do not invent a local duplicate event type.

### [CRITICAL] [MD-002]: Scope every leaderboard read path, including Dashboard BFF and detail

**Evidence**:
- `plans/assignments/phuong-tasks.md:8-21` assigns A7 and the `userId IS NULL OR userId = :currentUserId` rule.
- `workspace/apps/backend/src/leaderboard/leaderboard.controller.ts:24-41` has no auth guard or `@CurrentUser()` parameter.
- `workspace/apps/backend/src/leaderboard/leaderboard.repository.ts:88-105` reads all entries or filters only by strategy version.
- `workspace/apps/backend/src/dashboard/dashboard.controller.ts:5-12` has no auth context.
- `workspace/apps/backend/src/dashboard/dashboard.service.ts:30-42` obtains an unscoped leaderboard snapshot for the home-page preview.

**Impact**: Filtering only `GET /api/leaderboard` would still leak another user's entries through leaderboard detail and `/api/dashboard/summary`.

**Action for Phương**: Import `AuthModule` where needed, add `SupabaseJwtGuard` and `@CurrentUser()`, pass `userId` through controller → service → repository, and apply the shared-plus-own predicate consistently to list, detail, updated-at, ranking, and Dashboard summary. Add negative tests proving user A cannot retrieve user B's private entry.

### [CRITICAL] [MD-003]: Make realtime leaderboard updates user-safe

**Evidence**:
- `workspace/apps/backend/src/dashboard/push.gateway.ts:104-130` performs no socket authentication/room membership and broadcasts with `server.emit()`.
- `workspace/apps/frontend/src/hooks/use-leaderboard.ts:134-168` always subscribes to `leaderboard:update`.
- `workspace/apps/frontend/src/hooks/use-dashboard-summary.ts:171-298` also always subscribes and replaces the dashboard leaderboard with the received `topK`.
- `kb/contracts/events.yaml:292-303` carries the complete `topK` in the broadcast event.

**Impact**: Once private entries are present, a global broadcast can expose one user's leaderboard data to every connected user. REST filtering alone is insufficient.

**Action for Phương**: Choose and document one safe design: authenticate the Socket.IO handshake and emit a scoped snapshot to a per-user room, or broadcast only an invalidation signal and let clients refetch the authenticated REST snapshot. Update `events.yaml`, gateway/hook tests, reconnect behavior, and dashboard/leaderboard consumers together.

### [HIGH] [MD-004]: Replace user-facing system-loop controls with a live-update toggle

**Evidence**:
- `plans/assignments/phuong-tasks.md:23-39` states the loop is global and users may only subscribe/unsubscribe from leaderboard updates.
- `workspace/apps/frontend/src/components/dashboard/loop-status-panel.tsx:11-29,55-58,184-221` still exposes start/pause/resume/stop commands that mutate the global loop.
- `workspace/apps/frontend/src/app/page.tsx:24-58` builds a loop start request and passes the command API to the panel.
- `workspace/apps/backend/src/loop/loop.controller.ts:35-83` still exposes public start/pause/resume/stop endpoints without an operator boundary.

**Impact**: A normal user can control a system-wide 24/7 process, contradicting the new architecture decision.

**Action for Phương**: Change the UI control to “Live updates ON/OFF”; OFF freezes the last leaderboard snapshot while the system loop continues. Remove normal-user calls to loop command endpoints. Keep command endpoints internal/operator-only or define an explicit authorization boundary with the architect.

### [HIGH] [MD-005]: Create a dedicated SDD feature and regression tests for A7/A8

**Evidence**:
- `plans/assignments/phuong-tasks.md:43-55` requires starting an SDD cycle for the new feature.
- No `sdd_artifacts/` feature currently describes the per-user leaderboard/live-toggle implementation.
- Existing controller, repository, gateway, hook, and panel tests contain no `userId` coverage.

**Action for Phương**: Run the SDD workflow for “user-scoped leaderboard + live-update toggle”, including contracts for REST, WebSocket, data model flow, and tests for anonymous/authenticated access, shared entries, own entries, cross-user denial, toggle/reconnect, and stale REST-vs-realtime races.

### [HIGH] [MD-006]: Finish the existing Event Infrastructure handoff gates

**Evidence**: `sdd_artifacts/event-infrastructure-dashboard/tasks.md:138-141` leaves T046-T049 unchecked. `validation.md:1068-1074` records T046 blocked by full backend lint; T047-T049 were not executed.

**Action for Phương**: After A7/A8 are integrated, rerun T046 and T047, execute the Redis/restart/outage/graceful-shutdown quickstart scenarios in T048, then finish operational docs/Redis AOF/healthcheck and extension demonstrations in T049.

### [CRITICAL] [MD-007]: Continuous user-controlled Search Mode is neither specified nor implemented

**Required behavior confirmed by the product owner**: The user starts Search Mode; while enabled, the system continuously creates and evaluates strategies. Safety bounds may end an internal batch/run but must not disable Search Mode. Only the user's Stop action disables Search Mode and prevents new work; already in-flight work may finish.

**Evidence**:
- `workspace/apps/backend/src/loop/strategy-loop.service.ts:317-325` completes and cleans up the run when any automatic safety bound is reached; it does not create a successor run.
- `workspace/apps/backend/src/loop/loop-status.service.ts:47-60` models `COMPLETED` and `FAILED` only as terminal run states, with no separate persistent Search Mode state.
- `workspace/apps/backend/src/loop/loop.module.ts:51-71` only reconciles an existing active run at startup; it does not restore an enabled Search Mode or start a new run when none is active.
- `workspace/apps/backend/prisma/schema.prisma:174-194` persists `SearchLoopRun` only; there is no Search Mode/session entity or enabled flag.
- `kb/flows/strategy-search-loop.md:19-31,88` specifies one bounded run that terminates on `maxCandidates`, `maxDurationMs`, or no improvement.
- `kb/ARCHITECTURE.md:138` says the global loop runs 24/7 but does not define user-controlled activation, batch continuation, or restart semantics.
- No `SearchMode` term or contract exists in `kb/`, `sdd_artifacts/`, shared types, or Loop source.

**Impact**: The current implementation stops searching after the first safety-bound completion. The KB cannot yet serve as an unambiguous implementation source for the newly confirmed lifecycle.

**Action**: Before coding, define the Search Mode lifecycle separately from `SearchLoopRun`: persistent enabled state and owner/scope, Start/Stop idempotency, automatic successor-run behavior, backend-restart recovery, failure/backoff policy, concurrency/race rules, in-flight completion behavior, REST/events, observability, and acceptance tests. Update Architecture/MODULES, the Event Infrastructure module, Search Loop flow, event contract, glossary, and a dedicated SDD feature. `docs/watchdog.md` is only an unapproved implementation proposal and currently restarts after `STOPPED_BY_USER`, which contradicts the confirmed requirement.

## External Dependency / Blocker to Verify

The Prisma schema contains `LeaderboardEntry.userId` at `workspace/apps/backend/prisma/schema.prisma:151-172`, but no checked-in migration under `workspace/apps/backend/prisma/migrations/` adds that column. A1 is assigned to Hoàng, so Phương should request/verify the migration before integration rather than silently owning that database change.

## Recommended Order

1. Confirm the missing migration and shared event-type propagation with Hoàng/Huy.
2. Specify A7/A8 with the realtime privacy decision made explicit.
3. Implement ownership propagation and scoped repository/service reads.
4. Secure Dashboard REST and realtime delivery.
5. Replace loop mutation controls with the live-update toggle.
6. Add cross-user and toggle/reconnect tests, then complete T046-T049.

**Member verdict**: Needs revision for the new requirements. Estimated assignment remains approximately 1.5 days only if the shared event/migration dependencies are delivered first; realtime user scoping and regression work may increase that estimate.
