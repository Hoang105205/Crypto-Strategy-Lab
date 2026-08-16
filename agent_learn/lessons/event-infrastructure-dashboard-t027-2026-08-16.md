# Lessons: Event Infrastructure Dashboard T027 — 2026-08-16

## What Worked

- Booting the production Leaderboard and EventBus modules around a stateful Prisma fake exercised the real Observer, repository, controller, and lifecycle wiring without requiring a database.
- Delegate tripwires made the Strategy-table ownership rule executable while source audits provided a second independent check.
- Overriding `ScoringPolicy` at the Nest provider seam demonstrated formula replaceability without modifying Worker, Backtester, Evaluator, or repository behavior.

## What Didn't Work

- An initial assertion expected the raw floating-point score to equal `0.46`; the exact formula produces the equivalent IEEE-754 value `0.45999999999999996`. The assertion was corrected to numeric closeness because four-decimal rounding belongs to tie comparison, not score persistence.

## Deviations from Plan

- None. T027 added integration/evidence artifacts only; no production implementation changed.

## KB Updates Needed

- [ ] None. Existing contracts already describe the tested Observer, ownership, Top-K, and scoring-policy seams.
