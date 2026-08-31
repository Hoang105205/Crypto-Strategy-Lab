# Implementation Plan: Gemini LLM Web Crawler Selector Discovery & Self-Healing

**Feature**: `gemini-crawler-selector-discovery` | **Date**: 2026-08-31 | **Spec**: `spec.md`

## Summary
Implement `GeminiDiscoveryClient` in `apps/backend/src/news/services/gemini-discovery.client.ts` to call Google Gemini API (Gemini 2.5 Flash) for automated semantic CSS selector extraction (`containerSelector`, `titleSelector`, `contentSelector`, `linkSelector`, `dateSelector`) from HTML samples. Integrate this client into `CrawlerDiscoveryService` to enable intelligent portal registration and Self-Healing with zero-latency Cheerio heuristic fallback when `GEMINI_API_KEY` is missing or unavailable.

## Technical Context
**Language/Version**: TypeScript 5.7+ / Node.js 20+  
**Primary Dependencies**: `@nestjs/common`, `@nestjs/config`, `cheerio`, `axios` (HTTP calls to Gemini API `https://generativelanguage.googleapis.com/v1beta/models/...`), `@crypto-strategy-lab/shared`  
**Storage**: PostgreSQL via Prisma (`CrawlerRule` table)  
**Testing**: Jest unit test suite (`apps/backend/src/news/services/gemini-discovery.client.spec.ts` & `crawler-discovery.service.spec.ts`)  
**Target Platform**: NestJS Modular Monolith backend  
**Project Type**: Backend AI / Discovery Service Integration  
**Performance Goals**: Fast HTML extraction (<50ms execution via cached rules in Cheerio), LLM discovery SLA timeout ≤10,000ms.  
**Constraints**: Zero server crash on missing `GEMINI_API_KEY` (graceful fallback to Cheerio heuristics).

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|---|:---:|---|
| **Art I: Architecture Quality** | ✅ PASS | Decoupled client pattern: `GeminiDiscoveryClient` is an injectable service within the News module. |
| **Art II: Contract-Driven** | ✅ PASS | Adheres to `kb/contracts/news.yaml` and `DiscoveredRule` interface. |
| **Art III: Demonstrable Extension Points** | ✅ PASS | Demonstrates LLM-assisted self-healing and zero-code web scraping extensibility (ADR-0014). |
| **Art IV: Simplicity Over Cleverness** | ✅ PASS | Direct REST HTTP API call via standard `axios` with 10s `AbortController` timeout; zero heavy SDK bloat. |
| **Art V: Knowledge Base as Truth** | ✅ PASS | Aligned with `kb/modules/news-sentiment.md` and `kb/ADR/0014-llm-assisted-crawler-selector-caching.md`. |
| **Art VI: Explicit Over Implicit** | ✅ PASS | Explicit structured JSON schema requested from Gemini and explicit fallback logging. |

## Architecture Decision
- **Approach**: Dedicated `GeminiDiscoveryClient` injected into `CrawlerDiscoveryService`.
- **Rationale**: Keeps external AI network communication isolated from local Cheerio DOM heuristic logic and database persistence.
- **Modules affected**: `News & Sentiment` (`apps/backend/src/news/`)
- **E2E flows affected**: `kb/flows/news-sentiment-pipeline.md` (Step 4 & Exception flows)

## Source Code Structure
```text
workspace/
├── libs/shared/src/
│   ├── types/news.ts (DiscoveredRule, GeminiDiscoveryConfig)
│   └── constants/news.constants.ts (DEFAULT_GEMINI_MODEL, GEMINI_DISCOVERY_TIMEOUT_MS)
└── apps/backend/src/news/
    ├── services/
    │   ├── gemini-discovery.client.ts [NEW]
    │   ├── gemini-discovery.client.spec.ts [NEW]
    │   ├── crawler-discovery.service.ts [MODIFY]
    │   └── crawler-discovery.service.spec.ts [MODIFY]
    └── news.module.ts [MODIFY - register GeminiDiscoveryClient provider]
```

## Complexity Tracking
*No constitutional violations. All principles pass.*
