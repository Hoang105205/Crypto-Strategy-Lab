# Implementation Plan: Per-User Leaderboard Live Toggle

**Feature**: `per-user-leaderboard-live-toggle` | **Date**: 2026-08-24 | **Spec**: `spec.md`

## Summary

Update the existing feature in place so leaderboard Live updates is owned by one application-lifetime React provider, mounted in the canonical root tree as `AuthProvider -> InfrastructureProvider -> LeaderboardLiveProvider -> AppShell/routes`. The provider owns the explicit browser-persisted ON/OFF choice, viewer-stamped leaderboard snapshots, the active leaderboard view state, one exact `leaderboard:update` handler, reconnect reconciliation, and identity/request generations. Dashboard and `/leaderboard` become consumers; page hooks no longer own competing leaderboard listeners or route-lifetime caches.

The existing backend privacy design is retained: `leaderboard:update` is a namespace-wide system-only safe invalidation, and current-session REST is authoritative for anonymous, A, and B views. The existing event fields, auth semantics, namespace, shared socket lifecycle, database schema, and one global system Search Loop remain unchanged.

## Technical Context

**Language/Version**: TypeScript 5.7.x; Node.js runtime used by the monorepo

**Primary Dependencies**: NestJS 11, Next.js 16.3.0 in the checked workspace, React 19.2, Prisma 6, EventEmitter2, Socket.IO 4.8, Supabase Auth

**Storage**: Existing PostgreSQL/Prisma and Redis/BullMQ remain unchanged. Browser `localStorage` stores the explicit preference and an accepted viewer-stamped leaderboard cache envelope; no server persistence or migration is added.

**Testing**: Jest 30 backend regression coverage; Vitest 2 frontend provider/hook/component tests; Playwright 1.62 route, reload, reconnect, and identity-transition E2E

**Target Platform**: Browser client plus NestJS modular-monolith backend

**Project Type**: Full-stack web application/API in an npm workspace monorepo

**Performance Goals**: Exactly one provider-owned `leaderboard:update` handler while ON and zero while OFF; one SCORE REST reconciliation per invalidation plus one additional request only when the retained `/leaderboard` criterion differs from SCORE; no duplicate page-level request fan-out; at most configured Top-K per snapshot.

**Constraints**: App-level authorization per ADR-0016; no new domain module; no rooms, socket auth handshake, namespace, client privacy filter, socket disconnect, wire-field/auth change, Prisma migration, database change, or per-user SearchLoopRun.

## Constitution Check

*GATE: PASS before Phase 0 research and PASS again after design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Architecture Quality | PASS | Adds one frontend provider within the existing Frontend/Auth/Infrastructure boundaries; no ad-hoc backend module or service. |
| II. Contract-Driven | PASS | Active auth/events YAML remains the wire SSoT. Only the feature-local client semantics contract is clarified; no wire field changes. |
| III. Demonstrable Extension Points | PASS | No extension point is claimed. Cross-route, reconnect, and identity behavior is demonstrable through provider integration/E2E tests. |
| IV. Simplicity Over Cleverness | PASS | Reuses the shared socket and current-session REST instead of adding rooms, socket identity, or another cache library. |
| V. Knowledge Base as Truth | PASS | Uses the synchronized 2026-08-24 leaderboard and global-loop KB decisions. |
| VI. Explicit Over Implicit | PASS | Provider placement, viewer key, generation, exact handler, cache keys, and cleanup boundary are named and testable. |
| Security constraint | PASS | Only accepted caller-scoped REST snapshots enter a viewer cache; event payload rows are never applied or filtered client-side. |

## Architecture Decision

**Approach**: In-place frontend ownership refactor on top of the already-delivered scoped REST and safe-invalidation backend.

**Rationale**: Dashboard and `/leaderboard` currently mount independent hooks, so state and handler lifetime are tied to pages. Moving ownership above `AppShell` makes the lifetime match the browser application/session, keeps live reconciliation active off-route, and provides a single identity boundary for cache/request invalidation.

