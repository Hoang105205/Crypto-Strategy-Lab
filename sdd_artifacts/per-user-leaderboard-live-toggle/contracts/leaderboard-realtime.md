# Contract: Privacy-Safe Leaderboard Realtime

## Channel

Namespace: existing configurable `/infrastructure` namespace

Channel: existing `leaderboard:update`

No join/leave room messages, socket JWT handshake, or per-user namespace is introduced.

## Internal Event and Wire Payload

`LeaderboardUpdated` remains the EventBus event relayed by `PushGateway`, with this privacy refinement:

```ts
interface LeaderboardUpdatedPayload {
  updatedAt: DateTime; // newest system-entry update only
  triggeredByBacktestResultId: UUID | null;
  rankingCriterion: RankingCriterion;
  topK: LeaderboardEntryPayload[]; // system entries only; every userId is null
}
```

Rules:

1. `topK` is produced with anonymous/system visibility scope, never from a mixed global table.
2. `updatedAt` is produced with the same system scope.
3. For `BacktestCompleted.userId === null`, `triggeredByBacktestResultId` may contain the system result ID.
4. For `BacktestCompleted.userId !== null`, `triggeredByBacktestResultId` must be null.
5. `PushGateway` relays the payload unchanged only after these producer invariants hold.
6. A gateway test must fail if `server.emit('leaderboard:update', payload)` contains an entry with non-null `userId` or a private trigger ID.

`kb/contracts/events.yaml` must be updated to make the trigger nullable and document the system-only Top-K before implementation completion.

## Client Semantics

The payload is a privacy-safe invalidation signal, not the authenticated user's full snapshot.

When Live updates is ON:

1. Own exactly one handler for `leaderboard:update`.
2. On receipt, call the authoritative scoped REST read.
3. Commit only the latest request generation.
4. Reject a snapshot whose scoped `updatedAt` is older than the last accepted watermark.
5. Preserve current sort and selected strategy when still visible.

When Live updates is OFF:

1. Remove that exact handler with `socket.off(channel, sameHandler)`.
2. Do not use `removeAllListeners`.
3. Do not disconnect the shared socket.
4. Preserve the last leaderboard snapshot.
5. Keep loop/queue/connection listeners independent and active.

When Live updates is re-enabled:

1. Attach the handler first.
2. Start a scoped catch-up REST read immediately afterward.
3. If a notification arrives during the catch-up request, start a newer generation; the older response cannot overwrite it.

## Reconnect

- ON: keep/restore one listener and refetch the scoped snapshot.
- OFF: remain off, do not attach the leaderboard listener, and do not update the frozen leaderboard as a side effect of reconnect.
- The shared socket singleton lifecycle remains owned by `InfrastructureProvider`, not by the toggle.

## Privacy Acceptance

- Anonymous socket payload contains no private entry.
- User A and user B receive the same system-safe notification payload; their subsequent REST responses are independently scoped.
- User A private entry, result ID, metrics, ranks, and private `updatedAt` never appear in user B's socket payload or REST response, and vice versa.
