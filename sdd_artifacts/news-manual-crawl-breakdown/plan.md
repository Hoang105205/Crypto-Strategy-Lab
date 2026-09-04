# Implementation Plan: News On-Demand Crawl with Anti-Spam Cooldown & Sentiment Distribution Breakdown

**Feature**: `news-manual-crawl-breakdown` | **Date**: 2026-08-25 | **Spec**: spec.md

## Summary
Enhance the News & Sentiment module to allow on-demand news ingestion with a 2-minute (120s) anti-spam cooldown and execution mutex lock, provide full 24h sentiment polarization ratios (`positiveRatio`, `neutralRatio`, `negativeRatio`), render visual breakdown indicators and an OP.GG-style countdown trigger on the frontend, and adjust the default background cron schedule to 5 minutes (`*/5 * * * *`).

## Technical Context
- **Language/Version**: TypeScript 5.x / Node.js 20+
- **Primary Dependencies**: NestJS 11.x (`@nestjs/common`, `@nestjs/schedule`), Next.js 15.x (React 19), Prisma 6.x
- **Storage**: PostgreSQL 16 (Existing `NewsArticle`, `SentimentScore`, `CrawlerRule` tables; no schema migration required)
- **Testing**: Jest (Backend unit/integration tests) + Vitest (Frontend component tests)
- **Target Platform**: Node.js Backend (`localhost:3001`), Next.js Frontend (`localhost:3000`), Python FastAPI (`localhost:8000`)
- **Project Type**: Web Application & REST API (Modular Monolith)
- **Performance Goals**: On-demand crawl completion < 2.5s; aggregate sentiment calculation < 10ms with cached in-memory articles; zero-lag 1s ticker for countdown timer.
- **Constraints**: Follow KB Constitution (Contract-driven, simplicity over cleverness, demonstrable extension points).

## Constitution Check
*GATE: All principles validated and passed.*

| Principle | Status | Notes |
|---|:---:|---|
| **I. Architecture Quality Over Trading Profitability** | ✅ PASS | Adheres to Modular Monolith and decoupled provider architecture. |
| **II. Contract-Driven** | ✅ PASS | All endpoints, DTOs, and error codes are formalized in `kb/contracts/news.yaml`. |
| **III. Demonstrable Extension Points** | ✅ PASS | Provides instant on-demand demo capability with visual cooldown feedback. |
| **IV. Simplicity Over Cleverness** | ✅ PASS | Uses in-memory timestamp cooldown and boolean mutex; avoids unnecessary distributed locking. |
| **V. Knowledge Base as Truth** | ✅ PASS | Pre-aligned with `kb/contracts/news.yaml` and `kb/modules/news-sentiment.md`. |
| **VI. Explicit Over Implicit** | ✅ PASS | Explicit HTTP error codes (429 Too Many Requests, 409 Conflict) with typed response payloads. |

## Architecture Decision
- **Approach**: Monolith addition to existing News & Sentiment Module (`apps/backend/src/news/`) and Frontend (`apps/frontend/src/components/news/NewsFeed.tsx`), with shared types updated in `libs/shared/`.
- **Rationale**: Keeps the module cohesive and self-contained without introducing new infrastructure dependencies.
- **Modules affected**: `news-sentiment`, `shared`, `frontend/news`
- **E2E flows affected**: `kb/flows/news-sentiment-pipeline.md`
- **New modules needed**: None.

## Source Code Structure

```text
workspace/
├── libs/shared/src/
│   ├── constants/news.ts       # Update NEWS_COLLECTION_CRON_SCHEDULE to '*/5 * * * *', add MANUAL_CRAWL_COOLDOWN_MS = 120_000
│   └── types/news.ts            # Extend AggregateSentiment interface with distribution counts & ratios
├── apps/backend/src/news/
│   ├── news.controller.ts      # Add POST /api/news/crawl with 120s cooldown check, 429/409 error handling
│   ├── services/news.service.ts # Update getAggregateSentiment() to calculate positive/neutral/negative counts and ratios
│   └── cron/news-collector.cron.ts # Update cron schedule logging
└── apps/frontend/src/components/news/
    └── NewsFeed.tsx             # Add [⚡ Cào tin mới] button with OP.GG-style countdown timer and 3-color breakdown bar
```

## Complexity Tracking
*No constitutional violations. Zero additional infrastructure complexity.*
