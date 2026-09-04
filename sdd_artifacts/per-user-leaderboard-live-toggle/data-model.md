# Data Model: Per-User Leaderboard Live Toggle

## Entity and State Flow

```mermaid
flowchart LR
    U[Resolved viewer: anonymous / A / B] --> REST[Current-session Leaderboard REST]
    REST --> S[Viewer-scoped accepted snapshots by criterion]
    S --> D[Dashboard SCORE Top-5]
    S --> L[/leaderboard active criterion]
    S --> P[Current-viewer browser cache envelope]

    WS[system-only leaderboard:update] --> I[Provider invalidation]
    I --> REST

    U --> G[Identity generation]
    G --> S
    G --> R[Request generation + AbortController]

    PREF[Persisted ON/OFF preference] --> H[Exactly one handler while ON]
    H --> I
```

Backend ownership entities and wire payloads are unchanged. `SearchLoopRun` and `SearchLoopCandidate` remain global system entities and are intentionally absent from viewer ownership.

## Existing Backend Entities and Contracts

### BacktestRequested / BacktestResult / BacktestCompleted / LeaderboardEntry

The delivered invariant remains:

```text
USER:        request.userId = A -> result.userId = A -> completion.userId = A -> entry.userId = A
SEARCH_LOOP: request.userId = null -> result.userId = null -> completion.userId = null -> entry.userId = null
```

No field, relation, index, or migration changes.

### LeaderboardSnapshot

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `rankingCriterion` | `RankingCriterion` | Required | Server-applied criterion. |
| `updatedAt` | `Date` | Required | Computed only from caller-visible rows. |
| `entries` | `LeaderboardEntryPayload[]` | 0..K | Anonymous = system; A = system + A; B = system + B. |

The provider accepts this projection only from current-session REST. It never uses `LeaderboardUpdated.topK` as a viewer snapshot.

### LeaderboardUpdated

The existing wire payload remains unchanged:

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `updatedAt` | DateTime | Required | System-scoped event watermark. |
| `triggeredByBacktestResultId` | UUID/string or null | Existing | Null for private trigger. |
| `rankingCriterion` | Existing enum | Required | Existing wire field. |
| `topK` | `LeaderboardEntryPayload[]` | System rows only | Safe invalidation metadata, never cached as the viewer view. |

## Frontend State Entities

### ViewerKey

| Value | Meaning |
|-------|---------|
| `null` | Auth is unresolved; no cached leaderboard may render and no request may commit. |
| `anonymous` | Resolved unauthenticated viewer; REST/cache may contain system rows only. |
| Supabase user UUID | Resolved authenticated viewer; REST/cache may contain system plus that UUID only. |

`ViewerKey` is an ownership stamp, not a client privacy filter. The provider discards a whole mismatched envelope instead of inspecting/removing individual rows.

### LiveUpdatesPreference

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `isLive` | boolean | Explicit browser choice; missing/invalid = false | Controls only the provider's leaderboard handler and automatic reconciliation. |

**Storage key**: `crypto-strategy-lab:leaderboard-live`

The preference is browser-scoped, not user-scoped. It survives A->B/A->anonymous while cache/request ownership resets.

### AcceptedSnapshot

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `viewerKey` | non-null `ViewerKey` | Required | Must equal the current resolved viewer to render/commit. |
| `criterion` | `RankingCriterion` | Required | Key in `snapshotsByCriterion`. |
| `snapshot` | `LeaderboardSnapshot` | Required | Decoded current-session REST result. |
| `identityGeneration` | non-negative integer | Required | Captured at request start. |
| `requestGeneration` | positive integer | Monotonic within identity | Only latest applicable request may commit. |
| `acceptedAt` | Date | Required | Client acceptance time for stale UX, not ranking metadata. |

SCORE is always retained for Dashboard. One `activeCriterion` is retained for `/leaderboard`; when different from SCORE, both snapshots may coexist.

### PersistedLeaderboardCacheEnvelopeV1

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `version` | `1` | Exact literal | Reject unknown schema versions. |
| `viewerKey` | `anonymous` or UUID | Required | Exact-match hydration gate. |
| `activeCriterion` | `RankingCriterion` | Required | Restores route view state. |
| `selectedStrategyVersionId` | string or null | Optional view state | Cleared if not visible after a new accepted snapshot. |
| `snapshots` | partial map criterion -> serialized snapshot | SCORE plus active criterion at most | Only accepted REST snapshots. Dates are ISO strings. |
| `persistedAt` | ISO DateTime | Required | Cache bookkeeping only. |

**Storage key**: `crypto-strategy-lab:leaderboard-cache:v1`

Rules:

1. Wait for Auth resolution before reading or exposing the envelope.
2. Exact viewer match restores the whole envelope; mismatch/malformed/version failure discards the whole envelope.
3. Identity transition removes the old envelope before the next viewer paints.
4. Storage unavailability falls back to in-memory state; it never enables Live or reuses a prior viewer.
5. No event payload, access token, session token, or SearchLoopRun is stored in this envelope.

### ProviderRuntimeState

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `viewerKey` | `ViewerKey` | Derived from AuthContext | Current render boundary. |
| `identityGeneration` | integer | Monotonic | Advanced on anonymous/authenticated identity changes. |
| `nextRequestGeneration` | integer | Monotonic | Advanced per reconciliation request. |
| `snapshotsByCriterion` | map | Viewer-stamped | App-lifetime cache. |
| `activeCriterion` | `RankingCriterion` | Default SCORE | Shared by `/leaderboard`. |
| `selectedStrategyVersionId` | string or null | Current viewer only | Preserved across live updates/navigation; cleared on identity transition or loss of visibility. |
| `leaderboardWatermarks` | map criterion -> epoch ms | Monotonic per viewer | Rejects older snapshots. |
| `inFlightControllers` | map request generation -> `AbortController` | Provider-owned | Aborted on identity/provider cleanup and supersession where safe. |
| `isStale`, `loading`, `error`, `lastSuccessfulAt` | UI state | Viewer-scoped | Never carried from A to B/anonymous. |

## Identity Transition State Machine

```text
A resolved
  -> Auth reports B or anonymous
  -> render selectors reject every A-stamped snapshot
  -> layout effect advances identityGeneration
  -> abort A controllers
  -> clear A memory, watermarks, error, selection, and persisted envelope
  -> initialize B/anonymous empty/loading state
  -> if ON: existing one handler remains and current-session catch-up runs
  -> if OFF: restore matching cache or perform one bootstrap when none exists
```

A delayed response can commit only when all are true:

```text
mounted
AND capturedViewerKey == currentViewerKey
AND capturedIdentityGeneration == currentIdentityGeneration
AND capturedRequestGeneration is current for its criterion
AND snapshot.updatedAt >= accepted criterion watermark
```

## OFF and ON Transitions

```text
No stored preference -> OFF
OFF + event/reconnect -> no listener-driven request, cache unchanged
OFF + explicit sort/retry/bootstrap -> current-session REST, accept then freeze
OFF -> ON -> attach exact handler -> catch-up REST
ON + invalidation -> current-session SCORE (+ active criterion if different) REST
ON + reconnect -> current-session reconciliation
ON -> OFF -> remove exact handler, keep accepted cache
provider unmount -> remove exact handler + abort requests; never disconnect socket
```

## Database and Migration Notes

- No Prisma model or migration is created.
- Existing nullable `userId` columns remain unchanged.
- No new PostgreSQL/Redis index or cache is added.
- No field is added to `SearchLoopRun` or `SearchLoopCandidate`.
- Browser cache persistence is a frontend implementation detail and changes no wire/auth semantics.
