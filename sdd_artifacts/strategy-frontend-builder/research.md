# Research & Design Decisions: Strategy Builder UI

## 1. Design Aesthetic & Color Palette
- Strict compliance with `kb/DESIGN.md`.
- Deep contrast, high-tech crypto trading aesthetics with glassmorphism card surfaces (`bg-[#1e2329]`, `border-[#2b3139]`).
- Status highlights:
  - `BUY` / Profit: `#0ecb81`
  - `SELL` / Loss: `#f6465d`
  - Primary action buttons: `#fcd535` with hover `#f0b90b` (Black text on gold button).

## 2. Component Hierarchy & Data Flow
- `app/strategy/page.tsx` maintains top-level state (`strategies`, `selectedStrategy`, `tradeResults`, `isLoading`).
- `StrategyCard`: Displays individual strategy items, clicking selects them.
- `CompositeBuilder`: Allows selecting multiple strategies, picking `MajorityVote` or `WeightedScore`, specifying weights, and submitting `POST /api/strategies/composite`.
- `ParameterEditor`: Modifies parameter inputs live.
- `TradeTable`: Displays trade execution logs with column sorting and PnL badges.
