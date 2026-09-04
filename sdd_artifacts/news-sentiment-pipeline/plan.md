# Implementation Plan: Crypto News & Sentiment Analysis Pipeline

**Feature**: `news-sentiment-pipeline` | **Date**: 2026-08-12 | **Spec**: spec.md | **Owner**: Thuận

## Summary

Implement the complete **News & Sentiment Module** across backend, ML service, and frontend layers. The module collects crypto news articles from external sources via decoupled `INewsProvider` adapters (`RSSProvider`, `WebCrawlerProvider`), normalizes payloads into a standard `NewsArticle` schema (`id`, `title`, `content`, `source`, `publishedAt`, `crawledAt`, `relatedCoins`, `url`), deduplicates articles by URL hash in PostgreSQL, sends text for sentiment scoring to an isolated Python FastAPI ML service running VADER, exposes REST endpoints for the Next.js frontend, and registers `NewsSentimentStrategy` into `StrategyRegistry` for composite trading strategy creation (`MA + RSI + News Sentiment`).

### UI Layout & Pagination Enhancement (2026-08-12)
- **Container Sizing**: Expand `NewsFeed` container to `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` for balanced, full-width presentation without overflowing margins.
- **Header Bar**: Full width (`w-full`), expanded vertical height & padding (`p-8 sm:p-10`), backdrop blur, preventing title and aggregate mood gauge text clipping.
- **Card Layout**: Balanced responsive 3-column grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`), 2-line title & 2-line content snippet truncation (`line-clamp-2 min-h-[3rem]`).
- **Pagination**: Initial load of 20 articles, bottom **"More stories"** button fetching/displaying additional articles in 10-item increments.

## Technical Context

- **Language/Version**: TypeScript 5.x (NestJS 11.x + Next.js 16.x), Python 3.13.x (FastAPI 0.115+ + VADER Sentiment)
- **Primary Dependencies**: NestJS (`@nestjs/common`, `@nestjs/schedule`, `@nestjs/axios`, `@prisma/client`), Python (`fastapi`, `uvicorn`, `vaderSentiment`, `pydantic`), Next.js App Router
- **Storage**: PostgreSQL 16 + Prisma ORM 6.x (`NewsArticle`, `SentimentScore` entities)
- **Testing**: Jest / Vitest unit tests for providers & strategy; integration tests for API & fallback logic
- **Target Platform**: Windows / Linux Node.js 20+ runtime + Python 3.13 process
- **Project Type**: Web Application Monorepo (NestJS Modular Monolith + Python Micro-process + Next.js FE)
- **Performance Goals**: Inter-process HTTP REST latency < 15ms; 500ms timeout for sentiment scoring; zero event loop blocking on NestJS
- **Constraints**: Constitution §I (Architecture Quality), §II (Contract-driven), ADR-0009 (Process Isolation), ADR-0010 (Provider Adapter Pattern)

## Constitution Check
*GATE: Must pass before execution.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **Art I: Architecture Quality Over Profitability** | ✅ PASS | Adheres strictly to Modular Monolith architecture in `ARCHITECTURE.md` and `kb/modules/news-sentiment.md`. |
| **Art II: Contract-Driven** | ✅ PASS | API surface & schemas strictly match `kb/contracts/news.yaml`. |
| **Art III: Demonstrable Extension Points** | ✅ PASS | Extensibility Scenario #5 (News failure -> Charts work, Strategy returns HOLD) and Scenario #10 (New INewsProvider adapter) are 100% demonstrable. |
| **Art IV: Simplicity Over Cleverness** | ✅ PASS | Simple RSS adapter + VADER ML + standard Prisma ORM; no over-engineered queues for v1. |
| **Art V: Knowledge Base as Truth** | ✅ PASS | Grounded in KB single source of truth (`news-sentiment.md`, `news.yaml`, ADR-0009, ADR-0010). |
| **Art VI: Explicit Over Implicit** | ✅ PASS | Named interfaces (`INewsProvider`, `RawArticle`), explicit HTTP client error catching. |

## Source Code Structure

```
workspace/
├── apps/
│   ├── backend/src/news/
│   │   ├── cron/
│   │   │   └── news-collector.cron.ts       # Scheduled news ingestion trigger
│   │   ├── providers/
│   │   │   ├── news.provider.interface.ts   # INewsProvider & RawArticle interfaces
│   │   │   ├── rss.provider.ts              # RSS Feed Adapter (Live RSS feeds + coin extraction)
│   │   │   └── crawler.provider.ts          # Web Crawler Adapter
│   │   ├── services/
│   │   │   ├── news.service.ts              # Normalization, deduplication, DB persistence & auto re-analysis
│   │   │   └── sentiment.client.ts          # NestJS HTTP client to Python FastAPI
│   │   ├── strategies/
│   │   │   └── sentiment.strategy.ts        # NewsSentimentStrategy (registered in StrategyRegistry)
│   │   ├── news.controller.ts               # GET /api/news & GET /api/sentiment/aggregate
│   │   └── news.module.ts                   # NestJS Module definition
│   │
│   ├── sentiment/                           # Python FastAPI Service (:8000)
│   │   ├── app.py                           # FastAPI application entry point
│   │   ├── analyzer.py                      # VADER Sentiment intensity logic
│   │   ├── models.py                        # Pydantic schemas (AnalyzeRequest/Response)
│   │   └── requirements.txt                 # Python packages (fastapi, uvicorn, vaderSentiment, pydantic)
│   │
│   └── frontend/src/app/news/
│       ├── page.tsx                         # Next.js News Feed Page
│       └── components/
│           └── NewsFeed.tsx                 # Article list (max-w-7xl layout, 2-line cards, More stories button)
```
