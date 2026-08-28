# REST Contract: Scoped Leaderboard

**Feature**: `split-leaderboard-boxes` | **Status**: Planned SSoT

## Shared Types

```ts
enum LeaderboardScope {
  SYSTEM = 'system',
  MINE = 'mine',
  COMBINED = 'combined',
}
```

The response type remains the existing `LeaderboardSnapshot`:

```ts
interface LeaderboardSnapshot {
  rankingCriterion: RankingCriterion;
  updatedAt: Date;
  entries: LeaderboardEntryPayload[];
}
```

JSON transmits `updatedAt` as ISO-8601. The frontend API client decodes it to `Date` as today.

## List Leaderboard

```http
GET /api/leaderboard?sortBy=<RankingCriterion>&scope=<LeaderboardScope>
Authorization: Bearer <optional Supabase access token>
```

### Query

| Name | Required | Default | Behavior |
|---|---|---|---|
| `sortBy` | No | `score` | Existing ranking criterion validation |
| `scope` | No | `combined` | `system`, `mine`, or `combined` |

Omitted or empty `scope` means combined. An invalid explicit value never falls back.

### Authorization Projection

| Scope | Anonymous | Authenticated A |
|---|---|---|
| `system` | `userId = null` | `userId = null` |
| `mine` | empty neutral snapshot | `userId = A` |
| `combined` | `userId = null` | `userId = null OR userId = A` |

Ownership is derived only from the verified token. No query/header/body user ID is accepted.

### Projection Semantics

For each request, visibility filtering occurs before best-per-version, criterion sort, existing deterministic tie rules, Top-K, response rank, and `updatedAt`. A non-empty response has contiguous ranks `1..N`. An empty response has `entries=[]` and epoch `updatedAt`.

### Success

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "rankingCriterion": "score",
  "updatedAt": "2026-08-25T09:30:00.000Z",
  "entries": []
}
```

The JSON shape and entry fields are unchanged from the current endpoint.

### Invalid Scope

```http
HTTP/1.1 400 Bad Request
```

```json
{
  "error": "Invalid leaderboard scope",
  "code": "INVALID_LEADERBOARD_SCOPE"
}
```

Existing invalid-sort behavior remains unchanged.

## Leaderboard Detail

```http
GET /api/leaderboard/:strategyVersionId?scope=<LeaderboardScope>
Authorization: Bearer <optional Supabase access token>
```

`scope` has the same literals, default, validation, and verified-viewer projection as list. After scope filtering, the route preserves current SCORE-best entry selection for the requested strategy version and current detail response shape.

### Success

Existing `LeaderboardDetail` JSON is returned with no new fields.

### Anti-Enumeration

The following all return the same existing stable 404 body:

- nonexistent strategy version;
- private strategy version owned by another user;
- Mine detail requested anonymously;
- system strategy requested with `scope=mine`;
- owned strategy requested with `scope=system`.

```json
{
  "error": "Leaderboard entry not found",
  "code": "LEADERBOARD_ENTRY_NOT_FOUND"
}
```

The Strategy result port is not called when no visible leaderboard entry exists.

## Backward Compatibility

- Existing list calls without `scope` keep combined behavior exactly.
- Existing detail calls without `scope` keep combined authorization exactly.
- `LeaderboardSnapshot`, `LeaderboardEntryPayload`, and `LeaderboardDetail` response shapes do not change.
- Dashboard continues to request/receive combined SCORE and slice its existing Top-5 preview.
- Existing optional bearer-token resolution is unchanged.

## Non-Contract Changes

This feature does not change Prisma schema/migrations, ranking formulas, Top-K configuration, event fields, websocket namespace/rooms/handshake, or Search Loop APIs.

