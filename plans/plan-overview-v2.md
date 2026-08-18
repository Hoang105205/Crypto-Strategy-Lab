# Crypto Strategy Lab — Plan v2: New Requirements

> **Version**: 2.0 (supplement to plan-overview.md v3.0)
> **Author**: Lưu Huy Hoàng (Architect)
> **Date**: 2026-08-18
> **Source**: `plans/todo.md` — 6 items, 3 already done, 3 new system-changing

---

## 1. What's Already Done (no changes needed)

| Todo Item | Owner | Evidence |
|---|---|---|
| 2.1 Historical candles (~1000 per timeframe) | Hoàng | REST `GET /api/market-data/candles` + `useMarketData` hook |
| 2.2 Realtime candle (update same / append new) | Hoàng | `series.update(bar)` in `useMarketData` handles both |
| 6 News crawler + LLM sentiment | Thuận | News module + Python FastAPI sentiment service |

---

## 2. New Requirements — 3 System-Changing Items

### 2.1 Auth System (todo #1 + note "Leaderboard per-user")

**Decision**: Use Supabase Auth (ADR-0015) with app-level userId filtering (ADR-0016).

**Constitution impact**: Amends §Constraints — removes "no user accounts", adds auth constraints.

| Task | Owner | Scope | Est. |
|---|---|---|---|
| A1 — Prisma: add `userId` to StrategyVersion, BacktestResult, LeaderboardEntry, SearchLoopRun | Hoàng | Migration `add_user_auth` | 0.5d |
| A2 — AuthModule: Supabase JWT verification guard + `@CurrentUser()` decorator | Hoàng | NestJS: auth.guard.ts, current-user.decorator.ts, auth.module.ts | 0.5d |
| A3 — Protect REST endpoints with `@UseGuards(SupabaseJwtGuard)` | Hoàng | Add guard to all controllers | 0.5d |
| A4 — Frontend auth: `@supabase/ssr` + login/register page + AuthContext + Bearer header | Hoàng | Next.js: app/login/page.tsx, lib/supabase-client.ts, api-client.ts update | 0.5d |
| A5 — Constitution amendment + ADR-0015 + ADR-0016 | Hoàng | kb/CONSTITUTION.md, kb/ADR/0015, kb/ADR/0016 | 0.5d |
| A6 — Add userId filter to StrategyVersion + BacktestResult queries | Huy | Strategy controller/service | 0.5d |
| A7 — Add userId filter to LeaderboardEntry + SearchLoopRun; per-user leaderboard | Phương | Leaderboard + loop service | 1d |
| A8 — Loop toggle button (start/pause/stop) on frontend — per-user | Phương | Dashboard component | 0.5d |

**Hoàng's auth infra provides** (teammates consume, don't build their own):
- `SupabaseJwtGuard` — verifies Supabase JWT on incoming requests
- `@CurrentUser()` decorator — extracts `userId` (UUID) from verified JWT
- `auth.contract.yaml` — documents the token format, endpoints, and decorator usage

**Each teammate adds** `@CurrentUser()` to their own controllers and filters queries by `userId`. Hoàng does NOT modify their services.

### 2.2 Trade Detail Fields (todo #4)

**Decision**: Core requirement — moves §38 (Extensions) items into MVP scope.

| Task | Owner | Scope | Est. |
|---|---|---|---|
| B1 — Extend `Trade` interface: add `stopLoss?`, `takeProfit?`, `transactionCost?`, `slippage?`, `volumeUsd?` | Hoàng | `libs/shared/src/types/strategy.ts` + `kb/contracts/strategy.yaml` | 0.5h |
| B2 — Backtester outputs stopLoss/takeProfit/transactionCost/slippage per trade | Huy | Backtester engine | 1d |
| B3 — Frontend trade detail table component | Hoàng | `components/trade-detail-table.tsx` + strategy page | 1d |

**No Prisma migration** — `trades` is `Json` type, new fields go into the JSON.

### 2.3 Equity Curve Chart (todo #5)

| Task | Owner | Scope | Est. |
|---|---|---|---|
| C1 — `EquityCurveChart.tsx` — cumulative profit line chart from `Trade[]` | Hoàng | lightweight-charts LineSeries | 0.5d |
| C2 — Integrate equity curve + stats panel into home page | Hoàng | `app/page.tsx` update | 0.5d |

### 2.4 Scalability Documentation (todo #2 Question: 3000 users)

| Task | Owner | Scope |
|---|---|---|
| D1 — Architecture report section: fan-out pattern explanation | Hoàng | W4 — no code |

The current architecture already handles 3000 users:
- Backend maintains ~20 Binance WS streams (5 pairs × 4 timeframes), deduped via subscription deduplication
- Socket.io rooms fan out to N clients — 4000 connections within Node.js limits
- Bottleneck: CPU serialization (batchable) + bandwidth (~400KB/tick, manageable)

---

## 3. Updated ADR Registry

| ADR | Title | Owner | Status |
|---|---|---|---|
| 0001–0014 | (existing — see plan-overview.md §7) | various | Accepted |
| **0015** | Supabase Auth for User Authentication | Hoàng | Proposed |
| **0016** | App-Level userId Filtering (no RLS) | Hoàng | Proposed |

---

## 4. Updated Deliverables Checklist (additions to plan-overview.md §10)

- [ ] User registration + login (Supabase Auth)
- [ ] Per-user leaderboard (filtered by userId)
- [ ] Per-user strategy + backtest history
- [ ] Trade detail table with StopLoss, TakeProfit, TransactionCost, Slippage
- [ ] Equity curve chart on home page
- [ ] Loop toggle button (start/pause/stop) per user
- [ ] Scalability section in architecture report (3000 users)

---

## 5. Dependencies

```
A1 (Prisma migration) ──► A2 (guard) ──► A3 (protect endpoints)
                                        ──► A4 (frontend auth)
                                        ──► A6 (Huy: userId filter)
                                        ──► A7 (Phương: userId filter)

B1 (Trade type extend) ──► B2 (Huy: backtester output) ──► B3 (frontend table)

C1 (equity curve) ──► C2 (dashboard integration)

A5 (docs) — can be done anytime after A2
D1 (scalability doc) — W4
```

**Critical path**: A1 → A2 → A3 → A4 (auth must be functional before teammates can test their userId filters)
