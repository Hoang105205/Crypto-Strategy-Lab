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
| Leaderboard | Caller-visible Top-K ranked strategies: system entries plus the current user's private entries, computed after visibility scoping | Event Infrastructure, Frontend |
| Leaderboard Entry | Denormalized Event Infrastructure read-model row created from `BacktestCompleted`; it stores copied metrics plus logical `strategyVersionId`/`backtestResultId` references and is not the authoritative backtest result | Event Infrastructure |
| Logical ID Reference | UUID stored to identify an entity owned by another module without declaring a Prisma relation or database foreign key; validity is maintained through public contracts and reconciliation | All modules |
| Orphaned Leaderboard Entry | A leaderboard projection whose source result is missing or whose strategy/owner IDs no longer match; confirmed orphans are deleted by the startup/five-minute reconciler and survivors are reranked | Event Infrastructure |
| Search Loop | One global system process continuously cycling through generate → backtest → evaluate → rank; browser navigation and Live updates do not control it | Event Infrastructure |
| Search Loop Supervisor | In-process scheduler that reads persistent desired state, owns a PostgreSQL lease, and creates successive bounded Search Loop Runs while automation is enabled (ADR-0017) | Event Infrastructure |
| Search Loop Control | Singleton PostgreSQL record containing the global loop ON/OFF desired state, rolling backtest configuration, retry schedule, and supervisor lease; it survives backend restart and has no user ownership | Event Infrastructure |
| Strategy Generator | Algorithm producing candidate strategies (Random, Domain-Guided) | Strategy Engine |
| Sentiment Score | Numeric sentiment of a news article (VADER) | News & Sentiment |
| Adapter | Class implementing a provider interface (Binance, RSS, CryptoPanic) | Market Data, News & Sentiment |
| Event | Typed message on the event bus (e.g., `MarketDataUpdated`) | Event Infrastructure |
| Job | Unit of async work in the queue (e.g., a backtest) | Event Infrastructure |
| Worker | Queue consumer process executing jobs | Event Infrastructure |
| Dead-letter Queue | Destination for jobs that exhausted retries | Event Infrastructure |
| BullMQ | Node.js queue library used by Event Infrastructure to persist and coordinate backtest jobs through Redis | Event Infrastructure |
| Redis | External data store required by BullMQ for durable queue state, priority, retry delays, locks, and job retention; not merely a cache in this context | Event Infrastructure |
| Stalled Job | BullMQ job whose worker lock was not renewed; it is recovered for another attempt subject to the configured stalled-job policy | Event Infrastructure |
| BFF | Backend-for-Frontend — dashboard composition layer | Event Infrastructure |
| Strategy Registry | Central registry implementing Plugin Pattern — `register()` adds a strategy, `get()` retrieves by name, `analyze()` delegates to the registered strategy | Strategy Engine |
| Strategy Version | Immutable snapshot of a strategy's type + parameters + version number. New params = new version. Used for reproducibility (ADR-0008) | Strategy Engine |
| ICombiner | Interface for combining multiple strategy signals into one. Implementations: `MajorityVoteCombiner`, `WeightedScoreCombiner` | Strategy Engine |
| Open-Closed Principle (OCP) | Software design principle: open for extension (new strategies), closed for modification (existing code). Enforced by Plugin Architecture (ADR-0003) | Strategy Engine |
| Domain-Guided Generator | Strategy candidate generator that ensures diversity by selecting from strategy groups: Trend, Momentum, Volatility, Structure, Sentiment | Strategy Engine |
| Reproducibility | Ability to re-run experiment #N with the exact same strategy version + params and get the same result. Enabled by immutable `StrategyVersion` snapshots (ADR-0008) | Strategy Engine |
| INewsProvider | Abstraction interface for news sources (RSS, News API, Web Crawlers) returning normalized `RawArticle` payloads (ADR-0010) | News & Sentiment |
| NewsArticle | Standardized news data entity containing `id`, `title`, `content`, `source`, `publishedAt`, `crawledAt`, `relatedCoins`, `url` | News & Sentiment |
| CrawlerRule | Database entity storing LLM-discovered CSS selectors (`container`, `title`, `content`, `link`, `date`) per domain for fast reusable parsing (ADR-0014) | News & Sentiment |
| Adaptive Web Crawler | Intelligent web crawler that uses LLMs for semantic selector discovery and Cheerio for high-performance extraction with selector caching (ADR-0014) | News & Sentiment |
| Selector Caching | Architectural optimization persisting discovered CSS scraping rules in PostgreSQL to avoid recurring LLM token costs and latency | News & Sentiment |
| Self-Healing Extraction | Fault recovery mechanism that automatically triggers LLM re-discovery when target website redesigns cause selector staleness | News & Sentiment |
| NewsSentimentStrategy | Strategy plugin generating BUY/SELL/HOLD signals from news sentiment scores for composite strategies (e.g. `MA + RSI + News Sentiment`) | News & Sentiment, Strategy Engine |
| Process Isolation | Architecture pattern running Python ML service as an isolated process from NestJS backend to contain CPU loads and crashes (ADR-0009) | News & Sentiment |
| Graceful Degradation | Reliability mechanism falling back to neutral sentiment (`0.0`) and `HOLD` signal when ML sentiment service is unreachable | News & Sentiment |
| Event Bus | Typed pub/sub abstraction (`IEventBus`) wrapping EventEmitter2 for fire-and-forget notifications. Acknowledged operations use public contract interfaces such as `IJobQueue` (ADR-0005/0013) | Event Infrastructure |
| Event Envelope | Wrapper around every published event: `eventId`, `eventType`, `eventVersion`, `occurredAt`, `correlationId`, `payload`. Auto-generated by `IEventBus.publish()` | Event Infrastructure |
| Correlation ID | Identifier propagated across a chain of related events (e.g. `BacktestRequested → BacktestCompleted → LeaderboardUpdated`) so the full chain can be traced in logs | Event Infrastructure |
| Idempotent (handler) | An event handler that produces the same end state no matter how many times the same event is delivered — e.g. Leaderboard upsert keyed on `backtestResultId` | Event Infrastructure |
| Retry Policy | Rule set governing how a failed BullMQ job is retried: three total attempts, active delays of 1s then 4s, and terminal dead-letter handling | Event Infrastructure |
| Backoff | Delay strategy between job attempts; the backtest queue uses a deterministic custom BullMQ schedule of 1s before attempt 2 and 4s before attempt 3 | Event Infrastructure |
| Top-K | The K highest-ranked entries after applying the relevant visibility scope (default K = 10); the namespace-wide event carries only the system Top-K | Event Infrastructure |
| Search Loop Run | One bounded execution record of the global system search process; it has no user ownership. The 24/7 supervisor creates a later run after this record becomes terminal | Event Infrastructure |
| Live Updates Preference | Explicit browser-persisted user choice controlling the leaderboard listener; absent choice defaults OFF, and reload/reconnect never forces ON | Frontend |
| Safe Invalidation | A privacy-safe `leaderboard:update` notification whose payload is not trusted as a viewer snapshot; while the persisted Live updates choice is ON, the app-level provider refetches REST using the current session | Event Infrastructure, Frontend |
| WebSocket Gateway | Server-side component (`PushGateway`) that relays bus events (`LeaderboardUpdated`, `SearchLoopProgress`, etc.) to connected frontend clients over WebSocket | Event Infrastructure |
| Leaderboard Score | Weighted combination of normalized return, win rate, and a risk score, used to rank strategies (see `kb/flows/leaderboard-update.md` BR-2) | Event Infrastructure |
| IMarketDataAdapter | Abstraction interface for external market data sources (Binance, OKX, etc.). Implementations: `BinanceAdapter` (ADR-0004). All exchange-specific parsing stays inside the adapter | Market Data |
| IMarketDataService | Service interface for cached market data access. Other modules depend on this — never on `IMarketDataAdapter` directly. Methods: `getCandles`, `getCandlesRange`, `subscribe`, `unsubscribe` | Market Data, Strategy Engine, Event Infrastructure |
| BinanceAdapter | Concrete adapter implementing `IMarketDataAdapter` for Binance exchange. Calls Binance REST API for historical klines and Binance WebSocket for real-time streams. Parses Binance-specific JSON into normalized `Candle` entities (ADR-0004) | Market Data |
| MarketDataGateway | NestJS WebSocket Gateway that relays live candle data and connection status to connected frontend clients. Emits `candle:update`, `candle:close`, and `status:*` events on `market-data:candles` and `market-data:status` channels | Market Data, Frontend |
| TradingPair | A tradable crypto pair (e.g., `BTCUSDT`) with `baseAsset`, `quoteAsset`, and `isActive` fields. Defined in `kb/contracts/market-data.yaml` | Market Data |
| Subscription Deduplication | Pattern where multiple frontend clients watching the same `symbol:timeframe` share a single Binance WebSocket stream. `subscriberCount` tracks active viewers; the stream closes only when count reaches 0 | Market Data |
| Auto-Reconnect | Automatic reconnection strategy for external WebSocket connections using exponential backoff (1s, 4s, 16s, max 3 attempts). On reconnect, missed candles are fetched via REST API (ADR-0007) | Market Data |

