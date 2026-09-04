# Research: Split Leaderboard Boxes

**Feature**: `split-leaderboard-boxes` | **Date**: 2026-08-25

## Inputs Reviewed

- KB Constitution, Architecture, Modules, Event Infrastructure, Auth, leaderboard-update flow, global strategy-search-loop flow, DESIGN, and GLOSSARY.
- ADR-0011 (Leaderboard as Observer) and ADR-0016 (app-level nullable-`userId` filtering).
- Current `split-leaderboard-boxes/spec.md` and PASS requirements checklist.
- `per-user-leaderboard-live-toggle` spec/plan/tasks/contracts plus pending T041-T042 release validation.
- Lessons for filter-before-project, system-safe invalidation, and cross-route exact-viewer provider ownership.
- Existing backend controller/service/repository/Dashboard code and unit/integration/E2E tests.
- Existing frontend API client, root provider, hooks, route, middleware, components, fixture, and Playwright tests.

## Decision 1: Extend the Existing Endpoint with an Explicit Scope Enum

**Decision**: Add shared `LeaderboardScope` literals `system`, `mine`, and `combined`; accept optional `scope` on existing list and detail routes; omission and empty value resolve to combined; invalid explicit values return stable `INVALID_LEADERBOARD_SCOPE` HTTP 400.

**Rationale**: One query parameter preserves existing paths and response types while making server-side projections explicit. Adding scope to detail binds a row selected from a box to the same authorization projection and satisfies filter-before-detail without a new endpoint.

**Alternatives rejected**:

- New `/system` and `/mine` endpoints: duplicates controller/contracts with no additional boundary value.
- Frontend filtering of combined: cannot recover entries below combined Top-K and creates privacy/metadata risk.
- Default system: breaks authenticated legacy clients and Dashboard combined preview.

## Decision 2: Resolve Visibility Once from Scope and Verified Viewer

**Decision**: A pure repository resolver returns the Prisma ownership predicate or a no-authorized-rows sentinel. Mine/anonymous short-circuits to empty list, epoch timestamp, or null detail.

**Rationale**: ADR-0016 places authorization in application queries. A single resolver makes list, metadata, and detail symmetric and reviewable. A sentinel is safer than an invented UUID or reliance on uncertain empty-OR ORM semantics.

**Alternatives rejected**:

- Separate ad hoc predicates in each repository method: higher risk of one metadata/detail path missing scope.
- Require authentication and return 401 for Mine: conflicts with the anonymous page/sign-in-state contract; privacy-neutral empty projection is sufficient.
- Query all then filter in service: private rows cross the repository boundary and can influence metadata accidentally.

## Decision 3: Preserve `LeaderboardSnapshot` and Neutral Empty Metadata

**Decision**: Scope remains request context. Response stays `LeaderboardSnapshot`; an empty scope returns `entries=[]`, requested `rankingCriterion`, and epoch `updatedAt`.

**Rationale**: Existing clients decode this shape and current repository already uses epoch for no visible rows. Adding scope/count fields would be unnecessary compatibility surface and could create side channels.

**Alternatives rejected**:

- Add response `scope`: useful for debugging but not needed to render or authorize and changes the shared wire.
- Reuse another scope's timestamp: leaks activity and violates scope-local metadata.

## Decision 4: Keep Detail SCORE-Best but Make Visibility Scope-Aware

**Decision**: Detail retains current behavior of selecting the SCORE-best entry for a strategy version after applying requested scope. It does not add sort criterion. Foreign and nonexistent identifiers return the same existing 404 before Strategy port access.

**Rationale**: This is the smallest compatible change. The feature needs ownership/source-scope correctness, not a redesign of which backtest result detail represents a strategy version.

**Alternatives rejected**:

- Add `sortBy` to detail: expands semantics beyond the spec and could change existing detail metrics.
- Always use combined detail for scoped rows: authorized but loses source-scope consistency and weakens explicit tests.

## Decision 5: Use One Exact-Viewer v2 Envelope with Scoped Projection Keys

**Decision**: Upgrade the provider cache to a v2 storage key/schema. Viewer remains the envelope gate; snapshots, controllers, request generations, and watermarks use `(scope, criterion)` projection keys. Reject v1 rather than infer scopes from combined snapshots.

**Rationale**: A criterion-only key would make System, Mine, and Combined collide. The exact-viewer envelope plus scoped keys is equivalent to a full `(viewer, criterion, scope)` key and retains the proven one-current-viewer storage model.

**Alternatives rejected**:

- Multiple per-user cache keys: retains private data for several users in browser storage and complicates cleanup.
- Migrate v1 combined rows by filtering: client filtering cannot construct authoritative System/Mine projections and would violate the security boundary.
- One cache per card component: duplicates identity/race ownership and realtime listeners.