**Modules affected**: Frontend application shell, Auth consumption, shared Infrastructure socket consumption, Dashboard consumer hook, Leaderboard consumer hook/page. Event Infrastructure/Auth backend code remains regression-only.

**E2E flows affected**: `kb/flows/leaderboard-update.md`; `kb/flows/strategy-search-loop.md` only to assert that browser actions issue zero loop lifecycle commands.

**New modules needed**: None. `LeaderboardLiveProvider` is a frontend context within the existing Frontend module, not a new domain module.

### Provider Placement

```text
RootLayout
  ErrorBoundary
    AuthProvider
      InfrastructureProvider            owns shared socket connect/disconnect
        LeaderboardLiveProvider         owns feature preference/cache/listener/generations
          AppShell
            Dashboard route             consumes SCORE snapshot
            /leaderboard route          consumes selected-criterion snapshot
            all other routes            provider remains mounted and reconciles while ON
```

Client-side page unmount is not a cleanup boundary. Only `LeaderboardLiveProvider` unmount removes its exact `leaderboard:update` handler and aborts its requests. `InfrastructureProvider` alone owns shared socket disconnect at application teardown.

## Verified Baseline and Remaining Gap

| Area | Verified current state | Plan action |
|------|------------------------|-------------|
| Backend ownership/scoping | USER/null ownership propagation, scoped list/detail/rank/`updatedAt`, system-only invalidation, and global loop behavior are implemented and tested. | Regression only; no backend or wire change. |
| Persisted preference | `use-leaderboard-live-preference.ts` persists `crypto-strategy-lab:leaderboard-live`; absent/malformed/unavailable storage resolves OFF. | Keep as an internal provider dependency; route hooks stop reading it directly. |
| Dashboard hook | Owns Dashboard cache and a conditional `leaderboard:update` listener. | Retain loop/queue summary behavior; remove leaderboard listener/cache ownership and compose provider SCORE snapshot. |
| Leaderboard hook | Owns a separate cache, preference subscription, reconnect handling, and `leaderboard:update` listener. | Convert to a provider consumer adapter; retain public sort/selection/refetch shape where useful. |
| Root layout | `AuthProvider -> InfrastructureProvider -> AppShell`; no leaderboard provider. | Insert `LeaderboardLiveProvider` below both prerequisite providers and above `AppShell`. |
| Cross-route cache | No application-level cache; page unmount discards snapshots. | Add viewer-stamped snapshots by criterion, persisted as one current-viewer envelope. |
| Identity transition | Page hooks have request generations but no A->B/A->anonymous application boundary. | Gate reads by current viewer key, clear memory/storage, abort requests, and advance identity generation before exposing the new viewer. |

## State Ownership and Public Provider API

`workspace/apps/frontend/src/contexts/leaderboard-live-context.tsx` owns:

- `isLive` and `setIsLive(value)` using the existing preference key; only explicit user action writes the value.
- `viewerKey`: verified `user.id`, the literal `anonymous`, or unresolved while Auth is loading.
- `snapshotsByCriterion`: accepted REST snapshots stamped with `viewerKey`, criterion, identity generation, request generation, and `updatedAt` watermark.
- `activeCriterion` and `selectedStrategyVersionId`, so live updates do not reset route view state and navigation can reuse it.
- `loading`, `error`, `isStale`, and `lastSuccessfulAt` for the currently selected snapshot.
- a stable `reconcile(criteria, reason)` operation and public `refetch(criterion?)` for explicit retry/sort/bootstrap reads.
- one stable `leaderboard:update` handler and all provider-owned `AbortController` instances.

The context exposes a typed consumer surface equivalent to:

```ts
interface LeaderboardLiveContextValue {
  isLive: boolean;
  setIsLive(value: boolean): void;
  scoreSnapshot: LeaderboardSnapshot | null;
  activeSnapshot: LeaderboardSnapshot | null;
  activeCriterion: RankingCriterion;
  setActiveCriterion(value: RankingCriterion): Promise<void>;
  selectedStrategyVersionId: string | null;
  setSelectedStrategyVersionId(value: string | null): void;
  loading: boolean;
  error: Error | null;
  isStale: boolean;
  lastSuccessfulAt: Date | null;
  refetch(criterion?: RankingCriterion): Promise<void>;
}
```

