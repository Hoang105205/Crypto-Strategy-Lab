# Per-user Leaderboard Live Toggle Phase 5 — 2026-08-23

## Context

Phase 5 changed frontend realtime semantics from trusting namespace-wide leaderboard rows to using a privacy-safe event as an invalidation for authoritative, viewer-scoped REST data. It also replaced end-user loop commands with a view-only Live updates switch.

## Lessons

1. A safe global event can still drive private views when it contains no private metadata and clients use it only to refetch an authenticated REST snapshot. Applying its system-only `topK` directly would erase or corrupt the owner's private view.
2. Subscribe-before-refetch closes the re-enable gap. A stable handler plus request generations ensures an event arriving during catch-up launches the winning request and an older catch-up response cannot roll state back.
3. A snapshot watermark must advance on both accepted REST snapshots and accepted realtime invalidations. Otherwise an old event after a newer REST response causes redundant reconciliation or stale rollback risk.
4. Listener ownership is narrower than socket ownership. OFF and unmount use `off(channel, exactHandler)` only; they do not disconnect the singleton, call `removeAllListeners`, or disturb loop/queue consumers.
5. A unified dashboard snapshot needs explicit freeze semantics: when leaderboard live mode is OFF, automatic leaderboard events/reconnects must not replace its last snapshot, while independently registered global-loop events remain active.
6. Accessibility tests should query the toggle by `role="switch"`, name and `aria-checked`, then verify visible ON/OFF state and focusability. Command absence is a behavioral contract, not only a visual refactor.
7. Vitest does not automatically reproduce Next's `process.env` client initialization in every dynamic-import test. Unit specs that inject API behavior should mock the Supabase session seam rather than depending on real project credentials.

## Validation pattern

- Record RED only when failures point to missing behavior, not environment setup.
- Assert listener counts and exact handler identity at ON → OFF → ON and unmount boundaries.
- Emit an event during a deferred catch-up request and resolve the newer request first.
- Run the exact targeted suite, full frontend suite and production build after the final source change.