## Decision 6: One Provider Reconciles Maintained Projections

**Decision**: Keep one provider handler. Combined SCORE remains maintained for Dashboard. The full route adds System and authenticated Mine for the shared active criterion. Invalidation/reconnect while ON refetches distinct maintained keys in parallel; event payload rows are ignored.

**Rationale**: ADR-0011 makes the broadcast payload system-safe, not viewer-authoritative. REST with the current session is the only valid source for Mine. Central fan-out preserves one listener and existing route-independent lifetime.

**Alternatives rejected**:

- One listener per card: duplicates requests and produces cleanup/race ambiguity.
- Populate System from `event.topK`: the event is not a complete criterion/scope snapshot and would create dual authorities.
- Private socket rooms/payload: explicitly excluded and unnecessary for MVP.

## Decision 7: Accept Two Scoped Reads and Bound Their Cost

**Decision**: Fetch System and Mine concurrently. Deduplicate exact keys, abort superseded requests, skip anonymous Mine HTTP, prune inactive criteria, and keep Top-K bounded. Document that provider reconciliation can include a third distinct combined SCORE read.

**Rationale**: Independent Top-K/rank/timestamp require independent authoritative projections. Two reads are a predictable MVP cost and avoid a new multi-snapshot response contract.

**Alternatives rejected**:

- Filter a combined read: functionally incorrect when Mine entries lie below the combined cutoff.
- Merge two Top-K lists to synthesize combined Dashboard data: moves authoritative ranking to the client and complicates best-per-version/tie semantics.
- Add a batch endpoint: response and cache complexity is not justified for an initial two-card route.

## Decision 8: Shared Criterion, Scope-Aware Selection, One Detail Panel

**Decision**: Store selection as strategy version plus source scope. Both cards share the provider active criterion and one detail panel. Identity transition clears all selection; refresh/sort clears a selection absent from its source projection. Legacy URL IDs without scope use combined until associated with a visible scoped row.

**Rationale**: Strategy IDs can appear in different projections and a plain ID cannot explain which detail scope to authorize. One detail panel preserves the current interaction model and mobile order.

**Alternatives rejected**:

- Independent selection/detail per box: creates competing detail state and poor mobile behavior.
- Preserve Mine selection across identity change: risks a prior-user detail flash or delayed commit.
- Encode ownership in the client row as authorization: server detail scope remains authoritative.

## Decision 9: Make `/leaderboard` Public, Keep Other Routes Protected

**Decision**: Add `/leaderboard` to middleware public-route policy. Anonymous sees the System card and a sign-in action for Mine; private reads/details still depend on optional JWT verification and repository authorization.

**Rationale**: Current middleware makes the anonymous acceptance story unreachable. Route visibility is not data authorization.

**Alternatives rejected**:

- Keep route protected: directly contradicts the accepted spec.
- Render anonymous System only on login: changes requested navigation and duplicates feature UI.

## Decision 10: Stack Wide Tables; Keep State Independent

**Decision**: On desktop, stack System and Mine in the main column beside one detail column; on mobile stack System, Mine, Detail. Each card has unique headings/table names, its own horizontal scroller, and independent loading/error/stale/empty/retry state.

**Rationale**: DESIGN uses wide financial tables with retained columns. Two side-by-side tables would compress data and harm accessibility.

**Alternatives rejected**:

- Side-by-side cards on desktop: violates the requested usable-table constraint.
- One page-wide loading/error state: one failed projection would erase a valid other projection.
- Drop columns on mobile: loses required financial comparison data.

## Decision 11: Preserve Observer, Wire, Schema, and Global Loop

**Decision**: No production changes to Prisma ownership, migrations, observer subscriptions, PushGateway wire, socket topology, or Search Loop. Event publication continues to request system scope explicitly. Dashboard stays combined SCORE.

**Rationale**: ADR-0011 separates ranking observation from execution; ADR-0016 already supports all three query projections. The feature is a read-model/UI split, not a domain ownership or transport redesign.

## Conflict and Dependency Findings

- No architectural conflict exists with ADR-0011 or ADR-0016; explicit scope is a refinement of the existing app-level visibility predicate.
- The current middleware conflicts with the accepted anonymous route scenario and must change in this feature.
- The current criterion-only provider map conflicts with multiple same-criterion projections and must become scope-aware.
- The existing system-safe event contract is compatible and must remain unchanged.
- Dashboard combined preview is compatible through the default or explicit combined scope and is regression-only.
- `per-user-leaderboard-live-toggle` T041 and T042 remain release dependencies. The split feature may implement and test against the current code, but release evidence must close or explicitly incorporate both gates.

