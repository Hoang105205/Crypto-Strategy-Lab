# Research: Per-User Leaderboard Live Toggle

## Codebase Baseline

The checked workspace already implements the original feature's backend ownership propagation, scoped Leaderboard REST reads, privacy-safe system-only `LeaderboardUpdated` publication, exact gateway relay, read-only global-loop UI, and browser-persisted preference. Backend/shared contracts therefore remain regression gates, not new implementation work.

The cross-route amendment is not implemented. `app/layout.tsx` currently mounts `AuthProvider -> InfrastructureProvider -> AppShell`; both `use-dashboard-summary.ts` and `use-leaderboard.ts` independently read the preference, own cache/request generations, and attach `leaderboard:update`. Consequently navigation destroys page cache/handler state, `/leaderboard` can compete with Dashboard, off-route invalidations are missed, and there is no app-level A->B/A->anonymous cache boundary.

The existing preference helper correctly uses `crypto-strategy-lab:leaderboard-live`, restores explicit true/false values, and defaults false for absent, malformed, SSR, or unavailable storage. It should become an internal dependency of the provider rather than remain page-owned.

## Decisions

### D1: Preserve repository-level viewer scoping

- **Chosen**: Keep explicit `currentUserId: string | null` propagation and repository filtering before best-per-version, sorting, Top-K, detail, rank, and `updatedAt` projection.
- **Rationale**: This delivered boundary prevents both row and metadata disclosure. The frontend provider must consume, not duplicate, this authorization policy.
- **Alternatives considered**: Controller filtering, RLS, or client filtering remain rejected.
- **KB reference**: `kb/contracts/auth.yaml`; ADR-0016; `kb/flows/leaderboard-update.md` BR-10.

### D2: Preserve request-origin ownership propagation

- **Chosen**: Keep `BacktestRequested.userId -> BacktestResult.userId -> BacktestCompleted.userId -> LeaderboardEntry.userId`, with SEARCH_LOOP always null.
- **Rationale**: Already implemented and required for scoped REST snapshots.
- **Alternatives considered**: Inferring from strategy or loop identity remains rejected.
- **KB reference**: `kb/contracts/events.yaml`; `contracts/userid-propagation.md`.

### D3: Preserve system-safe invalidation plus current-session REST

- **Chosen**: Keep the existing `leaderboard:update` payload unchanged and treat it only as invalidation. The provider calls REST, whose API client reads the Supabase session at request time.
- **Rationale**: It is the current KB architecture and avoids private socket payloads without rooms or handshake identity.
- **Alternatives considered**: Applying event `topK`, client privacy filtering, authenticated rooms, and a new channel remain rejected.
- **KB reference**: `kb/contracts/events.yaml`; `kb/flows/leaderboard-update.md` BR-9; Constitution IV.

### D4: Keep exact gateway relay and publisher safety

- **Chosen**: No PushGateway or event contract change. Existing backend tests continue to prove system-only `topK` and private-trigger redaction.
- **Rationale**: Cross-route ownership is a frontend lifecycle concern; moving privacy logic into transport would duplicate policy.
- **KB reference**: ADR-0011; `kb/modules/event-infrastructure.md`.

### D5: Use subscribe-before-refetch in the app provider

- **Chosen**: On persisted ON or explicit re-enable, the provider attaches its stable handler before starting current-session catch-up. Each later signal advances request generation; watermark checks prevent rollback.
- **Rationale**: Closes the missed-update window and preserves the delivered race rule at the correct lifetime boundary.
- **Alternatives considered**: Refetch-first, applying socket rows, or reconnecting the shared socket are rejected.
- **KB reference**: `kb/flows/leaderboard-update.md`; FR-014.

### D6: Move all leaderboard listener ownership out of page hooks

- **Chosen**: `LeaderboardLiveProvider` is the only `leaderboard:update` subscriber. `useDashboardSummary` retains loop/queue behavior, while `useLeaderboard` becomes a context adapter.
- **Rationale**: Keeping a separate listener effect inside either hook still makes page lifetime a cleanup boundary and permits duplicates.
- **Alternatives considered**: Coordinating two page hooks through a module singleton is rejected because it obscures React ownership and identity rendering boundaries.
- **KB reference**: `kb/DESIGN.md` Application Shell; `kb/flows/leaderboard-update.md` BR-11.

### D7: Keep LoopStatusPanel read-only for loop lifecycle

- **Chosen**: Retain the accessible Live updates switch and read-only global Search Loop state; add no start/pause/resume/stop calls.
- **Rationale**: The 2026-08-18 decision is now synchronized across the KB.
- **Alternatives considered**: Disabled loop controls or reusing loop callbacks for Live remain rejected.
- **KB reference**: `kb/flows/strategy-search-loop.md`; `kb/DESIGN.md` Dashboard.

### D8: Preserve global backend loop endpoints without viewer ownership

- **Chosen**: No loop controller/service/repository change. Operational endpoints remain global compatibility surfaces and the browser toggle calls none of them.
- **Rationale**: Cross-route frontend ownership must not expand into per-user loop semantics.
- **KB reference**: `kb/contracts/auth.yaml` `does_not_apply_to`; `kb/flows/strategy-search-loop.md` BR-1..3.

### D9: Preserve viewer-local ranks and metadata

- **Chosen**: Cache REST snapshots exactly as returned after server scoping. Never recompute privacy scope or apply event rows on the client.
- **Rationale**: Server output already contains the only authoritative Top-K/rank/`updatedAt` projection.
- **KB reference**: `kb/flows/leaderboard-update.md` BR-10.

### D10: No Prisma migration, new index, or server preference model

- **Chosen**: Use browser-local persistence only. PostgreSQL/Redis/schema remain unchanged.
- **Rationale**: Cross-device preference synchronization and new persistence are outside scope.
- **KB reference**: Constitution IV; feature assumptions/out-of-scope.