Dashboard consumes `scoreSnapshot.entries.slice(0, 5)`. `/leaderboard` consumes `activeSnapshot`. Neither consumer receives the socket through this API or registers `leaderboard:update`.

## Cache and Persistence Model

- Preference key remains `crypto-strategy-lab:leaderboard-live`; missing, invalid, or inaccessible storage means OFF.
- Accepted snapshots use `crypto-strategy-lab:leaderboard-cache:v1` as one replaceable envelope stamped with the exact viewer key. The provider never stores the event payload as a snapshot.
- The envelope can contain SCORE and the retained active criterion. SCORE is always reconciled because it is the Dashboard cache; if the active criterion differs, it is reconciled in the same provider cycle.
- On reload/browser restart, the provider waits for Auth resolution, restores only an exact viewer-key match, and otherwise discards the whole envelope. It does not filter rows from a mismatched cache.
- If OFF and no valid current-viewer snapshot exists, one explicit bootstrap REST read establishes a displayable frozen snapshot. Thereafter events and reconnects cannot mutate it. User-initiated sort/retry may perform an explicit read without enabling Live.
- Storage failure never enables Live and never permits a prior-viewer snapshot to render; the provider falls back to memory plus a current-session bootstrap.

## Listener, Re-enable, and Reconnect Lifecycle

### ON

1. Attach the provider's stable handler with `socket.on('leaderboard:update', handler)`.
2. Start current-session catch-up only after subscription is registered.
3. On every safe invalidation, ignore event `topK` as viewer state and refetch SCORE plus the retained active criterion when different.
4. Commit only if viewer key, identity generation, request generation, and watermark are still current.

### OFF

1. Remove the same handler reference with `socket.off('leaderboard:update', handler)`.
2. Keep preference, current-viewer snapshots, sort, selection, and timestamps.
3. Ignore leaderboard events and reconnect as automatic refresh causes.
4. Do not disconnect the shared socket and do not affect loop/queue/connection listeners.

### Re-enable

Attach first, then refetch. An event racing with catch-up creates a newer request generation; the older response cannot commit. Repeated toggles leave one handler when ON and zero when OFF.

### Reconnect

The provider observes the shared Infrastructure connection status. A transition back to connected reconciles current-session REST only when ON. OFF remains OFF and frozen. Reconnect never writes the preference.

## Identity and Request Race Protection

1. Derive the current viewer key from `useAuth()` only after `loading` is false.
2. Every cache envelope and request captures `viewerKey`, `identityGeneration`, and `requestGeneration`.
3. Context selectors return a snapshot only when its viewer key equals the current resolved viewer. Therefore the render caused by A->B or A->anonymous exposes loading/empty state, never A data.
4. In a provider layout effect, a viewer-key change advances identity generation, aborts all old controllers, clears memory/watermarks/selection, and removes the old persisted envelope before the new screen paints.
5. The stable event handler reads the latest viewer reference; it does nothing while identity is unresolved.
6. A response commits only when its captured viewer/generations still match. Successful delayed A responses are discarded for B/anonymous even if transport abort was ineffective.
7. The browser-local ON/OFF preference is not identity-owned and survives the transition without being toggled.

## Source Code Structure

### Create

- `workspace/apps/frontend/src/contexts/leaderboard-live-context.tsx`: provider, typed context, cache hydration/persistence, one handler, reconciliation, identity generation, and consumer hook.
- `workspace/apps/frontend/src/contexts/leaderboard-live-context.spec.tsx`: provider lifecycle, persistence, off-route, reconnect, cleanup, anonymous/A/B, and delayed-request tests.

### Modify

