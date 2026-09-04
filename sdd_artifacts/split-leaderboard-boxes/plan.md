# Implementation Plan: Split Leaderboard Boxes

**Feature**: `split-leaderboard-boxes` | **Date**: 2026-08-25 | **Spec**: `spec.md`

## Summary

Extend the existing `GET /api/leaderboard` read contract with an optional `scope=system|mine|combined` query. Omission resolves to `combined`, preserving anonymous system-only and authenticated system-plus-current-user behavior for existing callers and Dashboard. The same optional scope is accepted by the existing detail route so a selection remains tied to the server-authorized projection from which it came; omission there also preserves combined behavior.

The full `/leaderboard` route performs two independent authoritative reads for one shared ranking criterion: `system` and, when authenticated, `mine`. Scope visibility is resolved in the backend before best-per-version selection, deterministic sorting, Top-K, view-local rank, `updatedAt`, and detail lookup. No combined Top-K is filtered in the browser.

The existing application-level leaderboard provider remains the sole realtime invalidation owner. Its cache/request identity expands from criterion-only keys inside one exact-viewer envelope to projection keys containing viewer, criterion, and scope. One `leaderboard:update` handler treats the system-only payload as invalidation and reconciles the distinct REST projections currently maintained by the provider. Dashboard remains a combined SCORE consumer and the global Search Loop remains unchanged.

## Technical Context

**Language/Version**: TypeScript 5.7.x; Node.js runtime in the npm workspace monorepo

**Primary Dependencies**: NestJS 11, Next.js 16.3.0, React 19.2, Prisma 6, Socket.IO 4.8, Supabase Auth

**Storage**: Existing PostgreSQL/Prisma schema and Redis/BullMQ are unchanged. Browser `localStorage` retains one replaceable exact-viewer leaderboard cache envelope with an explicit schema version.

**Testing**: Jest 30 backend unit/integration/E2E, Vitest 2 frontend unit/component/provider tests, Playwright 1.62 browser E2E

**Target Platform**: Browser client plus NestJS modular-monolith backend

**Project Type**: Full-stack web application/API

**Performance Goals**: System and Mine reads start in parallel; each returns at most configured Top-K; exact projection keys deduplicate identical in-flight work; one provider-owned leaderboard listener while Live is ON and zero while OFF; no per-card socket listeners.

**Constraints**: ADR-0011 observer boundary and ADR-0016 app-level authorization; existing nullable ownership; no migration, RLS, endpoint proliferation, socket room/handshake/namespace/private payload, per-user loop, client-side authorization, or Dashboard UI split.

## Constitution Check

*GATE: PASS before research and PASS after the completed design below.*

| Principle | Status | Evidence |
|---|---|---|
| I. Architecture Quality | PASS | Scope extends the existing Leaderboard boundary; Frontend consumes it through the existing provider and API client. Observer production and Search Loop ownership do not change. |
| II. Contract-Driven | PASS | `contracts/leaderboard-rest.md` and `contracts/leaderboard-provider.md` define the query, default, error, cache, and invalidation behavior before implementation. |
| III. Demonstrable Extension Points | PASS | The supported scope enum is exercised through controller/repository matrices and can be demonstrated without a new module or transport. |
| IV. Simplicity Over Cleverness | PASS | Reuses one endpoint, one provider, one socket listener, current auth, and current Prisma model. |
| V. Knowledge Base as Truth | PASS | Design follows KB Event Infrastructure, Auth, leaderboard flow, global Search Loop, DESIGN, GLOSSARY, ADR-0011, and ADR-0016. |
| VI. Explicit Over Implicit | PASS | Scope values, default combined behavior, anonymous Mine semantics, projection keys, identity generations, and selection source scope are named contracts. |
| Security constraint | PASS | Only server-filtered REST responses enter scope caches; websocket `topK` and browser filtering never authorize or construct Mine data. |

## Architecture Decision

### Verified Baseline and Dependency

