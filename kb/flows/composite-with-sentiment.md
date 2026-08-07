# Business Flow: Composite Strategy with Sentiment

> **Owner**: Huy
> **Status**: Active
> **Last Updated**: 2026-08-06

## 1. Overview
- **Description**: A user creates a composite strategy that combines technical strategies (MA, RSI, Bollinger, etc.) with the SentimentStrategy, using a combiner (MajorityVote or WeightedScore) to produce a single BUY/SELL/HOLD decision. This demonstrates cross-module composition.
- **Primary Actor**: User (via Frontend Strategy Builder — CompositeBuilder component)
- **Business Value**: Shows that technical analysis and sentiment analysis can be combined seamlessly through the plugin architecture. The SentimentStrategy (Member C) plugs into the same `IStrategy` interface — no special-casing. This is a key architecture demonstration.
- **Modules Involved**: Strategy Engine (Huy), News & Sentiment (Member C)

## 2. Preconditions
- At least one technical strategy is registered in `StrategyRegistry` (e.g., MAStrategy, RSIStrategy)
- `SentimentStrategy` is registered in `StrategyRegistry` by the News module (Member C)
- The Python Sentiment Service (FastAPI) is running (for live sentiment scores)
- The user has selected a trading pair (e.g., BTCUSDT) for context
- Strategy versions exist for all child strategies to be composed

## 3. Flow Steps

1. **User opens Composite Builder** — Frontend Strategy Builder → CompositeBuilder component displays available strategies from registry
2. **User selects child strategies** — User drags/selects technical strategies (e.g., MA, RSI) + SentimentStrategy into the composite
3. **User selects combiner** — User chooses `MajorityVote` or `WeightedScore` combiner; if WeightedScore, user configures per-child weights (e.g., MA: 0.3, RSI: 0.3, Sentiment: 0.4)
4. **User names and submits** — Frontend → `POST /api/strategies/composite { childStrategyIds, combinerType, combinerWeights?, name }`
5. **StrategyController validates** — Verify all `childStrategyIds` exist in registry, combiner type is valid, weights sum to 1.0 (for WeightedScore)
6. **StrategyController constructs composite** — `new CompositeStrategy([MAStrategy, RSIStrategy, SentimentStrategy], combiner)`
7. **StrategyVersionService creates snapshot** — Immutable `StrategyVersion` with `isComposite: true`, `childVersionIds`, `combinerType`, `combinerWeights` → saved to PostgreSQL
8. **StrategyRegistry registers composite** — `registry.register(compositeStrategy)` → composite is now available like any single strategy
9. **Frontend displays composite** — StrategyCard shows the composite with its children and combiner type
10. **User can now backtest the composite** — Same flow as `flows/strategy-backtest.md` — the Backtester treats the composite identically to a single strategy

### What happens during composite analysis (step 10, inside the Backtester):

11. **Backtester calls `compositeStrategy.analyze(candles)`** — CompositeStrategy runs each child:
    - `MAStrategy.analyze(candles)` → e.g., BUY (based on MA crossover)
    - `RSIStrategy.analyze(candles)` → e.g., SELL (RSI overbought)
    - `SentimentStrategy.analyze(candles)` → calls `SentimentClient` → HTTP → Python FastAPI → returns e.g., BUY (positive sentiment)
12. **Combiner aggregates signals** — 
    - MajorityVote: [BUY, SELL, BUY] → BUY (2 vs 1)
    - WeightedScore: (0.3×BUY + 0.3×SELL + 0.4×BUY) = (0.3×1 + 0.3×(-1) + 0.4×1) = 0.4 → BUY (positive threshold)
13. **Final signal used for trade simulation** — Backtester uses the composite's single signal to decide entry/exit

## 4. Postconditions
- A new `StrategyVersion` record exists with `isComposite: true` and all child version IDs
- The composite is registered in `StrategyRegistry` and available for backtesting, search loop, and leaderboard
- The composite is visible in the Frontend strategy list as a single entity
- Backtest results for the composite are traceable to the exact child versions and combiner used (reproducibility via ADR-0008)

