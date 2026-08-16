# Lessons: Event Infrastructure Dashboard T033 — 2026-08-16

## What Worked

- `LoopModule` imports only public Nest modules and consumes cross-module capabilities through canonical symbol tokens. Owned repository/status/orchestration providers remain local to the Loop boundary.
- Module-level lifecycle hooks centralize the two terminal Event subscriptions and restart reconciliation without making `StrategyLoopService` responsible for Nest wiring.
- An initialization guard prevents duplicate subscriptions and duplicate reconciliation when lifecycle initialization is invoked more than once.
- Queue-unavailable reconciliation is deferred without converting the active run to an orphan. Other startup errors remove newly registered subscriptions before failing boot.
- Shutdown drains the subscription collection before calling `unsubscribe`, making repeated cleanup a no-op.
- Nest replacement modules in the module spec prove the production metadata can boot against alternate public adapters without Redis or PostgreSQL. Calling the real orchestration service proves generator replacement beyond token lookup alone.

## What Didn't Work

- Two initial module-test fixtures awaited the `TestingModuleBuilder` without calling `.compile()`. Correcting those fixtures isolated the intended RED failures to missing production wiring/lifecycle behavior.
- A combined PowerShell audit regex had an unterminated quoted string. Splitting the circular/import/token audit into simple `rg` calls produced unambiguous evidence.

## Deviations from Plan

- `AppModule` was not modified because it already imports `LoopModule` exactly once.
- `LeaderboardModule` is imported only for its exported `ISCORING_POLICY` seam; Loop does not import `ScoringPolicy` or `LeaderboardService` directly.

## KB Updates Needed

- [ ] None identified. The wiring follows the accepted single-process Event Bus/BullMQ topology and existing public module exports.
