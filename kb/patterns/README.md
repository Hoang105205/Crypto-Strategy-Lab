# Design Pattern Catalog

Patterns used across the project, with where they appear and why.

> Fill entries as modules document their patterns in `kb/modules/{name}.md`.

| Pattern | Where Used | Module | Why |
|---------|-----------|--------|-----|
| Adapter | BinanceAdapter, RSS/CryptoPanic adapters | Market Data, News & Sentiment | Swappable external providers |
| Plugin Registry | StrategyRegistry | Strategy Engine | Open-Closed extension for strategies |
| Composite | MajorityVote, WeightedScore combiners | Strategy Engine | Strategy composition |
| Observer | Leaderboard subscribes to BacktestCompleted | Event Infrastructure | Reactive ranking without coupling |
| Job Queue / Worker | BullMQ `backtest` queue + Redis + BacktestWorker | Event Infrastructure | Durable async execution, priority, retry, and controlled concurrency |
| BFF | DashboardService | Event Infrastructure | Frontend-specific composition |
| Graceful Degradation | NewsSentimentStrategy returns HOLD | News & Sentiment | Fault tolerance |
| Event Envelope | Every event wrapped with eventId/correlationId/occurredAt before publish | Event Infrastructure | Idempotency + tracing across async event chains |
| BFF (Backend-for-Frontend) | DashboardService composes Leaderboard + Loop Status + Queue Stats | Event Infrastructure | One REST call for the frontend instead of three |
| State Machine | SearchLoopRun status transitions (RUNNING/PAUSED/COMPLETED/STOPPED_BY_USER/FAILED) | Event Infrastructure | Explicit, controlled loop lifecycle — no unbounded `while(true)` |
