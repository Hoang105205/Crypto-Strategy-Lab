# Contract: Scoped Leaderboard REST API

This feature contract refines existing Event Infrastructure REST behavior. `kb/contracts/auth.yaml` remains authoritative for authentication and viewer extraction; `kb/contracts/events.yaml` remains authoritative for entry field names.

## Viewer Scope

- Missing bearer token: `currentUserId = null`; system entries only.
- Valid bearer token for user A: system entries plus entries where `userId = A`.
- Invalid/expired bearer token follows the Auth contract and must never select another user's scope.

## Endpoints

### GET /api/leaderboard

**Guard**: `SupabaseJwtGuard` (optional authentication)

**Viewer**: `@CurrentUser() userId: string | null`

**Query**:

| Field | Type | Default |
|-------|------|---------|
| `sortBy` | `score \| totalReturn \| winRate \| maxDrawdown \| sharpeRatio` | `score` |

**Response**:

```ts
{
  rankingCriterion: RankingCriterion;
  updatedAt: DateTime; // newest viewer-visible entry, epoch if none
  entries: Array<{
    rank: number;      // contiguous 1..N in this response
    userId: UUID | null;
    strategyVersionId: UUID;
    strategyName: string;
    strategyType: string;
    isComposite: boolean;
    backtestResultId: UUID;
    score: number;
    totalReturn: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
    totalTrades: number;
  }>;
}
```

**Projection order**: visibility filter -> best result per strategy version -> sort -> Top-K -> ranks `1..N`.

**Errors**:

- `400 INVALID_SORT_CRITERION`
- Auth errors per `kb/contracts/auth.yaml`

### GET /api/leaderboard/:strategyVersionId

**Guard**: `SupabaseJwtGuard` (optional authentication)

**Viewer**: `@CurrentUser() userId: string | null`

**Response**: Viewer-visible `LeaderboardEntryPayload` plus immutable strategy version, trades, and execution time fields already defined by the current Leaderboard detail contract.

**Errors**:

- `404 LEADERBOARD_ENTRY_NOT_FOUND` for malformed ID, nonexistent ID, or an entry that exists only outside viewer scope. These cases are intentionally indistinguishable.
- `503 STRATEGY_ENGINE_UNAVAILABLE` with the existing sanitized body.
- Auth errors per `kb/contracts/auth.yaml`.

### GET /api/dashboard/summary

**Guard**: `SupabaseJwtGuard` (optional authentication)

**Viewer**: `@CurrentUser() userId: string | null`

**Response**:

- `leaderboard`: same scoped rules as `GET /api/leaderboard`, projected to first five entries after viewer-scoped Top-K/rank computation.
- `loop`: global current `SearchLoopRun`; no viewer filter.
- `queue`: global queue stats; no viewer filter.
- `generatedAt`: summary generation timestamp.

Dependency-failure behavior remains unchanged.

## Global Loop Endpoints

`LoopController` uses `SupabaseJwtGuard` and receives `@CurrentUser()` for consistent auth context, but the value is not passed as a `SearchLoopRun`/`SearchLoopCandidate` filter.

The following existing endpoints retain global semantics:

- `GET /api/loop/current`
- `GET /api/loop/:loopRunId`
- `POST /api/loop/start`
- `POST /api/loop/:loopRunId/pause`
- `POST /api/loop/:loopRunId/resume`
- `POST /api/loop/:loopRunId/stop`

The frontend Live updates toggle calls none of the POST endpoints.
