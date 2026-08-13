# Research: fix-backtest-mock-data

## Decisions

### D1: How to inject PrismaService into StrategyController
- **Chosen**: Inject `PrismaService` into a new `StrategyService` or directly into `StrategyController`. Wait, we should probably inject it into a dedicated repository or service to keep the controller thin. Since there's no `StrategyService` mentioned that handles simple CRUD yet (it uses `StrategyVersioningService` and `StrategyRegistry`), we can inject `PrismaService` directly into `StrategyController` for a quick read, or create a `BacktestResultService`. We'll inject `PrismaService` directly into `StrategyController` to minimize overhead for a single GET endpoint.
- **Rationale**: The `BacktestResult` is purely a read operation in the `Strategy Engine` module. `PrismaService` is already exported by `SharedModule`. Injecting it directly is acceptable per NestJS conventions for simple CRUD.
- **Alternatives considered**: Creating a `BacktestResultRepository` or `BacktestService`. Rejected because it's overkill for a single GET by ID.
- **KB reference**: `kb/ARCHITECTURE.md` (NestJS DI).

### D2: What to do if trades JSONB is large
- **Chosen**: Return the whole JSONB object as-is from Prisma.
- **Rationale**: The frontend needs the trade data to plot on the chart. Prisma maps JSONB to a JS object automatically. 
- **Alternatives considered**: Pagination. Rejected because `BacktestResult` represents a single atomic report, and trades are usually in the hundreds/thousands, which fits in a single JSON payload (~100KB-1MB).
