# Module: Strategy Engine

> **Owner**: Member B
> **Status**: Draft
> **Last Updated**: 2026-08-05

## 1. Overview
- **Responsibility**: Register, analyze, compose, backtest, evaluate, and search trading strategies
- **Layer**: Backend
- **Depends on**: `IMarketDataService`, `IEventBus`, `IJobQueue` (shared interfaces only)
- **Depended by**: Event Infrastructure (via interfaces), News & Sentiment (SentimentStrategy registration)
- **Contracts**: `kb/contracts/strategy.yaml`
- **Source files**: `apps/backend/strategy/`
- **Related ADRs**: ADR-0003 (Plugin Architecture), ADR-0008 (Strategy Versioning)

## 2. Component Architecture

### Components
| Component | Responsibility | Pattern | File(s) |
|-----------|---------------|---------|---------|
| StrategyRegistry | register() + analyze() pipeline | Plugin Registry | [TODO] |
| MA / RSI / Bollinger / SR Strategies | Signal generation | Strategy | [TODO] |
| MajorityVote / WeightedScore | Composite combining | Composite | [TODO] |
| Backtester | Simulate strategy over historical candles | [TODO] | [TODO] |
| Evaluator | Return, WinRate, MaxDrawdown, Sharpe | [TODO] | [TODO] |
| Search Generators | Random, Domain-Guided candidate generation | Strategy | [TODO] |

### Component Diagram
[TODO: fill during planning phase]

## 3. Design Patterns

### Plugin Architecture (Open-Closed Principle)
- **Where**: StrategyRegistry
- **Why**: New strategy = 1 file + 1 register() call, zero changes elsewhere
- **How**: [TODO]
- **Trade-offs**: [TODO]

### Composite Pattern
- **Where**: Composite strategies (MajorityVote, WeightedScore)
- **Why**: [TODO]
- **How**: [TODO]
- **Trade-offs**: [TODO]

## 4. Internal Data Flow
[TODO: fill during planning phase]

## 5. Sequence Diagrams

### Analyze Candles with Registered Strategies
[TODO: fill during planning phase]

## 6. Data Model
| Entity | Fields | Relationships |
|--------|--------|---------------|
| Strategy | [TODO — JSONB params] | [TODO] |
| BacktestResult | [TODO] | [TODO] |

## 7. API Surface
See `kb/contracts/strategy.yaml`. [TODO: summarize endpoints here]

## 8. Quality Attributes
- **Security**: [TODO]
- **Performance**: Backtesting scale 100 → 100k jobs via queue workers [TODO]
- **Error handling**: [TODO]

## 9. Testing Strategy
- **Unit tests**: Strategy signals, evaluator metrics, combiners [TODO]
- **Integration tests**: [TODO]

## 10. Open Questions / TODOs
- [ ] [unresolved items]
