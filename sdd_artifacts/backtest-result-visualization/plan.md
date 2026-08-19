# Implementation Plan: backtest-result-visualization

**Feature**: `backtest-result-visualization` | **Date**: 2026-08-19 | **Spec**: spec.md

## Summary
Add robust Multi-tenant Auth filtering to the Strategy Engine controllers to scope data by `userId`. Enhance the Backtester outputs with critical risk and cost fields (SL, TP, Slippage, Cost, Vol) based on the Strategy Contract, and integrate these fields into the Frontend's Trade Details Table and Equity Curve Chart to create a fully-featured, visual backtest analysis workspace.

## Technical Context
**Language/Version**: TypeScript / NestJS (Backend), React 19 / Next.js (Frontend)
**Primary Dependencies**: `@supabase/ssr` (Auth), `lightweight-charts` v5 (Equity Curve)
**Storage**: PostgreSQL / Prisma
**Testing**: Jest (backend), Vitest (frontend)
**Target Platform**: Web Monolith
**Project Type**: Fullstack Web Application
**Constraints**: Follows `kb/CONSTITUTION.md` (Modular Monolith, Shared Interface Communication, Simplicity over Cleverness).

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Architecture Quality | ✅ PASS | Utilizes standard NestJS DI and Guard patterns. Respects React Component boundaries. |
| II. Contract-Driven | ✅ PASS | Fully aligns with `kb/contracts/auth.yaml` and `kb/contracts/strategy.yaml`. |
| IV. Simplicity Over Cleverness | ✅ PASS | Simply passing `@CurrentUser()` and adding basic TS math fields. Reusing `lightweight-charts` rather than adding a heavy dependency. |

## Architecture Decision
Backend data scoping aligns with ADR-0016 (Data Scoping via `userId`). We will inject `@CurrentUser()` in `StrategyController` and pass it down to services. The Backtester enhancement is a strict business-logic translation of `BacktestConfig` into `Trade` outputs.
Frontend integrates existing components (`EquityCurveChart`, `TradeDetailTable`) authored by Hoàng.

**Approach**: Monolith Extension / Data Integration
**Rationale**: No new modules are needed. We are hydrating the exact contracts defined in the KB.
**Modules affected**: Strategy Engine (Controllers & Backtester), Frontend (Strategy Builder UI)
**E2E flows affected**: Flow 1 (User Backtest)
**New modules needed**: None.

## Source Code Structure
- **Backend**:
  - `apps/backend/src/strategy/controllers/strategy.controller.ts` (Add `SupabaseJwtGuard` and `@CurrentUser()`)
  - `apps/backend/src/strategy/backtester/backtester.service.ts` (Update `run` to inject SL/TP/Cost/Slippage)
- **Frontend**:
  - `apps/frontend/src/app/strategies/page.tsx` (or `strategy/page.tsx`) - Wire in `EquityCurveChart` and `TradeDetailTable` using data returned by the backend.
  - `apps/frontend/src/components/trade-detail-table.tsx` - Verify the table handles the new fields.
  - `apps/frontend/src/components/chart/equity-curve-chart.tsx` - Verify line chart integration.