| Area | Verified source/test baseline | Plan action |
|---|---|---|
| REST list/detail | `leaderboard.controller.ts` resolves optional identity and accepts only `sortBy`; omission currently produces caller-scoped combined output. | Add one shared scope pipe to list and detail; default to `combined`. |
| Repository | `visibilityWhere(viewerUserId)` is system for anonymous and system-plus-viewer for authenticated calls; filtering precedes projection. | Replace it with one scope-plus-viewer visibility resolver used by list, timestamp, and detail paths. |
| Ranking | Best-per-version, deterministic criterion sort, Top-K slice, and response-local rank already occur after the Prisma visibility query. | Preserve ordering and run it independently per scope. |
| Realtime | ADR-0011 observer publishes system-only Top-K; PushGateway relays one namespace-wide `leaderboard:update`. | No wire change. Provider ignores `event.topK` as state and performs scoped REST reads. |
| Provider | `leaderboard-live-context.tsx` owns one listener, one exact-viewer v1 envelope, identity/request generations, aborts, watermarks, SCORE plus active criterion. | Extend the projection key to `(scope, criterion)` under the exact viewer and independently track projection state. |
| Dashboard | `DashboardService` calls `getLeaderboard(SCORE, viewer)` and frontend consumes provider `scoreSnapshot`. | Make combined explicit internally or rely on the documented default; keep response and UI combined SCORE. |
| Route auth | `middleware.ts` treats every route except login/register as protected. | Make `/leaderboard` public while retaining auth-derived Mine authorization and protected behavior for other routes. |
| Baseline release gate | `per-user-leaderboard-live-toggle` has T041 full E2E and T042 manual 13-scenario validation pending. | Carry these forward as a prerequisite release phase and extend their matrix for the two projections. |

### Scope Contract

Add `LeaderboardScope` to the shared enum source:

```ts
enum LeaderboardScope {
  SYSTEM = 'system',
  MINE = 'mine',
  COMBINED = 'combined',
}
```

`LeaderboardScopePipe` follows the existing `LeaderboardSortPipe` pattern:

- `undefined` or an empty query value resolves to `LeaderboardScope.COMBINED`.
- A valid literal passes unchanged.
- Any other explicit value returns HTTP 400 with stable code `INVALID_LEADERBOARD_SCOPE`.
- Controller identity continues to come only from `@CurrentUser()` under `SupabaseJwtGuard`; scope never accepts a user ID.

Both existing routes accept scope:

```text
GET /api/leaderboard?sortBy=<criterion>&scope=<scope>
GET /api/leaderboard/:strategyVersionId?scope=<scope>
```

The detail route does not add `sortBy`; it preserves its current SCORE-best detail selection after applying the requested visibility scope. Existing clients that omit scope receive the existing combined authorization behavior.

### Repository Visibility and Projection Order

Define one pure visibility resolver with the semantic result `Prisma where | no-authorized-rows`:

| Scope | Viewer | Visibility result |
|---|---|---|
| `system` | anonymous or authenticated | `{ userId: null }` |
| `mine` | authenticated A | `{ userId: A }` |
| `mine` | anonymous | no-authorized-rows sentinel |
| `combined` | anonymous | `{ userId: null }` |
| `combined` | authenticated A | `{ OR: [{ userId: null }, { userId: A }] }` |

Repository methods receive `(scope, viewerUserId)` and use this resolver before touching projection logic. The no-authorized-rows result short-circuits list to `[]`, detail to `null`, and timestamp to `new Date(0)`; it does not issue a broad Prisma query or invent a fake identity.

For every non-empty projection, the enforced order is:

```text
scope + verified viewer predicate
  -> visible rows only
  -> deterministic best entry per strategyVersionId for criterion
  -> deterministic criterion sort and existing tie rules
  -> configured Top-K
  -> response-local rank 1..N
  -> scope-local updatedAt from visible rows
```

Detail applies the same visibility resolver before locating the SCORE-best entry for the requested strategy version. A foreign existing ID and nonexistent ID therefore both return the existing stable 404 without invoking the Strategy result port.

`rerank()` remains the existing global persistence compatibility path. Public ranks continue to be recomputed from the filtered projection, so no persisted per-user rank or migration is introduced.

### REST and API Client Compatibility

`LeaderboardSnapshot` is unchanged: `rankingCriterion`, `updatedAt`, and `entries`. Scope is request context, not a new response field. An empty scope returns `entries: []` and `updatedAt` at the existing neutral epoch value.

The frontend client extends `getLeaderboard` and `getLeaderboardDetail` with typed scope options while retaining the shared `apiRequest` path. `apiRequest` still resolves the current Supabase session and adds the bearer token exactly as it does today; callers cannot supply or suppress ownership identity through the new options. Query strings use `URLSearchParams`, and omitted scope remains omitted for legacy/Dashboard calls.

### Provider Projection, Cache, and Race Model

Use an explicit projection key:

```text
projectionKey = scope + ':' + rankingCriterion
accepted identity = viewerKey + identityGeneration + projectionKey + requestGeneration
```

The provider keeps one exact-viewer envelope, upgraded to a v2 schema/key so v1 criterion-only entries cannot collide with scoped entries. The envelope stores:

- exact `viewerKey` (`anonymous` or verified user ID);
- shared `activeCriterion`;
- optional selected strategy `{ strategyVersionId, sourceScope }`;
- accepted snapshots indexed by `scope` then `criterion`;
- per-projection persisted/accepted timestamps.