### D11: Mount one provider below Auth and Infrastructure

- **Chosen**: `AuthProvider -> InfrastructureProvider -> LeaderboardLiveProvider -> AppShell/routes` in `app/layout.tsx`.
- **Rationale**: The provider needs verified identity/session and the shared socket, and must outlive route segments.
- **Alternatives considered**:
  - Above Auth/Infrastructure: rejected because identity/socket prerequisites would be unavailable.
  - Inside `AppShell` route content: rejected because shell/route replacement could shorten lifetime.
  - One provider per page: rejected because it recreates the current defect.
- **KB reference**: `kb/DESIGN.md` Application Shell; FR-011, FR-023.

### D12: Keep SCORE plus the retained active criterion in one provider cache

- **Chosen**: Store accepted snapshots by `RankingCriterion`. SCORE is always maintained for Dashboard; the retained `/leaderboard` active criterion is maintained too when different. Dashboard renders SCORE Top-5, and `/leaderboard` renders the active snapshot.
- **Rationale**: One criterion-specific REST response may contain a different Top-K and cannot safely derive every other criterion. Maintaining SCORE plus one active criterion gives both routes current data with at most two requests per invalidation.
- **Alternatives considered**:
  - One arbitrary snapshot for both routes: rejected because Dashboard requires canonical SCORE order.
  - Refetch every supported criterion: rejected as unnecessary fan-out.
  - Leave `/leaderboard` cache in its page hook: rejected by FR-025.
- **KB reference**: `kb/flows/leaderboard-update.md` alternative sort path; FR-022..026.

### D13: Persist one current-viewer accepted cache envelope

- **Chosen**: Store accepted REST snapshots in `crypto-strategy-lab:leaderboard-cache:v1` with schema version and exact viewer key. Restore only after Auth resolves and only on an exact key match; otherwise discard the whole envelope. Do not filter cached or event rows client-side.
- **Rationale**: Preserves an OFF snapshot through reload/browser restart while preventing an A cache from rendering for B/anonymous. A single replaceable envelope ensures browser storage contains only the current viewer cache.
- **Alternatives considered**:
  - Memory-only cache: rejected because OFF would lose its snapshot at reload/restart.
  - Cache per user indefinitely: rejected because old private snapshots would remain in browser storage.
  - Persist event `topK`: rejected because the event is not the viewer snapshot.
- **KB reference**: `kb/DESIGN.md` Shared UI States; FR-010, FR-013, FR-028..029.

### D14: Gate render by viewer key and use abort plus dual generations

- **Chosen**: Cache selectors require the current resolved viewer key. A layout effect on identity change advances identity generation, aborts old requests, clears memory/storage/watermarks, then bootstraps the new viewer. Every response also checks request generation.
- **Rationale**: Abort alone is not reliable once a response is already resolving; generation alone does not prevent a one-render flash. Viewer gating plus both generations proves no old cache or delayed response can commit/render.
- **Alternatives considered**: Effect-only clearing, token comparison only, or component keys/remounts are rejected as incomplete or too implicit.
- **KB reference**: `kb/flows/leaderboard-update.md` Viewer identity transition; FR-028..029.

### D15: Distinguish automatic Live reconciliation from explicit OFF reads

- **Chosen**: OFF blocks event- and reconnect-driven refetch. A missing current-viewer cache may perform one bootstrap; an explicit sort/retry may fetch by user action. These reads do not change the preference and the resulting snapshot freezes again.
- **Rationale**: A first load must display authorized data even when default OFF, while OFF must never behave like a live subscription.
- **Alternatives considered**: No data at all until ON is rejected as conflating data access with Live; automatic polling while OFF is rejected as violating freeze.
- **KB reference**: `kb/flows/leaderboard-update.md` Live updates OFF/ON; FR-010, FR-012..015.

### D16: Observe reconnect through Infrastructure state

- **Chosen**: Use `InfrastructureProvider` connection status and reconcile only on a non-connected -> connected transition while ON. Do not add another socket owner or disconnect path.
- **Rationale**: Keeps connection lifecycle centralized and makes reconnect behavior testable without a second feature-level `connect` listener.
- **Alternatives considered**: Calling socket connect/disconnect or letting each page react independently are rejected.
- **KB reference**: `kb/modules/event-infrastructure.md` Cross-route Safe Invalidation Provider; FR-015, FR-018.

## Resolved Questions

- No clarification marker exists in the spec or requirements checklist.
- Explicit ON/OFF is browser-local and survives navigation, reload, restart, and identity change; no stored choice defaults OFF.
- OFF preserves an accepted current-viewer snapshot. Bootstrap/sort/retry are explicit reads, not automatic Live behavior.
- Anonymous, A, and B cache identity derives from resolved AuthContext; session/token is still read at REST request time.
- Page unmount is not cleanup; provider unmount is.
- `/leaderboard` and Dashboard share the provider but consume criterion-appropriate projections.
- No room, socket auth handshake, namespace, client privacy filter, shared disconnect, wire/auth change, migration, or per-user SearchLoopRun is introduced.

## Remaining External Drift

- `SupabaseJwtGuard` currently degrades an invalid/expired bearer token to anonymous, while `kb/contracts/auth.yaml` specifies 401. This is pre-existing Auth-owned drift and is not changed by this plan. It cannot authorize another user's cache because the provider clears/gates on resolved identity and REST remains server-scoped.
- `kb/ARCHITECTURE.md` lists Next.js 15/Jest 29 while the installed workspace uses Next.js 16.3/Jest 30. The implementation uses installed APIs and follows `workspace/apps/frontend/AGENTS.md`; no dependency upgrade is planned.
