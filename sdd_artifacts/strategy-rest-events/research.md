# Research: strategy-rest-events

## Decisions

### D1: How to retrieve Strategy Versions by name?
- **Chosen**: Add a `getVersionsByName(name: string)` method to `StrategyVersioningService`.
- **Rationale**: The in-memory Map structure in MVP stores versions by UUID. We need to iterate and filter them by name.
- **Alternatives considered**: Require front-end to fetch all and filter client-side (bad for future scale).
- **KB reference**: `kb/contracts/strategy.yaml` requires `GET /api/strategies/:id/versions`

### D2: How to retrieve BacktestResult?
- **Chosen**: For the MVP, return a static/mocked `BacktestResult` in the controller.
- **Rationale**: `BacktestResult` is usually saved by Job Queue workers into the database (Prisma). Since Prisma is not implemented yet in this feature branch, we will mock it to satisfy the GET endpoint contract for now, and rely on the subsequent persistence task to replace the mock with real DB queries.
- **Alternatives considered**: Build a temporary in-memory `BacktestResultService`. Not necessary, as Prisma integration is the immediate next step on the roadmap.
- **KB reference**: `kb/contracts/strategy.yaml` requires `GET /api/strategies/backtest/:id`
