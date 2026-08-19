# Feature Specification: Auth + Trade Enhancements + Equity Curve

**Feature**: `auth-trade-stats`
**Created**: 2026-08-18
**Status**: Draft
**Input**: "Implement Supabase Auth, extend Trade type, build equity curve chart and trade detail table"

## User Stories

### US1 — User Registration and Login (P1)
A user registers with email/password via Supabase Auth. After login, they see the dashboard with their scoped data. Unauthenticated users are redirected to /login.

### US2 — Per-User Data Scoping (P1)
When a logged-in user views strategies, backtests, or leaderboard, they see system-discovered data (shared, userId=null) + their own user-created data (private, userId=their UUID).

### US3 — Trade Detail Table (P2)
When a user views a backtest result, they see a table with: Entry Time, Exit Time, Direction, Volume (USD), Entry Price, Exit Price, StopLoss, TakeProfit, Transaction Cost, Slippage, Profit.

### US4 — Equity Curve Chart (P2)
On the home page dashboard, a cumulative profit line chart visualizes the equity curve from the latest backtest's trades.

## Requirements

- **FR-001**: System MUST provide Supabase Auth integration (register, login, logout) via @supabase/ssr on frontend
- **FR-002**: Backend MUST verify Supabase JWTs via SupabaseJwtGuard on all protected REST endpoints
- **FR-003**: Backend MUST expose @CurrentUser() decorator that extracts userId from verified JWT
- **FR-004**: Prisma schema MUST have nullable userId on StrategyVersion, BacktestResult, LeaderboardEntry
- **FR-005**: Trade interface MUST include stopLoss?, takeProfit?, transactionCost?, slippage?, volumeUsd?
- **FR-006**: BacktestConfig MUST include stopLossPercent? and takeProfitPercent?
- **FR-007**: Frontend MUST have login/register pages with email/password forms
- **FR-008**: Frontend API client MUST attach Authorization: Bearer <token> header on all requests
- **FR-009**: Frontend MUST render an equity curve chart (cumulative profit line) from Trade[]
- **FR-010**: Frontend MUST render a trade detail table with all fields from todo #4

## KB Cross-References
- **Contracts**: `kb/contracts/auth.yaml`, `kb/contracts/strategy.yaml` (updated Trade + BacktestConfig)
- **ADRs**: ADR-0015 (Supabase Auth), ADR-0016 (app-level userId filtering)
- **Constitution**: v1.2 — auth constraints amended
- **Module**: `kb/modules/auth.md`
