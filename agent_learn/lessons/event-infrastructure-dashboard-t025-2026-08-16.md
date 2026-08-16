# Lessons: Event Infrastructure Dashboard T025 — 2026-08-16

## What Worked

- Storing the Event subscription cleanup and nulling it before unsubscribe makes repeated module destruction idempotent.
- Returning immediately for an existing projection or a P2002 race loser prevents duplicate reranking and realtime publication without an application mutex.
- Keeping validation and zero-trade normalization before scoring makes the side-effect order executable and keeps malformed completions out of persistence.
- Detail composition reads the Event Infrastructure projection first and crosses the module boundary only through `IBacktestResultPort`.

## What Didn't Work

- The original T021 service suite did not assert detail composition, so two focused cases were added during T025.

## Deviations from Plan

- No production deviation. The detail response currently contains projection fields, trades, and execution time available from the approved result port.

## KB Updates Needed

- [x] Resolved in T026: `IBacktestResultPort.getById()` now returns Strategy-owned `BacktestResultDetail`, including the immutable `StrategyVersion`.
