# Business Flow: Composite Strategy with Sentiment

> **Owner**: Member B
> **Status**: Draft
> **Last Updated**: 2026-08-05

## 1. Overview
- **Description**: A composite strategy combines technical strategies with the sentiment signal, producing a single BUY/SELL/HOLD decision
- **Primary Actor**: User (via Frontend Strategy Builder)
- **Business Value**: Shows cross-module composition — technical + sentiment signals in one strategy
- **Modules Involved**: Strategy Engine, News & Sentiment

## 2. Preconditions
- [TODO: fill during planning phase]

## 3. Flow Steps
1. User selects technical strategies + SentimentStrategy + a combiner — Frontend → Strategy Engine via REST
2. Strategy Engine runs each child strategy over candles — Strategy Engine (internal)
3. SentimentStrategy reads the latest sentiment score — Strategy Engine → News & Sentiment via interface
4. Combiner (MajorityVote / WeightedScore) produces the final signal — Strategy Engine (internal)
5. Composite strategy saved as a versioned entity — Strategy Engine → PostgreSQL

## 4. Postconditions
- [TODO: fill during planning phase]

## 5. Alternative Paths
### [TODO Path Name]
- [TODO]

## 6. Error & Exception Flows
### Sentiment service unavailable
- SentimentStrategy returns HOLD; composite still evaluates with remaining signals [TODO: detail]

## 7. Business Rules
- **BR-1**: SentimentStrategy is registered in the StrategyRegistry like any other strategy — no special-casing

## 8. Related
- **Contracts**: `kb/contracts/strategy.yaml`, `kb/contracts/news.yaml`
- **ADRs**: ADR-0003, ADR-0009
- **Module files**: `kb/modules/strategy-engine.md`, `kb/modules/news-sentiment.md`
