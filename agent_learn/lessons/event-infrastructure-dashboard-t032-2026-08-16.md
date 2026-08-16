# Lessons: Event Infrastructure Dashboard T032 — 2026-08-16

## What Worked

- A dedicated `StartLoopDtoPipe` keeps HTTP parsing and validation outside the controller. It converts ISO strings to `Date`, trims pair/timeframe, normalizes absent numeric bounds to `null`, and applies the no-improvement default of 50 before orchestration is called.
- Stable error definitions whitelist public messages, status codes, and codes. Raw domain/dependency messages and stacks never enter the HTTP response.
- `LoopRunIdPipe` maps malformed UUIDs directly to `404 LOOP_NOT_FOUND`, preventing unnecessary repository/service reads.
- Declaring `/current` before `/:loopRunId` preserves literal-route precedence, while detail returns repository candidate order without re-sorting.
- Command endpoints project only `{ loopRunId, status }`; snapshot/detail endpoints pass through authoritative application state without recreating Loop rules.

## What Didn't Work

- Returning JavaScript `null` from a normal Nest controller method produced an empty Express body. The current route uses `response.json(current)` so the contract receives the JSON literal `null`.

## Deviations from Plan

- `QUEUE_UNAVAILABLE` is also sanitized as a 503 dependency error because T031 can surface acknowledged-enqueue failure. This does not change endpoint behavior or introduce a new dependency.
- No module/provider/subscription wiring was added; that remains T033.

## KB Updates Needed

- [ ] None identified. T032 follows `contracts/loop-api.md` and existing stable-error controller patterns.