This is equivalent to a full viewer-plus-criterion-plus-scope cache key because the envelope is accepted only when its viewer exactly equals the resolved current viewer. Unknown, malformed, v1, or mismatched envelopes are discarded rather than row-filtered or migrated into a scope.

Request generations, AbortControllers, and watermarks move from criterion keys to projection keys. A commit requires the same viewer, identity generation, scope, criterion, request generation, and current maintained-projection eligibility. Each projection has independent `loading`, `error`, `isStale`, `lastSuccessfulAt`, and retry state; one failure retains only its own same-identity last successful snapshot.

Before A -> B or A -> anonymous can render, the provider advances identity generation, aborts all A projection/detail requests, clears accepted snapshots, selection, detail eligibility, watermarks, and the A envelope. Exact-viewer selectors return no snapshot during unresolved identity. The Live preference remains browser-wide and unchanged.

### Maintained Projections and Realtime Invalidation

The provider remains mounted below Auth and Infrastructure and above routes. Consumers never receive the socket and never register `leaderboard:update`.

- Combined SCORE remains maintained for Dashboard compatibility.
- The full leaderboard consumer requests and retains System plus Mine for the shared active criterion. Anonymous may skip the Mine HTTP request and use the contract-defined neutral Mine state.
- Exact duplicate `(scope, criterion)` reads are deduplicated; distinct projections start in parallel.
- While Live is ON, subscription occurs before catch-up. Invalidation and reconnect reconcile all current-identity projections being maintained: combined SCORE plus System/Mine active criterion as applicable.
- While Live is OFF, events and reconnect do not reconcile; explicit sort/retry/bootstrap reads remain allowed without changing the preference.
- Event fields, including `topK`, never populate System, Mine, or Combined caches. The event is only a freshness signal.
- The existing stable handler is attached once and removed by exact reference. Two cards add zero listener count.

After `/leaderboard` has established System/Mine projections, the application-lifetime provider may retain them across navigation consistently with the baseline cross-route behavior. Pruning keeps only combined SCORE and System/Mine for the active criterion, preventing abandoned criteria from becoming silently reusable stale data.

### Performance Cost

The split route requires two authoritative scoped HTTP reads rather than one combined read. They run concurrently, so latency is approximately the slower scoped read rather than their sum, but backend query/serialization load is roughly doubled for that route. The provider can perform up to three distinct leaderboard reads in a reconciliation cycle when it also maintains Dashboard combined SCORE. This is deliberate because independent truncated Top-K snapshots cannot be reconstructed securely from combined Top-K or from each other.

Mitigations are bounded and do not change semantics: deduplicate exact projection keys, abort superseded requests, retain only active projections, skip anonymous Mine HTTP, cap every result at existing Top-K, and add query-count/request-count assertions. No client merge becomes authoritative.

### UI Composition and State Ownership

`/leaderboard` owns one shared ranking criterion control above the workspace. Both cards receive that criterion and use the same sortable column actions.

Desktop composition is a two-column workspace: the left column stacks System Leaderboard then My Strategies vertically; the right column contains the shared Strategy Detail. The two wide financial tables are never placed side by side. Mobile becomes one column in the order System, Mine, Detail. Each populated card owns an `overflow-x-auto` region and retains all financial columns.

Generalize `LeaderboardTable` to receive heading, description, unique heading ID, unique table accessible name, projection state, and source scope. Required content:

| Card | Heading | Description/state behavior |
|---|---|---|
| System | `System Leaderboard` | Explains global Search Loop/system-owned strategies; empty state says no system strategies are ranked. |
| Mine authenticated | `My Strategies` | Explains current-user entries; empty state includes one primary link to `/strategy`. |
| Mine anonymous | `My Strategies` | Accessible sign-in explanation and keyboard-reachable link to `/login?redirect=/leaderboard`; no private read required. |

Loading, initial error, stale-with-data, empty, and retry are rendered per card. A stale card keeps its own timestamp and data; the other card remains usable. Unique region headings and table names distinguish both projections to assistive technology.

Selection is shared but scope-aware: `{ strategyVersionId, sourceScope }`. Selecting either table sets that pair and detail calls the existing detail route with the same scope. URL selection without source scope uses combined for backward-compatible Dashboard deep links, then may be rebound to a visible System/Mine source after projections resolve. Identity transition clears all selection before paint. Sort/scope refresh clears a selection if the strategy is absent from its source projection; detail requests also capture viewer, identity generation, scope, and strategy ID so late private detail cannot commit.

