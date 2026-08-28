# Contract: Privacy-Safe Cross-Route Leaderboard Realtime

## Wire Surface (Unchanged)

Namespace: existing configurable `/infrastructure` namespace

Channel: existing `leaderboard:update`

No join/leave room messages, socket JWT handshake, per-user namespace, new channel, or field change is introduced. `kb/contracts/events.yaml` remains the wire SSoT.

```ts
interface LeaderboardUpdatedPayload {
  updatedAt: DateTime;
  triggeredByBacktestResultId: UUID | null;
  rankingCriterion: RankingCriterion;
  topK: LeaderboardEntryPayload[]; // system rows only
}
```

Existing publisher invariants remain:

1. `topK` and `updatedAt` use anonymous/system scope.
2. Every `topK` entry has `userId = null`.
3. A private completion uses `triggeredByBacktestResultId = null`.
4. `PushGateway` relays the payload unchanged.
5. The frontend treats the complete payload as invalidation metadata, never as a viewer snapshot and never as input to a client privacy filter.

## Ownership Boundary

Canonical root nesting:

```text
AuthProvider
  InfrastructureProvider
    LeaderboardLiveProvider
      AppShell / route pages
```

`LeaderboardLiveProvider` is the only owner of:

- persisted Live ON/OFF preference;
- viewer-stamped leaderboard snapshots by ranking criterion;
- active criterion and selected strategy identity;
- identity/request generations and abort controllers;
- reconnect reconciliation;
- this feature's one exact `leaderboard:update` handler.

Dashboard, `/leaderboard`, and their hooks consume context state. They must register zero `leaderboard:update` handlers.

## Provider Consumer Interface

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

The provider may expose equivalent names, but ownership and behavior must remain identical. The public surface does not expose listener registration or shared-socket disconnect.

## ON Semantics

1. Own exactly one stable handler for `leaderboard:update` across all client-side routes.
2. Attach the handler before initial/re-enable catch-up REST.
3. On safe invalidation, refetch SCORE for Dashboard and the retained active criterion when it differs.
4. Each request uses the session/token current at request time.
5. Accept a response only when viewer key, identity generation, request generation, and criterion watermark are current.
6. Persist only accepted REST snapshots, never `payload.topK`.
7. Preserve current sort and selected strategy while the selected strategy remains visible.

## OFF Semantics

1. Remove the exact provider handler with `socket.off(channel, sameHandler)`.
2. Do not call `removeAllListeners` or disconnect the shared socket.
3. Keep the explicit OFF choice, current viewer cache, sort, selection, and timestamps across navigation.
4. Restore the same viewer-stamped cache after reload/browser restart; a missing valid cache permits one current-session bootstrap and then freezes.
5. Events and reconnects cause no automatic leaderboard request or snapshot mutation.
6. Explicit sort/retry/bootstrap reads are allowed without changing OFF to ON.

## Re-enable and Race Ordering

1. Attach the stable handler.
2. Start current-session catch-up.
3. If an event arrives during catch-up, start a newer request generation.
4. The older response cannot commit even if it resolves successfully.
5. Repeated toggles leave one handler when ON and zero when OFF.

## Navigation and Cleanup

- Dashboard or `/leaderboard` unmount changes no provider state and removes no provider handler.
- Other routes may be active while ON; every invalidation still performs current-session REST reconciliation.
- Returning to Dashboard consumes maintained SCORE cache and adds no listener.
- Returning to `/leaderboard` consumes the maintained active-criterion cache and adds no listener.
- Only provider/app-shell unmount removes the exact handler and aborts provider requests.
- Provider cleanup removes no foreign handler and never calls the shared socket disconnect seam.

## Reconnect

- ON: keep/restore one handler and refetch current-session REST after the connection returns.
- OFF: remain OFF, attach no leaderboard handler, and do not refresh solely because of reconnect.
- Reconnect never writes the preference and never invokes a Search Loop lifecycle endpoint.

## Identity Boundary

For A->B and A->anonymous:

1. The render selector rejects A-stamped cache immediately when the resolved viewer key changes.
2. Advance identity generation, abort/invalidate A requests, clear A memory/watermarks/selection, and remove the persisted A envelope before the new viewer paints.
3. The explicit ON/OFF preference remains unchanged.
4. B may accept only current-session system+B REST snapshots; anonymous may accept only current-session system snapshots.
5. A response captured under A or an old generation cannot commit for the new viewer.

## Persistence Keys

- Preference: `crypto-strategy-lab:leaderboard-live`
- Current-viewer accepted cache envelope: `crypto-strategy-lab:leaderboard-cache:v1`

An absent, malformed, unknown-version, mismatched-viewer, or inaccessible value is discarded safely. It never enables Live and never authorizes row-level filtering/reuse.

## Acceptance Evidence

- Exactly one provider handler through Dashboard -> another route -> `/leaderboard` -> Dashboard while ON.
- Zero page-hook handlers and zero provider handler while OFF.
- Off-route invalidation refetches with A's current session and maintains system+A only.
- Re-enable is subscribe-before-refetch and race-safe.
- Reconnect ON refetches; reconnect OFF stays frozen.
- Page unmount performs no feature cleanup; provider unmount performs exact cleanup only.
- Anonymous, A, and B receive/apply only their REST scope.
- A cache never renders for B/anonymous, and delayed A requests never commit.
- Toggle/navigation/reconnect cause zero Search Loop lifecycle calls and zero shared socket disconnects.
