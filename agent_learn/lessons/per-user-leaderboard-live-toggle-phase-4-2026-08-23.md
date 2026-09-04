# Lessons: Per-user Leaderboard Live Toggle Phase 4 — 2026-08-23

## What Worked

- Treating the namespace event as a system-safe invalidation keeps the existing transport simple while preventing private rows and identifiers from crossing the socket boundary.
- Explicitly passing viewer `null` at the publisher documents and tests system scope instead of relying on repository default parameters.
- Testing both publisher branches and the real gateway boundary caught the remaining leak: Top-K/watermark were safe after Phase 2, but the private trigger ID was not.
- An exact-relay characterization test protected the gateway's transport-only role and avoided inventing a room/auth protocol.

## What Didn't Work

- A combined Jest name pattern containing `|` was interpreted by the Windows shell before Jest ran. Independent targeted commands were used for deterministic T020/T021/T022 evidence.
- One pre-existing service assertion expected the old one-argument Top-K call; it was aligned to the explicit system-viewer contract after implementation.

## Deviations from Plan

- T021 was GREEN immediately, as allowed by the task, because PushGateway already relayed payloads unchanged. Only its test was strengthened; production gateway code remained untouched.
- No rooms, socket authentication, namespace changes, disconnect behavior, or client filtering were introduced.

## KB Updates Needed

- [ ] Update `kb/flows/leaderboard-update.md` after feature approval to document system-safe global invalidation and scoped REST catch-up.
- [ ] Update `kb/modules/event-infrastructure.md` after feature approval to state that LeaderboardService owns realtime privacy and PushGateway remains an exact relay.
- [ ] No new ADR is needed; this implements the already approved MVP decision and active event contract.