| Authentication | Process of verifying a user's identity. Handled by Supabase Auth (ADR-0015) — email/password only. Frontend uses `@supabase/ssr` for cookie-based sessions | Auth, Frontend |
| Authorization | Process of determining what data a user can access. Implemented via app-level userId filtering (ADR-0016): `WHERE userId IS NULL OR userId = :currentUserId` | All modules |
| SupabaseJwtGuard | NestJS guard that verifies Supabase JWTs from the Authorization header. Fetches JWKS (cached), checks expiry, attaches userId to `request.user` | Auth |
| @CurrentUser() | NestJS parameter decorator that extracts the authenticated userId from `request.user`. Returns `string | null` (null = unauthenticated). MUST be used with `@UseGuards(SupabaseJwtGuard)` | Auth, All modules |
| RequireAuth | Companion guard that rejects requests where userId is null. Use after `SupabaseJwtGuard` for routes requiring a logged-in user | Auth |
| userId (nullable) | Column on StrategyVersion, BacktestResult, LeaderboardEntry. `null` = system/shared data (loop-discovered). Non-null = user-private data. Filter: `WHERE userId IS NULL OR userId = :currentUserId` | Strategy Engine, Event Infrastructure |
| System Data | Data with `userId = null` — shared across all users. Includes loop-discovered strategies, system backtests, and system leaderboard entries | All modules |
| User-Private Data | Data with `userId = <uuid>` — visible only to the owning user. Includes user-created strategies, user-initiated backtests, and user leaderboard entries | All modules |
| Equity Curve | Cumulative profit chart showing account balance growth over time, computed from `BacktestResult.trades[]` | Frontend |

## Naming Conventions
- **API paths**: kebab-case (e.g., `/api/market-data`, `/api/strategy-backtest`)
- **Database tables**: snake_case (e.g., `backtest_result`)
- **Code variables**: camelCase (e.g., `backtestResult`)
- **Code constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_COUNT`)
- **React components**: PascalCase (e.g., `CandlestickChart`)
- **Events**: PascalCase with past-tense verb where applicable (e.g., `BacktestCompleted`)
- **Interfaces**: `I` prefix (e.g., `IMarketDataAdapter`)
- **Files**: kebab-case for all files (e.g., `market-data.service.ts`)
