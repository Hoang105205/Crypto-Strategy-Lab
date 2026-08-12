# Implementation Tasks: Strategy Builder Frontend & UI Components

**Feature**: `strategy-frontend-builder` | **Date**: 2026-08-12

## Execution Rules
- `[ ]` = Pending | `[x]` = Done | `[-]` = Blocked/Skipped
- `[P]` = Can be executed in parallel with other `[P]` tasks in the same phase.
- Do not proceed to the next phase until all tasks in the current phase are `[x]`.

---

### Phase 1: UI Components Implementation
- [P] **T1.1**: Implement `StrategyCard` (`apps/frontend/src/components/strategy/StrategyCard.tsx`).
- [P] **T1.2**: Implement `ParameterEditor` (`apps/frontend/src/components/strategy/ParameterEditor.tsx`).
- [P] **T1.3**: Implement `CompositeBuilder` (`apps/frontend/src/components/strategy/CompositeBuilder.tsx`).
- [P] **T1.4**: Implement `TradeTable` (`apps/frontend/src/components/strategy/TradeTable.tsx`).
- [ ] **T1.5**: Create barrel export `apps/frontend/src/components/strategy/index.ts`.

### Phase 2: Page Implementation & Styling
- [ ] **T2.1**: Implement `strategy-builder.css` (`apps/frontend/src/app/strategy/strategy-builder.css`) matching `kb/DESIGN.md` dark mode tokens.
- [ ] **T2.2**: Implement `Strategy Builder Page` (`apps/frontend/src/app/strategy/page.tsx`). Integrates API calls (`/api/strategies`, `/api/strategies/composite`, `/api/strategies/backtest`), tab switching, and state management.
