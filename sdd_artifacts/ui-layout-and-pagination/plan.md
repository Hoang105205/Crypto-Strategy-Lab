# Implementation Plan: UI Layout and Pagination

**Feature**: `ui-layout-and-pagination` | **Date**: 2026-08-19 | **Spec**: spec.md

## Summary
The goal is to enhance the Strategy Builder UI by splitting the Backtest result view into a side-by-side layout (Chart on left, Trades table on right) for desktop viewports. Additionally, we will implement client-side pagination for both the Trades table and the Strategy Catalog grid to improve performance and usability.

## Technical Context
**Language/Version**: TypeScript, React, Next.js (App Router)
**Primary Dependencies**: TailwindCSS
**Storage**: N/A (Client-side UI state only)
**Testing**: Manual Visual Testing
**Target Platform**: Web (Desktop & Mobile)
**Project Type**: Frontend Application
**Performance Goals**: Prevent DOM lag from rendering thousands of rows in the trade table.
**Constraints**: Must adhere to Binance Design constraints defined in `kb/DESIGN.md` (Dark theme, yellow CTAs, proper responsive stacking).

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| P1: Architecture Modularization | ✅ PASS | UI changes are contained entirely within the Strategy Engine frontend module (`app/strategy/page.tsx` and its components). |
| P2: Security & Data Isolation | ✅ PASS | No data layer changes. |
| P3: UI/UX Consistency (Binance Design) | ✅ PASS | Layout uses Tailwind CSS grid, conforming to 8/4 or similar split as described in DESIGN.md. |

## Architecture Decision
**Approach**: Frontend component enhancement (Monolith UI extension).
**Rationale**: The changes are purely presentation logic (layout grids and local React state for pagination). We will implement custom pagination hooks or state directly in the components to avoid heavy dependencies.
**Modules affected**: Strategy Engine Frontend
**E2E flows affected**: Strategy Backtest
**New modules needed**: None

## Source Code Structure
- `workspace/apps/frontend/src/app/strategy/page.tsx`
  - Modify layout of Backtest Results section (use `grid md:grid-cols-12` or flex layout).
  - Add `currentPage` and `itemsPerPage` state for Trades.
  - Add `currentStrategyPage` and `itemsPerPage` state for Strategy Catalog.
  - Implement pagination controls (Next/Prev buttons styled per `DESIGN.md` with secondary button styles).
