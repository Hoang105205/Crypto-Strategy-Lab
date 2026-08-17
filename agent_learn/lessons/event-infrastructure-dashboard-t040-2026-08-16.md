# Event Infrastructure Dashboard T040 - 2026-08-16

## What worked

- Keeping wire DTOs private to the API client made ISO date conversion explicit and kept domain consumers on real `Date` values.
- A reusable `ApiClientError` preserved status/code/message without changing the existing Market Data public methods.
- Separate request-generation and live-revision counters solved different races: request-vs-request and REST-vs-realtime.
- The Leaderboard can use its contract `updatedAt` as a watermark; Loop events cannot, so same-run monotonic counters, best-score precedence, and terminal-state precedence are required.
- Injecting API/socket boundaries into hooks kept tests deterministic while production defaults still use the real client singleton.
- Exact `on`/`off` handler references allow multiple hook consumers to coexist safely; global listener removal would violate that ownership boundary.

## Adjustment made during implementation

- `sortBy` changes update only client-owned selection state. The caller invokes `refetch()` when it wants an authoritative server-sorted snapshot. This avoids an implicit background request and ensures realtime merges cannot reset the user's chosen criterion.
- The initial REST synchronization remains colocated with socket subscription startup. A narrow ESLint suppression documents this intentional effect boundary.

## Reusable lesson

When REST snapshots and realtime events have unequal ordering metadata, do not manufacture a universal timestamp. Use the strongest contract signal per stream: server `updatedAt` where available, local request/live revisions for in-flight races, and domain monotonicity plus terminal precedence where no revision exists.

## KB updates needed

- [ ] No immediate KB change is required; implementation follows the active Dashboard realtime, Leaderboard API, Loop API, shared event, and shared infrastructure contracts.
