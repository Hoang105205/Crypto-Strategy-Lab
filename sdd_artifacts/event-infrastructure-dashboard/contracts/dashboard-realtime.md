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

## Stable Error Shape

```ts
{
  error: string;
  code: string;
}
```

No stack traces or raw dependency errors are returned.

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

