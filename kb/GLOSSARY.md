# Glossary

Domain-specific terms used across the project. Use these terms consistently
in code, documentation, and communication.

| Term | Definition | Used In |
|------|-----------|---------|
| Candle (OHLCV) | One price bar: open, high, low, close, volume for a timeframe | Market Data, Strategy Engine |
| Strategy | An algorithm that analyzes candles and emits BUY / SELL / HOLD signals | Strategy Engine |
| Composite Strategy | Multiple strategies combined via a combiner (MajorityVote, WeightedScore) | Strategy Engine |
| Signal | Output of a strategy: BUY, SELL, or HOLD | Strategy Engine |
| Backtest | Simulating a strategy over historical candles | Strategy Engine, Event Infrastructure |
| Evaluation Metrics | Return, Win Rate, Max Drawdown, Sharpe Ratio | Strategy Engine |
| Leaderboard | Top-K ranked strategies by evaluation metric | Event Infrastructure |
| Search Loop | Continuous cycle: generate candidates → backtest → evaluate → rank | Event Infrastructure |
| Strategy Generator | Algorithm producing candidate strategies (Random, Domain-Guided) | Strategy Engine |
| Sentiment Score | Numeric sentiment of a news article (VADER) | News & Sentiment |
| Adapter | Class implementing a provider interface (Binance, RSS, CryptoPanic) | Market Data, News & Sentiment |
| Event | Typed message on the event bus (e.g., `MarketDataUpdated`) | Event Infrastructure |
| Job | Unit of async work in the queue (e.g., a backtest) | Event Infrastructure |
| Worker | Queue consumer process executing jobs | Event Infrastructure |
| Dead-letter Queue | Destination for jobs that exhausted retries | Event Infrastructure |
| BFF | Backend-for-Frontend — dashboard composition layer | Event Infrastructure |

## Naming Conventions
- **API paths**: kebab-case (e.g., `/api/market-data`, `/api/strategy-backtest`)
- **Database tables**: snake_case (e.g., `backtest_result`)
- **Code variables**: camelCase (e.g., `backtestResult`)
- **Code constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_COUNT`)
- **React components**: PascalCase (e.g., `CandlestickChart`)
- **Events**: PascalCase with past-tense verb where applicable (e.g., `BacktestCompleted`)
- **Interfaces**: `I` prefix (e.g., `IMarketDataAdapter`)
- **Files**: kebab-case for all files (e.g., `market-data.service.ts`)
