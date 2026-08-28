# Frontend Contract: Scoped Leaderboard Provider

**Feature**: `split-leaderboard-boxes` | **Status**: Planned SSoT

## Ownership

`LeaderboardLiveProvider` is the only owner of:

- leaderboard Live preference consumption;
- leaderboard REST snapshot cache;
- `leaderboard:update` listener;
- reconnect reconciliation;
- identity/request generations, aborts, and watermarks;
- active criterion and shared scope-aware selection.

Page hooks, cards, Dashboard, and detail components register zero `leaderboard:update` handlers and never disconnect the shared Infrastructure socket.

## Consumer Surface

The implementation may name helpers differently, but it must expose equivalent semantics:

```ts
interface ProjectionViewState {
  snapshot: LeaderboardSnapshot | null;
  loading: boolean;
  error: Error | null;
  isStale: boolean;
  lastSuccessfulAt: Date | null;
  refetch(): Promise<void>;
}

interface SelectedLeaderboardStrategy {
  strategyVersionId: string;
  sourceScope: LeaderboardScope;
}

interface LeaderboardLiveContextValue {
  isLive: boolean;
  setIsLive(value: boolean): void;
  activeCriterion: RankingCriterion;
  setActiveCriterion(value: RankingCriterion): Promise<void>;
  combinedScore: ProjectionViewState;
  system: ProjectionViewState;
  mine: ProjectionViewState;
  selectedStrategy: SelectedLeaderboardStrategy | null;
  setSelectedStrategy(value: SelectedLeaderboardStrategy | null): void;
}
```

Dashboard consumes only `combinedScore.snapshot`. The full route consumes System, Mine, shared criterion, and shared selection.

## Effective Cache Key

```text
viewerKey + scope + rankingCriterion
```

The implementation uses one exact-viewer v2 envelope and indexes snapshots by scope and criterion. A snapshot is renderable only when its accepted `viewerKey` exactly equals the resolved current viewer.

Criterion-only v1 snapshots are not reclassified or client-filtered into System/Mine. Unknown, malformed, or viewer-mismatched envelopes are discarded.

## Maintained Projection Set

- Always eligible: Combined SCORE for Dashboard compatibility.
- Once requested by full `/leaderboard`: System and, for an authenticated viewer, Mine at the active criterion.
- Anonymous Mine is a privacy-neutral sign-in state and may skip HTTP.
- On criterion change, retain Combined SCORE and replace System/Mine active-criterion slots; abandoned criteria are pruned.
- Identical projection reads are deduplicated; different scopes remain independent authoritative reads.

## Realtime Contract

While Live is ON:

1. Attach exactly one stable `leaderboard:update` handler before catch-up.
2. Treat the event only as invalidation; ignore `topK` and other event rows as cache content.
3. Reconcile every maintained current-viewer projection through scoped REST.
4. Reconnect performs the same reconciliation.
5. Commit only the newest eligible response for each projection key.

While Live is OFF:

1. Remove the exact handler; listener count is zero for this provider.
2. Abort/invalidate live reconciliation already in flight.
3. Preserve accepted same-viewer snapshots and preference.
4. Ignore events and reconnect as automatic refresh causes.
5. Permit explicit bootstrap, sort, and retry reads without enabling Live.

## Identity Boundary

Before A -> B or A -> anonymous renders:

- advance identity generation;
- abort all list/detail requests;
- invalidate every projection request generation;
- clear A snapshots, metadata, watermarks, selection, and detail eligibility;
- remove/reject A persisted envelope;
- expose no projection until it is exact-viewer eligible.

A delayed response requires the same viewer, identity generation, scope, criterion/strategy ID, and request generation to commit. Transport abort alone is not considered sufficient.

The Live preference is not user-private data and survives identity changes unchanged.

## Independent Projection State

System and Mine independently expose:

- initial loading;
- success/current;
- initial error with retry;
- stale same-viewer snapshot with timestamp and retry;
- empty state.

A failure in one scope cannot erase, replace, or relabel the other scope. A snapshot can never be borrowed from another viewer, scope, or criterion.

## Selection and Detail

- Selection records strategy version and source scope.
- Detail requests pass source scope to the server.
- A selected strategy disappearing from its source projection clears selection and detail.
- Identity transition clears all selection before paint.
- A legacy Dashboard deep link without source scope defaults to combined and remains server-authorized.
- A detail 404 is privacy-neutral and clears/labels only the current selection; old-scope detail cannot commit.

## Listener and Request Evidence

Tests must prove:

- Live ON provider listener count is exactly one regardless of two cards.
- Live OFF count is zero.
- Route/card mount and unmount do not create extra listeners or disconnect Infrastructure.
- One invalidation causes at most one request per distinct maintained projection key.
- Event `topK` is never written to any projection cache.
- Dashboard remains combined SCORE.