- `workspace/apps/frontend/src/app/layout.tsx`: insert provider at the canonical boundary.
- `workspace/apps/frontend/src/hooks/use-leaderboard-live-preference.ts`: keep storage parsing/notification as provider-internal support; export no page ownership behavior.
- `workspace/apps/frontend/src/hooks/use-dashboard-summary.ts`: retain global loop/queue summary subscriptions and fetches; consume provider SCORE leaderboard and remove every `leaderboard:update` registration.
- `workspace/apps/frontend/src/hooks/use-dashboard-summary.spec.tsx`: assert composition from provider and zero page-level leaderboard handlers.
- `workspace/apps/frontend/src/hooks/use-leaderboard.ts`: become a context adapter for active criterion, selection, snapshot, and explicit refetch; remove socket/preference/listener ownership.
- `workspace/apps/frontend/src/hooks/use-leaderboard.spec.tsx`: assert shared cache consumption, stable sort/selection, and zero independent listener.
- `workspace/apps/frontend/src/services/api-client.ts`: allow provider leaderboard reads to receive an optional `AbortSignal`; HTTP paths and response fields remain unchanged.
- `workspace/apps/frontend/src/app/leaderboard/page.tsx`: consume provider-backed hook; use Infrastructure only for connection presentation, not listener injection.
- `workspace/apps/frontend/src/app/page.tsx` and `workspace/apps/frontend/src/app/page.spec.tsx`: preserve the existing Dashboard-facing hook contract while sourcing Live state/SCORE snapshot from provider.
- `workspace/apps/frontend/src/components/common/app-shell.spec.tsx`: verify canonical provider placement/lifetime and that route consumers do not own socket teardown.
- `workspace/apps/frontend/e2e/leaderboard.spec.ts`: add real client-side navigation, reload/restart-state, reconnect, listener-count, and identity-transition scenarios.
- `workspace/apps/frontend/e2e/infrastructure-fixture.mjs`: support deterministic current-session snapshots, delayed A responses, identity changes, reconnect, and safe invalidation only; no production room/auth protocol.

### SDD Artifacts

- `sdd_artifacts/per-user-leaderboard-live-toggle/plan.md`
- `sdd_artifacts/per-user-leaderboard-live-toggle/research.md`
- `sdd_artifacts/per-user-leaderboard-live-toggle/data-model.md`
- `sdd_artifacts/per-user-leaderboard-live-toggle/contracts/leaderboard-realtime.md`
- `sdd_artifacts/per-user-leaderboard-live-toggle/quickstart.md`

No backend source, Prisma schema/migration, KB YAML wire contract, or auth contract change is planned.

## Implementation Phases

### Phase 0 - Preserve Delivered Backend and Contract Baseline

1. Run existing scoped REST, safe-invalidation, USER/null propagation, and global-loop tests as regression gates.
2. Add source assertions that `kb/contracts/events.yaml` and `kb/contracts/auth.yaml` remain wire-compatible.

### Phase 1 - RED Provider Contract Tests

1. Add failing provider tests for default OFF, persisted ON/OFF, one handler, subscribe-before-refetch, event/refetch races, and exact cleanup.
2. Add failing navigation tests proving Dashboard and `/leaderboard` unmounts do not clean up provider state/listener.
3. Add failing anonymous/A/B and A->B/A->anonymous tests, including a delayed A response that resolves successfully after the boundary.
4. Add failing reload/cache-hydration and reconnect ON/OFF tests.

### Phase 2 - Provider and Root Ownership

1. Implement the provider context, persisted viewer envelope, criterion cache, stable handler, and request/identity generations.
2. Mount it below Auth/Infrastructure in `app/layout.tsx`.
3. Add optional `AbortSignal` support to the internal leaderboard REST client.

### Phase 3 - Route Consumer Refactor

1. Convert `useDashboardSummary` to compose provider SCORE Top-5 with its global loop/queue state.
2. Convert `useLeaderboard` and `/leaderboard` to the provider's active snapshot/view state.
3. Remove all page-hook `leaderboard:update` registrations and page-unmount cleanup for this feature.
4. Preserve the accessible toggle and its explicit statement that OFF does not stop the system loop.

### Phase 4 - Integration and E2E

