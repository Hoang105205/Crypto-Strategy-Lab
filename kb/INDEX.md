# Knowledge Base Index

> **Last Updated**: 2026-08-09
> **Status**: Active — All 12 ADRs complete, all W1 KB files filled

## Purpose
This KB is the single source of truth for the Crypto Strategy Lab project's
business scope, architecture, design decisions, and conventions. All SDD skills
read from here before generating any artifacts or code.

## Quick Reference

| File | Purpose | Read When |
|------|---------|-----------|
| CONSTITUTION.md | Non-negotiable principles | Every skill execution |
| ARCHITECTURE.md | System architecture overview | Planning, implementing |
| DESIGN.md | FE/UX design and component library | FE implementation |
| MODULES.md | Module boundaries (index) | Planning, task decomposition |
| modules/ | Per-module detailed architecture | Planning, implementing, analyzing |
| flows/ | E2E business use case scenarios (cross-module) | Specifying, planning, implementing, analyzing |
| GLOSSARY.md | Domain terms | All skill executions |
| CONTRIBUTING.md | Coding standards | Implementation |
| ADR/ | Architecture Decision Records (WHY + HOW) | Planning, when referencing decisions |
| contracts/ | API/data contracts (SSoT) | Implementation, API work |
| patterns/ | Design pattern catalog | Planning, architecture decisions |

## Reading Order for Skills
1. INDEX.md (this file)
2. CONSTITUTION.md (always)
3. Then based on task:
   - Specifying → ARCHITECTURE.md, MODULES.md, modules/[relevant], flows/, GLOSSARY.md
   - Planning → ARCHITECTURE.md, MODULES.md, modules/[relevant], flows/, DESIGN.md, ADR/
   - Implementing → all of the above + CONTRIBUTING.md, contracts/, patterns/
   - Analyzing → all relevant files including modules/ and flows/ for cross-referencing

## Scope Coverage
- **Domain**: Crypto trading strategy analysis, composition, and evaluation
- **Core Entities**: MarketData (candles), Strategy, CompositeStrategy, Backtest, BacktestResult, LeaderboardEntry, NewsArticle, SentimentScore, SearchLoopRun
- **Modules**: Market Data (Hoàng), Strategy Engine (Huy), News & Sentiment (Thuận), Event Infrastructure (Phương — Event Bus + Job Queue + Leaderboard + Loop + Dashboard)
- **Business Flows**: Realtime Market Data, Strategy Backtest, Strategy Search Loop, News & Sentiment Pipeline, Composite Strategy with Sentiment, Leaderboard Update
