# Implementation Plan: Crypto News & Sentiment Analysis Pipeline

**Feature**: `news-sentiment-pipeline` | **Date**: 2026-08-10 | **Spec**: spec.md | **Owner**: Thuận

## Summary

Implement the complete **News & Sentiment Module** across backend, ML service, and frontend layers. The module collects crypto news articles from external sources via decoupled `INewsProvider` adapters (`RSSProvider`, `WebCrawlerProvider`), normalizes payloads into a standard `NewsArticle` schema (`id`, `title`, `content`, `source`, `publishedAt`, `crawledAt`, `relatedCoins`, `url`), deduplicates articles by URL hash in PostgreSQL, sends text for sentiment scoring to an isolated Python FastAPI ML service running VADER, exposes REST endpoints for the Next.js frontend, and registers `NewsSentimentStrategy` into `StrategyRegistry` for composite trading strategy creation (`MA + RSI + News Sentiment`).

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

## Architecture Decision

- **Approach**: Modular Monolith addition in NestJS (`workspace/apps/backend/src/news/`) coupled with an isolated Python FastAPI micro-process (`workspace/apps/sentiment/`) and Next.js frontend pages (`workspace/apps/frontend/src/app/news/`).
- **Rationale**: 
  - Python FastAPI handles ML VADER scoring to leverage Python's native NLP ecosystem without stalling Node.js single-threaded event loop (ADR-0009).
  - `INewsProvider` adapter interface decouples news collection from specific crawlers, fulfilling Open-Closed Principle (ADR-0010).
  - NestJS `SentimentClient` implements Graceful Degradation: if Python is down, it returns neutral score (`0.0`) and `NewsSentimentStrategy` returns `HOLD`, keeping trading loop & charts safe.
- **Modules affected**: `kb/modules/news-sentiment.md` (`apps/backend/src/news/`, `apps/sentiment/`, `apps/frontend/src/app/news/`), `Strategy Engine` (`NewsSentimentStrategy` registration)
- **E2E flows affected**: `kb/flows/news-sentiment-pipeline.md`
- **New modules needed**: None (module skeleton already defined in monorepo layout).

## Source Code Structure

```
workspace/
├── apps/
│   ├── backend/src/news/
│   │   ├── cron/
│   │   │   └── news-collector.cron.ts       # Scheduled news ingestion trigger
│   │   ├── providers/
│   │   │   ├── news.provider.interface.ts   # INewsProvider & RawArticle interfaces
│   │   │   ├── rss.provider.ts              # RSS Feed Adapter
│   │   │   └── crawler.provider.ts          # Web Crawler Adapter
│   │   ├── services/
│   │   │   ├── news.service.ts              # Normalization, deduplication, DB persistence
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
│           └── NewsFeed.tsx                 # Article list with sentiment badges
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *None* | Architecture complies 100% with Constitution and ADRs. | N/A |