1. Validate ON and OFF through Dashboard -> other route -> `/leaderboard` -> Dashboard.
2. Validate off-route invalidation, return-to-Dashboard cache continuity, subscribe-before-refetch, and reconnect.
3. Validate provider cleanup separately from page unmount.
4. Validate anonymous, A, B, A->B, A->anonymous, and delayed A responses.

### Phase 5 - Full Verification

Run targeted frontend suites, full frontend tests, TypeScript, builds, feature-scoped configured lint rules plus non-mutating format checks with diff inspection, backend regression gates, Playwright, and `git diff --check`. Repository-wide lint/format remains a diagnostic for separately owned technical debt and does not block this feature when the exact feature file set is clean; this feature-scoped release-gate interpretation was explicitly approved on 2026-08-24.

## Requirement and Acceptance Mapping

| Spec coverage | Design/verification |
|---------------|---------------------|
| US1 scenarios 1-9; FR-001..007, FR-020; SC-001..003 | Delivered backend scoped REST/identity propagation remains a regression gate; provider accepts only current-session REST snapshots. |
| US2 scenarios 1-5; FR-008..009, FR-017; SC-007..008 | Global loop remains backend-owned/read-only; provider and toggle issue zero loop lifecycle calls. |
| US3 scenarios 1-9; FR-010..018, FR-022; SC-004..007, SC-010 | Preference/cache model, accessible toggle, subscribe-before-refetch, exact handler, OFF freeze, sort/selection preservation, and shared-socket isolation tests. |
| US4 scenarios 1-9; FR-019..021, FR-027, FR-030; SC-003, SC-006..008, SC-012 | Safe-invalidation regression plus provider reconnect/cleanup and three-actor integration tests. |
| US5 scenarios 1-8; FR-011, FR-014..016, FR-023..027; SC-005..006, SC-009..010, SC-012 | Root placement, route-navigation tests, off-route REST reconciliation, shared `/leaderboard` cache, and provider-only cleanup. |
| US5 scenarios 9-14; FR-019..020, FR-028..030; SC-011 | Viewer-stamped hydration, render gating, abort plus dual generation checks, and A->B/A->anonymous delayed-response tests. |

All 30 functional requirements, 46 acceptance scenarios, and 12 success criteria map to either the delivered regression baseline or the cross-route provider work above.

## Superseded Decisions

- The old Phase 4 statement `liveUpdatesEnabled (default true)` is superseded by persisted explicit choice with absent/invalid storage defaulting OFF.
- Page hooks owning `leaderboard:update` and cleaning it up on Dashboard or `/leaderboard` unmount are superseded by provider-only ownership and cleanup.
- The old research decision to separate leaderboard listener effects inside `useDashboardSummary` is superseded by removing the listener from that hook entirely.
- `/leaderboard` being an independent always-live hook/cache is superseded by provider-backed state.
- Memory-only snapshot ownership is superseded by a viewer-stamped accepted cache envelope so OFF can remain frozen through reload/restart without rendering a prior identity.
- Earlier references to a stale Search Loop KB conflict are superseded; the 2026-08-24 KB now consistently defines one global system process.

## Known Conflict and Mitigation

- **Pre-existing Auth contract drift**: `kb/contracts/auth.yaml` says an invalid/expired bearer token returns 401, while `SupabaseJwtGuard` currently catches verification failure and continues as anonymous. This plan does not change auth semantics because the request explicitly forbids it. The provider treats the resulting verified AuthContext identity as authoritative, never reuses an old viewer cache, and the drift remains an Auth-owner follow-up.
- **Version documentation drift**: KB lists Next.js 15/Jest 29 while the checked workspace uses Next.js 16.3/Jest 30. The plan uses installed versions and introduces no upgrade. This is non-blocking.

There is no remaining conflict among the feature spec, leaderboard/search-loop KB flows, event wire contract, and selected provider architecture.

## Constitution Re-check After Design

All gates remain PASS. The design adds no technology, backend module, wire/auth field, room protocol, namespace, database model, migration, client privacy filter, shared-socket disconnect, or per-user Search Loop. No Complexity Tracking exception is required.

## Complexity Tracking

No constitution violation requires justification.