## 5. Alternative Paths

### Composite without Sentiment (Technical Only)
- Steps 1–10 are identical, but user selects only technical strategies (e.g., MA + RSI + Bollinger)
- SentimentStrategy is not included — this is a valid composition
- All other flows are unchanged

### Composite with Custom Weights (WeightedScore)
- At step 3, user assigns weights that emphasize sentiment (e.g., MA: 0.2, RSI: 0.2, Sentiment: 0.6)
- At step 5, controller validates weights sum to 1.0
- At step 12, WeightedScore combiner applies the custom weights

### Search Loop Generated Composite
- Steps 1–4 are replaced by the `DomainGuidedGenerator` (or `RandomGenerator`) programmatically creating composite candidates
- The generator ensures diversity: at least one strategy from each group (Trend, Momentum, Volatility, Structure, Sentiment)
- Steps 5–13 are identical — composites from the search loop are treated the same as user-created ones

## 6. Error & Exception Flows

### Sentiment Service unavailable (Python FastAPI down)
- At step 11: `SentimentStrategy.analyze()` calls `SentimentClient` → HTTP request fails (timeout or connection refused)
- **Graceful degradation**: `SentimentStrategy` returns `HOLD` signal (neutral — does not influence the composite decision)
- Remaining technical strategies still produce their signals normally
- Combiner aggregates with HOLD included: MajorityVote [BUY, SELL, HOLD] → no majority, defaults to HOLD; WeightedScore [BUY, SELL, HOLD] → weight of HOLD = 0, so only MA and RSI weights matter
- **Key architecture point**: The composite does NOT crash. Charts, market data, and other strategies are unaffected. This is extensibility scenario #5.

### Child strategy not found in registry
- At step 5: `StrategyController` returns `404 Not Found { error: 'Strategy {id} not found in registry' }`
- Flow terminates — composite is not created

### Weights don't sum to 1.0
- At step 5: `StrategyController` returns `400 Bad Request { error: 'Weights must sum to 1.0' }`
- Flow terminates — user corrects weights and resubmits

### Too few child strategies
- At step 5: A composite requires at least 2 child strategies
- `StrategyController` returns `400 Bad Request { error: 'Composite requires at least 2 strategies' }`

## 7. Business Rules
- **BR-1**: SentimentStrategy is registered in the StrategyRegistry like any other strategy — no special-casing in the Registry, Backtester, Evaluator, or Leaderboard (Plugin Architecture, ADR-0003)
- **BR-2**: A composite strategy implements `IStrategy` — it is indistinguishable from a single strategy to any consumer (Composite Pattern)
- **BR-3**: Composite version snapshots are immutable — changing weights or children creates a new version, never modifies an existing one (ADR-0008)
- **BR-4**: `SentimentStrategy` returning HOLD when the sentiment service is down is a design requirement, not a bug — graceful degradation (see Member C's module docs)
- **BR-5**: DomainGuidedGenerator enforces diversity — composites must include strategies from at least 2 different groups (Trend, Momentum, Volatility, Structure, Sentiment)
- **BR-6**: Recursive composition is supported — a composite can contain other composites (the Backtester doesn't differentiate)

## 8. Related
- **Contracts**: `kb/contracts/strategy.yaml`, `kb/contracts/news.yaml`
- **ADRs**: ADR-0003 (Plugin Architecture — uniform IStrategy interface), ADR-0008 (Strategy Versioning — composite snapshots), ADR-0009 (Sentiment Service as Separate Process)
- **Module files**: `kb/modules/strategy-engine.md` (Sections 2, 3, 4), `kb/modules/news-sentiment.md` (SentimentStrategy, SentimentClient, graceful degradation)
- **Related flows**: `kb/flows/strategy-backtest.md` (backtest execution after composite creation), `kb/flows/news-sentiment-pipeline.md` (how sentiment scores are produced), `kb/flows/strategy-search-loop.md` (automated composite generation)
