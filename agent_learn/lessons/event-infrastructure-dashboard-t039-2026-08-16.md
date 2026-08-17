# Event Infrastructure Dashboard T039 - 2026-08-16

## What worked

- Runtime-loading the not-yet-created T040 service/hooks allowed Vitest to collect all four specification files and report each intentional missing-production failure at test level.
- Optional dependency seams in the hook contracts let tests use deterministic fake API/socket boundaries without a live backend, Redis, Binance, sentiment service, or real Socket.IO connection.
- Separating request generation from realtime revision locked two distinct races: an older request cannot beat a newer request, and an in-flight snapshot cannot overwrite an event delivered after the request began.
- Using the contract `LeaderboardUpdated.updatedAt` as the Leaderboard watermark avoided arrival-order assumptions.
- Loop tests deliberately use same-run monotonic counters and terminal-state precedence because active Loop progress payloads do not contain an `updatedAt` or revision field.
- Running ESLint and full frontend TypeScript separately from the intentional RED run proved that RED came from missing T040 behavior rather than malformed tests.

## What did not work initially

- No test implementation defect was found. The first targeted run collected 4 files/16 tests and every failure pointed to the expected absent `getDashboardSummary`, `infrastructure-socket`, `use-infrastructure-socket`, `use-dashboard-summary`, or `use-leaderboard` production surface.
- The requested Market Data frontend regression suite does not exist in the repository. The honest gate is the existing smoke test plus a source-boundary diff; it would be false evidence to claim a Market Data frontend suite passed.

## Deviations from plan

- The active task names the four specification files but not a production test-injection API. The RED contract permits optional API/socket dependencies while production defaults remain owned by T040. This keeps the hook behavior independently testable without mocking module internals.
- Stable errors are asserted structurally through `status`, `code`, and safe `message`; T039 does not require a particular error class name.
- Loop race tests do not invent a timestamp. Request-generation/live-revision behavior and terminal precedence satisfy the current contract while leaving any future server revision addition to contract reconciliation.

## Reusable lesson

For absent frontend hooks, a trustworthy RED gate can runtime-load future modules, type the expected public surface inside tests, inject deterministic boundary fakes, and independently prove test lint/type correctness. Reconnect tests must distinguish request-order races from event-vs-snapshot races; one timestamp comparison is insufficient when some event payloads have no server revision.

## KB updates needed

- [ ] No immediate KB change is required for T039.
- [ ] If the team wants total ordering for Search Loop snapshots/events rather than client request-generation protection, first add an authoritative Loop revision/timestamp to the active contract and shared payloads before implementation.
