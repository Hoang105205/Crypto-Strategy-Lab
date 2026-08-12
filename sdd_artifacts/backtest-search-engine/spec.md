# Feature Specification: Backtest Engine, Evaluator, Search Generators & Versioning

**Feature**: `backtest-search-engine`
**Created**: 2026-08-12
**Status**: Draft
**Input**: User description: "Triển khai Backtest Engine (IBacktester), Evaluator metrics (IEvaluator), Search Generators (Random & DomainGuided), và Versioning Service"

## User Scenarios & Testing

### User Story 1 - Backtest Execution Engine (Priority: P1)

As a trading system, I want a `BacktestEngine` implementing `IBacktester` that simulates trades over a chronological sequence of candles so that strategy performance can be evaluated deterministically.

**Why this priority**: Core engine required to evaluate any strategy against historical market data.
**Independent Test**: Pass a strategy that emits a BUY signal on candle 5 and SELL on candle 10. Verify that a `Trade` object is recorded with entry at candle 5 price, exit at candle 10 price, correct PnL, and position closed cleanly.

**Acceptance Scenarios**:
1. **Given** a sequence of `Candle` objects and a strategy, **When** `backtester.run(strategy, candles, config)` is invoked, **Then** iterate candle-by-candle, execute strategy `analyze()`, track position (Long/Short), and return a array of closed `Trade` objects.
2. **Given** an open position at the end of the candle array, **When** backtest finishes, **Then** force-close the open position on the final candle price to ensure no unclosed trades are left in the results.

---

### User Story 2 - Strategy Performance Evaluator (Priority: P1)

As an quantitative analyst or trader, I want an `Evaluator` implementing `IEvaluator` that calculates key quantitative metrics (`totalReturn`, `winRate`, `maxDrawdown`, `sharpeRatio`, `profitFactor`, `totalTrades`).

**Why this priority**: Required for ranking strategies on the leaderboard and comparing algorithms.
**Independent Test**: Pass a list of known trades to `Evaluator`. Verify exact calculation of `totalReturn` (sum PnL / initial capital), `winRate` (winning trades / total trades), `maxDrawdown` (peak-to-trough decline), `profitFactor` (gross profit / gross loss), and `sharpeRatio`.

**Acceptance Scenarios**:
1. **Given** a trade history array, **When** `evaluator.evaluate(trades, initialCapital)` is called, **Then** return a valid `EvaluationMetrics` object.
2. **Given** an empty trade array, **When** evaluated, **Then** return 0 for all metrics without throwing division-by-zero errors.

---

### User Story 3 - Search Engine Strategy Generators (Priority: P2)

As an automated strategy search loop, I want `RandomGenerator` and `DomainGuidedGenerator` implementing `IStrategyGenerator` to automatically generate candidate strategy variations and composite combinations.

**Why this priority**: Powers automated discovery of profitable strategy ensembles.
**Independent Test**: Call `randomGenerator.generate(5)`. Verify it returns 5 valid `IStrategy` instances with randomized parameters.

**Acceptance Scenarios**:
1. **Given** `RandomGenerator`, **When** `generate(N)` is called, **Then** return N instantiated strategies with random parameter variations.
2. **Given** `DomainGuidedGenerator`, **When** `generate(N)` is called, **Then** return N composite strategies combining trend-following (MA) and momentum (RSI) with `MajorityVoteCombiner` or `WeightedScoreCombiner`.

---

### User Story 4 - Strategy Versioning Service (Priority: P2)

As a system service, I want a `StrategyVersioningService` that persists immutable snapshots of strategies and their parameter configurations into the database (via Prisma or mock in-memory store).

**Why this priority**: Fulfills ADR-0008 (Immutable Strategy Versioning for experiment reproducibility).
**Independent Test**: Save a strategy version, retrieve it by ID or type, and verify all parameters match the saved snapshot.

**Acceptance Scenarios**:
1. **Given** a strategy instance, **When** `saveVersion(strategy)` is called, **Then** create and store an immutable `StrategyVersion` record.
2. **Given** an existing `strategyVersionId`, **When** queried, **Then** return the exact historical snapshot.

## Requirements

### Functional Requirements
- **FR-001**: System MUST implement `Backtester` adhering to `IBacktester`.
- **FR-002**: System MUST implement `Evaluator` adhering to `IEvaluator`.
- **FR-003**: System MUST implement `RandomGenerator` and `DomainGuidedGenerator` adhering to `IStrategyGenerator`.
- **FR-004**: System MUST implement `StrategyVersioningService` managing `StrategyVersion` records.
- **FR-005**: All implementations MUST handle edge cases gracefully (0 candles, 0 trades, division by zero).

### Key Entities
- **IBacktester**: `run(strategy: IStrategy, candles: Candle[], config: BacktestConfig): Trade[]`
- **IEvaluator**: `evaluate(trades: Trade[], initialCapital: number): EvaluationMetrics`
- **IStrategyGenerator**: `generate(count: number): IStrategy[]`
- **StrategyVersion**: Immutable database model of strategy configurations.

## Success Criteria
- **SC-001**: Backtester correctly generates trades for single and composite strategies.
- **SC-002**: Evaluator computes all 6 metrics accurately against test datasets.
- **SC-003**: Generators yield executable `IStrategy` arrays.
- **SC-004**: Versioning service successfully persists and retrieves strategy snapshots.

## KB Cross-References
- **Architecture**: `kb/modules/strategy-engine.md`
- **Contracts**: `kb/contracts/strategy.yaml`
- **Flows**: `kb/flows/strategy-backtest.md`
- **ADRs**: ADR-0008 (Strategy Versioning)
