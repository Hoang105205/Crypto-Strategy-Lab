# Contract: Dashboard BFF and Infrastructure Realtime

## Dashboard Endpoint

### GET `/api/dashboard/summary`

**200**:

```ts
{
  leaderboard: {
    rankingCriterion: RankingCriterion;
    updatedAt: string;
    entries: LeaderboardEntryPayload[]; // compact Top-5 preview
  };
  loop: SearchLoopRun | null;
  queue: QueueStats;
  generatedAt: string;
}
```

The endpoint composes existing application services and performs no ranking or Loop decisions.
`QueueStats` is authoritative in `kb/contracts/events.yaml`; the BullMQ/Redis projection includes
`delayed` and `redisConnected` in addition to queued, processing, completed, and dead-letter counts.
If the queue snapshot cannot be obtained, the endpoint uses the stable dependency-error shape below
instead of returning stale counts as healthy.

## Stable Error Shape

```ts
{
  error: string;
  code: string;
}
```

No stack traces or raw dependency errors are returned.

### Error Vocabulary

| Code | HTTP status | Public message | Use |
|------|-------------|----------------|-----|
| `QUEUE_UNAVAILABLE` | `503` | `Queue service is unavailable` | A queue read fails with the established Queue dependency code. |
| `STRATEGY_ENGINE_UNAVAILABLE` | `503` | `Strategy Engine is unavailable` | A dependency read fails with the established Strategy Engine dependency code. |
| `INTERNAL_ERROR` | `500` | `Internal server error` | An unknown or unclassified failure reaches the Dashboard boundary. |

An application-created `HttpException` is preserved only when its response is already the exact
stable `{ error: string, code: string }` shape. Framework-default or malformed exception bodies are
not reflected. Non-HTTP errors are mapped by the known dependency codes above; every other error is
sanitized to `INTERNAL_ERROR`. The reusable filter is applied only to the Dashboard controller in
this phase, so Queue, Loop, Leaderboard, and Market Data endpoint behavior remains unchanged.

## Socket.IO Namespace

`/infrastructure`

## Server Channels

| Channel | Source Event | Payload |
|---------|--------------|---------|
| `leaderboard:update` | `LeaderboardUpdated` | exact event payload |
| `loop:started` | `SearchLoopStarted` | exact event payload |
| `loop:progress` | `SearchLoopProgress` | exact event payload |
| `loop:stopped` | `SearchLoopStopped` | exact event payload |

`connection:status` is client lifecycle state (`connected`, `reconnecting`, `disconnected`), not a server business Event.

## Reconnect Rules

1. Retain the last successful state and timestamp.
2. Mark the view reconnecting/disconnected with text/accessibility semantics.
3. On reconnect, refetch Dashboard and Leaderboard snapshots.
4. Ignore a snapshot older than the latest applied realtime `updatedAt`.
5. Resume channel application after reconciliation.

The existing `/market-data` namespace and socket-room protocol are unchanged.
