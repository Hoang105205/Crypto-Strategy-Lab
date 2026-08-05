# Business Flows Index

This directory contains end-to-end business use case flows. Each file shows
how multiple modules cooperate to fulfill a business scenario.

| Flow | File | Owner | Status | Modules |
|------|------|-------|--------|---------|
| Realtime Market Data | `flows/realtime-market-data.md` | Hoàng | Draft | Market Data, Frontend |
| Strategy Backtest | `flows/strategy-backtest.md` | Member B | Draft | Strategy Engine, Event Infrastructure |
| Strategy Search Loop | `flows/strategy-search-loop.md` | Member D | Draft | Event Infrastructure, Strategy Engine |
| News & Sentiment Pipeline | `flows/news-sentiment-pipeline.md` | Member C | Draft | News & Sentiment |
| Composite Strategy with Sentiment | `flows/composite-with-sentiment.md` | Member B | Draft | Strategy Engine, News & Sentiment |
| Leaderboard Update | `flows/leaderboard-update.md` | Member D | Draft | Event Infrastructure, Frontend |

> Module files (`kb/modules/`) capture **what's inside** each module.
> Flow files capture **how modules cooperate** end-to-end.
> ADRs (`kb/ADR/`) capture **why** decisions were made.