### Dashboard and Global Loop Non-Interference

Dashboard preview remains combined SCORE, Top-5, and visually unchanged. Backend Dashboard viewer identity still reaches only Leaderboard; loop and queue reads stay global and zero-argument. Sort, selection, retry, route navigation, Live preference, reconnect, and scope reads issue no loop lifecycle command. ADR-0011 event production and the one global `SearchLoopRun` remain unchanged.

## Source Code Structure

### Create

- `workspace/apps/frontend/src/app/leaderboard/page.spec.tsx`: two-card route states, shared sort, anonymous/empty states, selection clearing, and responsive source-order tests.
- `workspace/apps/frontend/src/middleware.spec.ts`: public `/leaderboard` and protected-route regression.
- `sdd_artifacts/split-leaderboard-boxes/contracts/leaderboard-rest.md`
- `sdd_artifacts/split-leaderboard-boxes/contracts/leaderboard-provider.md`

### Modify

- `workspace/libs/shared/src/types/enums.ts`: add `LeaderboardScope`.
- `workspace/apps/backend/src/leaderboard/leaderboard.dto.ts`: add scope pipe and stable invalid-scope error.
- `workspace/apps/backend/src/leaderboard/leaderboard.controller.ts`: accept scope on list/detail.
- `workspace/apps/backend/src/leaderboard/leaderboard.service.ts`: pass scope to projection/detail repository reads while keeping event publication explicitly system-scoped.
- `workspace/apps/backend/src/leaderboard/leaderboard.repository.ts`: central scope-plus-viewer resolver and no-authorized-rows short-circuit.
- Backend leaderboard controller/service/repository/integration specs and `test/per-user-leaderboard.e2e-spec.ts`: RED/GREEN scope and privacy matrices.
- `workspace/apps/backend/src/dashboard/dashboard.service.ts` and existing Dashboard specs: preserve or explicitly select combined SCORE.
- `workspace/apps/frontend/src/services/api-client.ts`: typed list/detail scope options with unchanged auth resolution.
- `workspace/apps/frontend/src/contexts/leaderboard-live-context.tsx`: v2 scoped cache, projection state, maintained-scope reconciliation, and scope-aware selection.
- `workspace/apps/frontend/src/contexts/leaderboard-live-context.spec.tsx`: cache collision, partial state, listener, realtime/reconnect, and identity races.
- `workspace/apps/frontend/src/hooks/use-leaderboard.ts` and spec: expose System/Mine states plus shared criterion/selection without listener ownership.
- `workspace/apps/frontend/src/components/leaderboard/leaderboard-table.tsx` and spec: reusable named card/table with independent state and scroll region.
- `workspace/apps/frontend/src/components/leaderboard/leaderboard-detail.tsx` and spec: source scope plus viewer/request generation-safe detail lifecycle.
- `workspace/apps/frontend/src/app/leaderboard/page.tsx`: stacked two-card workspace and shared detail.
- `workspace/apps/frontend/src/middleware.ts`: make `/leaderboard` public.
- `workspace/apps/frontend/e2e/infrastructure-fixture.mjs` and `workspace/apps/frontend/e2e/leaderboard.spec.ts`: scoped fixture data and browser matrix.

### Regression-Only / No Production Change Expected

- `workspace/apps/backend/src/dashboard/push.gateway.ts` and event contracts: exact system-safe relay remains unchanged.
- `workspace/apps/frontend/src/components/dashboard/leaderboard-preview.tsx`: remains combined.
- `workspace/apps/backend/prisma/schema.prisma` and migrations: audit only.
- Search Loop controllers/services/models: audit and non-interference tests only.

## Implementation Phases

### Phase 0 - Prerequisite and Contract Gate

1. Record or complete baseline `per-user-leaderboard-live-toggle` T041 full E2E and T042 manual matrix; any failure affecting identity/provider semantics blocks release of this feature.
2. Add shared scope and REST/provider contract tests in RED before production changes.
3. Audit Prisma schema/migrations, event wire, socket namespace, and Search Loop source to establish unchanged baselines.

### Phase 1 - Backend RED/GREEN Scope Projection

1. RED: scope pipe default/valid/invalid controller tests and list/detail delegation tests.
2. RED: repository matrices for System, Mine A, Mine B, anonymous Mine, Combined, best-per-version-before-Top-K trap, continuous ranks, independent timestamps, and detail anti-enumeration.
3. GREEN: shared enum, pipe, controller/service signature, central visibility resolver, and repository short-circuit.
4. RED/GREEN integration and E2E for query behavior, default compatibility, Dashboard combined regression, and system-safe event publication.

### Phase 2 - Frontend API and Provider RED/GREEN

