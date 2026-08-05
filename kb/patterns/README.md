# Design Pattern Catalog

Patterns used across the project, with where they appear and why.

> Fill entries as modules document their patterns in `kb/modules/{name}.md`.

| Pattern | Where Used | Module | Why |
|---------|-----------|--------|-----|
| Adapter | BinanceAdapter, RSS/CryptoPanic adapters | Market Data, News & Sentiment | Swappable external providers |
| Plugin Registry | StrategyRegistry | Strategy Engine | Open-Closed extension for strategies |
| Composite | MajorityVote, WeightedScore combiners | Strategy Engine | Strategy composition |
| Observer | Leaderboard subscribes to BacktestCompleted | Event Infrastructure | Reactive ranking without coupling |
| Job Queue / Worker | Backtest execution | Event Infrastructure | Async scale for long-running work |
| BFF | DashboardService | Event Infrastructure | Frontend-specific composition |
| Graceful Degradation | SentimentStrategy returns HOLD | News & Sentiment | Fault tolerance |
| [TODO] | [TODO] | [TODO] | [TODO] |
