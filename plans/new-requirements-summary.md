# New Requirements Summary — Who Handles What

> **Date**: 2026-08-18 | **Author**: Hoàng (Architect)
> **Source**: `plans/todo.md` — 6 items, 3 already done, 3 new
> **⚠️ MUST READ for all members before starting any new work**

---

## Overview

Three new system-changing requirements from `plans/todo.md`:

| # | Requirement | Status | Impact |
|---|---|---|---|
| 1 | Register/Login + per-user leaderboard | 🆕 NEW | Auth system, Constitution amendment, all members add userId |
| 4 | Trade detail table (StopLoss, TakeProfit, Slippage, TxCost) | 🆕 NEW | Extend Trade type + backtester output + frontend table |
| 5 | Stats visualization (equity curve) | 🆕 NEW | New frontend chart component |

Already done: Historical candles (#2.1), Realtime candle (#2.2), News + sentiment (#6).
Scalability question (#2.Q) = documentation only, W4.

---

## Architecture Decision: System Loop is Global

The search loop runs **24/7 as a system process** — not per-user. It discovers strategies
that are **shared** across all users. The system leaderboard is the master, always updating.

Each user's leaderboard view = `WHERE userId IS NULL OR userId = :currentUserId`
- `userId = null` → system-discovered strategies (shared, from the loop)
- `userId = <uuid>` → user-created strategies (private, registered by that user)

User "start/stop" button = subscribe/unsubscribe to live leaderboard WebSocket updates.
The system loop continues regardless.

---

## Task Assignments

### Hoàng (Auth Infrastructure + Shared Types)

| Task | What | Status | KB Reference |
|---|---|---|---|
| **A1** | Prisma migration: add `userId String?` to StrategyVersion, BacktestResult, LeaderboardEntry | ✅ Done | `kb/contracts/auth.yaml` §data_scoping |
| **A2** | `SupabaseJwtGuard` + `@CurrentUser()` decorator + `RequireAuth` guard | ✅ Done | `kb/contracts/auth.yaml` §guards, §decorators |
| **A3** | Protect existing REST endpoints with `@UseGuards(SupabaseJwtGuard)` | ✅ Done | `kb/contracts/auth.yaml` |
| **A4** | Frontend: `@supabase/ssr` + login/register page + AuthContext + Bearer header | ✅ Done | `kb/contracts/auth.yaml` §frontend |
| **B1** | Extend `Trade` type: add stopLoss, takeProfit, transactionCost, slippage, volumeUsd | ✅ Done | `kb/contracts/strategy.yaml` §Trade |
| **D1** | Scalability doc — 3000 users fan-out | ⬜ W4 | Architecture report |

> **Note**: Hoàng also wrote **reference implementations** for trade detail table and equity curve chart (see Huy's section below). These are committed but Huy owns and iterates on them.

### Huy (userId Filter + Backtest Output + Backtest Visualization)

| Task | What | KB Reference | Reference Code (already committed) |
|---|---|---|---|
| **A6** | Add `@CurrentUser()` to strategy controller. Filter queries: `WHERE userId IS NULL OR userId = :currentUserId` | `kb/contracts/auth.yaml` §decorators, §data_scoping | — |
| **B2** | Backtester outputs stopLoss/takeProfit/transactionCost/slippage/volumeUsd per trade | `kb/contracts/strategy.yaml` §Trade, §BacktestConfig | — |
| **B3** | Frontend trade detail table component | `kb/contracts/strategy.yaml` §Trade | ✅ `apps/frontend/src/components/trade-detail-table.tsx` — Hoàng wrote this as reference. Huy owns and iterates. |
| **C1** | EquityCurveChart — cumulative profit line chart | `kb/GLOSSARY.md` §Equity Curve | ✅ `apps/frontend/src/components/chart/equity-curve-chart.tsx` — Hoàng wrote this as reference. Huy owns and iterates. |
| **C2** | Integrate equity curve + stats panel into home page / strategy page | — | Uses C1 + B3 above. Wire into the appropriate page where backtest results are displayed. |

**How to start**: Run `/hoang-sdd-specify` with feature description "Add userId filtering to Strategy Engine controllers and extend Backtester trade output". The KB already has all contracts updated — read `kb/contracts/auth.yaml` and `kb/contracts/strategy.yaml`.

### Phương (userId Filter + Loop Toggle)

| Task | What | KB Reference | How to Start |
|---|---|---|---|
| **A7** | Add `@CurrentUser()` to leaderboard/loop controllers. Filter LeaderboardEntry by userId. Loop start/stop = subscribe/unsubscribe to WebSocket updates. | `kb/contracts/auth.yaml` §data_scoping, `kb/contracts/events.yaml` §LeaderboardEntryPayload | Read `kb/contracts/auth.yaml`, add guard + decorator to leaderboard/loop controllers. Filter: `WHERE userId IS NULL OR userId = :currentUserId`. |
| **A8** | Loop toggle button on frontend — start/pause/stop (subscribe/unsubscribe to live leaderboard updates) | `kb/contracts/events.yaml` §LeaderboardUpdated | Add a toggle button to LoopStatusPanel. When ON: subscribe to `leaderboard:update` WebSocket. When OFF: unsubscribe (freeze view). |

**How to start**: Run `/hoang-sdd-specify` with feature description "Add userId filtering to Leaderboard and Loop controllers, add loop toggle UI". The KB already has all contracts updated — read `kb/contracts/auth.yaml` and `kb/contracts/events.yaml`.

### Thuận

No new tasks. News and sentiment are global (no userId filter needed).

---

## KB Files Updated (2026-08-18)

| File | Action | What changed |
|---|---|---|
| `kb/CONSTITUTION.md` | Updated | v1.2 — removed "no user accounts", added Supabase Auth + ADR refs |
| `kb/ARCHITECTURE.md` | Updated | Security Model — auth, authorization, data scoping |
| `kb/MODULES.md` | Updated | Added Auth module, noted userId dependency on Strategy + Event modules |
| `kb/GLOSSARY.md` | Updated | Added 9 auth terms (Authentication, Authorization, SupabaseJwtGuard, @CurrentUser(), etc.) |
| `kb/contracts/auth.yaml` | Created | Full auth contract: guards, decorators, endpoints, data scoping rules |
| `kb/contracts/strategy.yaml` | Updated | Added `userId` to StrategyVersion + BacktestResult. Extended Trade (5 new fields) + BacktestConfig (2 new fields) |
| `kb/contracts/events.yaml` | Updated | Added `userId` to BacktestRequested, BacktestCompleted, LeaderboardEntryPayload. Added stopLossPercent/takeProfitPercent to BacktestConfig |
| `kb/modules/auth.md` | Created | Full auth module architecture (9 sections) |
| `kb/ADR/0015-supabase-auth.md` | Created | Decision: Supabase Auth over custom JWT |
| `kb/ADR/0016-app-level-userid-filtering.md` | Created | Decision: app-level filtering over RLS |

---

## Execution Order

```
Hoàng (DONE):
  ✅ A1 Prisma migration
  ✅ A2 Guard + Decorator
  ✅ A3 Protect endpoints
  ✅ A4 Frontend auth
  ✅ B1 Trade type extend
  ⬜ D1 Scalability doc (W4)

Huy (after pulling Hoàng's code):
  A6 userId filter (depends on SupabaseJwtGuard + @CurrentUser())
  B2 Trade output (depends on B1 type extension — already done)
  B3 Trade detail table (reference code exists — iterate)
  C1 Equity curve chart (reference code exists — iterate)
  C2 Integrate into page (wire B3 + C1 into strategy/backtest page)

Phương (after pulling Hoàng's code):
  A7 userId filter (depends on SupabaseJwtGuard + @CurrentUser())
  A8 Loop toggle UI (depends on A7)
```

**Critical path**: ✅ A1 → A2 → A3 + A4 all DONE. Teammates can start now.
