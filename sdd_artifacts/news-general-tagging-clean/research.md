# Research: news-general-tagging-clean

## Decisions

### D1: Dynamic Coin Tagging via Database vs In-Memory Hardcoding
- **Chosen**: Read active `baseAsset` list dynamically from PostgreSQL `TradingPair` table.
- **Rationale**: Adding new trading pairs in Supabase/PostgreSQL requires zero code changes to support news categorization.
- **Alternatives considered**:
  - Hardcoded list: Rejected because it violates OCP (Open-Closed Principle) and Constitution Article III.
  - Dedicated NLP entity recognition: Rejected because it introduces excessive complexity for a 4-week project scope.

### D2: Tagging Non-Trading / Unrecognized News as `GENERAL`
- **Chosen**: Explicit `['GENERAL']` tag.
- **Rationale**: Distinguishes macro/industry news from coin-specific news, preventing BTC data contamination while allowing users to filter general news explicitly.
- **Alternatives considered**:
  - Empty array `[]`: Rejected because SQL array contains queries (`has`, `hasSome`) are more ergonomic with explicit tags.
  - Hardcode `['BTC']`: Rejected as an anti-pattern violating Constitution Article VI (Explicit Over Implicit).

### D3: React 19 State Synchronization & ESLint 9 Compliance
- **Chosen**: Move state resets (`setCurrentPage(1)`) into explicit user interaction handlers (`handleTabClick`, `handleToggleMultiCoin`, etc.) rather than calling `setState` inside `useEffect`.
- **Rationale**: Conforms to official React 19 guidelines ("You Might Not Need an Effect") and prevents cascading re-render warnings in ESLint 9.