1. RED: API URL construction and bearer-token semantics for list/detail scopes.
2. RED: v2 exact-viewer scoped envelope, no v1 hydration, no projection collision, independent projection states, in-flight deduplication, and pruning.
3. RED: one/zero listener lifecycle, safe invalidation fan-out, reconnect ON/OFF, event payload distrust, and partial failure.
4. GREEN: scoped API options and provider projection-key implementation while retaining combined SCORE for Dashboard.
5. RED/GREEN: A -> B, A -> anonymous, delayed list/detail responses, old cache rejection, and selection clearing.

### Phase 3 - Route and Components RED/GREEN

1. RED: middleware permits anonymous `/leaderboard` and still protects other authenticated routes.
2. RED: unique System/Mine region/table names, headings/descriptions, shared sort, independent loading/error/stale/empty/retry, sign-in state, and `/strategy` CTA.
3. RED: System/Mine selection drives one scoped detail; disappearing/out-of-scope selections clear.
4. GREEN: reusable card/table props, shared sort control, vertically stacked leaderboard column plus detail column, and public route policy.
5. RED/GREEN: mobile source order and one horizontal scroller per populated table without dropping columns.

### Phase 4 - Integration, E2E, and Release Validation

1. Backend three-actor matrix: anonymous, A, B; explicit scopes; default combined; independent Top-K/rank/timestamp; detail anti-enumeration.
2. Browser matrix: anonymous, A, B, empty Mine, sort, partial failure/stale, Live ON invalidation, reconnect ON/OFF, identity switch, delayed response, scoped detail, Dashboard regression, and mobile.
3. Assert one provider listener, zero card/hook listeners, expected REST request counts, no use of `event.topK`, and zero Search Loop commands.
4. Run targeted suites, full package tests/builds, Playwright, schema/migration audit, and `git diff --check`; record results in the later validation artifact.

## RED/GREEN Test Matrix

| Layer | RED proof before change | GREEN/regression proof |
|---|---|---|
| Shared/DTO unit | enum literals; omitted/empty default combined; invalid stable 400 | all literals exported and pipe behavior stable |
| Repository unit | System/Mine/Combined predicates; anonymous Mine short-circuit; filter-before-best/sort/Top-K; ranks `1..N`; scope timestamps | no foreign query/result influence; deterministic existing tie behavior retained |
| Service/controller unit | scope delegated to list/detail; old call shape defaults combined; event publisher requests System | unchanged `LeaderboardSnapshot`; private trigger remains redacted |
| Backend integration | explicit query scopes for anonymous/A/B; Mine below combined cutoff; timestamp isolation; foreign/nonexistent detail symmetry | Dashboard combined SCORE and global loop/queue regression |
| Backend E2E | real HTTP optional auth, invalid query, A/B privacy, websocket system-safe invalidation | no schema/wire/namespace changes |
| API client unit | query encoding for list/detail and omitted scope | bearer token still solely session-derived; AbortSignal preserved |
| Provider unit | `(viewer, scope, criterion)` isolation; v1 rejection; partial failure; dedup; one listener; event payload ignored | ON invalidation/reconnect reconciles maintained scopes; OFF freezes |
| Identity/provider integration | A -> B, A -> anonymous, delayed A scope/detail, old envelope | no old row/metadata/selection/detail render or commit |
| Component/page | unique headings/table names; independent states; shared sort; CTA/sign-in; scoped selection | desktop vertical table stack; mobile System/Mine/Detail order and separate scroll |
| Playwright E2E | anonymous/A/B/empty/sort/realtime/reconnect/identity/detail/mobile | Dashboard remains combined; listener count and loop-command count unchanged |

## Requirement Traceability

| Requirement group | Design and validation |
|---|---|
| FR-001..007 | Scope contract, public route policy, two named cards, default compatibility, stable invalid scope |
| FR-008..015 | Central visibility resolver, filter-first projection, scope-local metadata, detail anti-enumeration |
| FR-016..025 | Shared criterion and selection, independent projection states, accessible cards/tables, desktop/mobile composition |
| FR-026..032 | Single provider, safe invalidation, scoped REST reconciliation, OFF freeze, exact-viewer/generation boundaries |
| FR-033..035 | Combined Dashboard regression, schema/socket/global-loop audits, zero loop commands |
| SC-001..012 | Backend three-actor matrix plus provider/component/Playwright and audit gates in Phase 4 |

## Complexity Tracking

No Constitution violation or exception is requested. The cache schema expands because two independent projections cannot share a criterion-only slot; it remains one replaceable exact-viewer envelope and one provider rather than introducing a cache library or second realtime owner.

