# Lessons: fix-backtest-mock-data — 2026-08-13

## What Worked
- Injecting `PrismaService` directly into `StrategyController` provided a quick and effective way to fulfill the GET endpoint without overengineering a new service, keeping the module thin.
- Testing changes were straightforward by mocking `PrismaService` via Jest.

## What Didn't Work
- Initially expected `PrismaService` to be exported by `SharedModule` according to standard conventions, but found it was actually exported by a dedicated `DatabaseModule`. 

## Deviations from Plan
- Task T002 was updated to import `DatabaseModule` instead of `SharedModule` to resolve the DI requirement for `PrismaService`.

## KB Updates Needed
- [ ] Update kb/ARCHITECTURE.md: None needed.
- [ ] Update kb/MODULES.md: Ensure `DatabaseModule` is properly documented as the provider for `PrismaService`.
- [ ] Update kb/modules/strategy-engine.md: Mention that the Controller accesses DB directly for read-only `BacktestResult` retrieval.
- [ ] Update kb/flows/strategy-backtest.md: Reflect that the frontend fetches the DB-persisted BacktestResult directly.
- [ ] New ADR needed: None.
