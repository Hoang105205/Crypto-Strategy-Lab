# Implementation Plan: Strategy Builder Frontend & UI Components

**Feature**: `strategy-frontend-builder` | **Date**: 2026-08-12 | **Spec**: spec.md

## Summary
Implement the fullstack UI components and main application page for the Strategy Builder in Next.js (`apps/frontend/`). This includes `StrategyCard`, `ParameterEditor`, `CompositeBuilder`, `TradeTable`, and the `/strategy` page bringing them together into a modern, dark-themed trading dashboard.

## Technical Context
**Language/Version**: TypeScript, React, Next.js (App Router), Vanilla CSS / CSS Modules / Tailwind.
**Dependencies**: Lucide icons / React icons, native `fetch` client to hit backend API (`http://localhost:3000/api/strategies`).
**Design Tokens (`kb/DESIGN.md`)**:
- Background: `#0b0e11`
- Card surface: `#1e2329`
- Border / Elevated: `#2b3139`
- Primary Accent: `#fcd535`
- Win / Bullish: `#0ecb81`
- Loss / Bearish: `#f6465d`

## Source Code Structure
```
apps/frontend/src/
├── app/
│   └── strategy/
│       ├── page.tsx               # Strategy Builder Main Page
│       └── strategy-builder.css   # Tailored dark theme styling
└── components/
    └── strategy/
        ├── StrategyCard.tsx       # Strategy card view
        ├── ParameterEditor.tsx    # Parameter edit form
        ├── CompositeBuilder.tsx   # Composite strategy builder component
        ├── TradeTable.tsx         # Trade results table
        └── index.ts               # Barrel export for strategy components
```
