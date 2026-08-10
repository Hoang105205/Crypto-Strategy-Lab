# Spec: News & Sentiment Pipeline

> **Feature**: `news-sentiment-pipeline`  
> **Owner**: Thuận (Fullstack Engineer — News & Sentiment Module Owner)  
> **Status**: Specified  
> **Created**: 2026-08-10  
> **SDD phase**: Specify (1/6)  
> **Source of truth**: `plans/Crypto_Strategy_Lab_Requirement.md` (Sections 27–30), `plans/plan-overview.md`, `kb/contracts/news.yaml`, `kb/modules/news-sentiment.md`, `kb/flows/news-sentiment-pipeline.md`, ADR-0009, ADR-0010  

---

## 1. Purpose

Implement the **News & Sentiment backend and sentiment ML module** — the sentiment intelligence layer of the Crypto Strategy Lab. It periodically ingests crypto news articles from external providers via decoupled adapters (`INewsProvider`), normalizes them into standard `NewsArticle` entities, analyzes sentiment scores (-1.0 to 1.0) and classifications (`POSITIVE`, `NEGATIVE`, `NEUTRAL`) via an isolated Python FastAPI service (VADER ML), exposes REST endpoints for the Next.js frontend, and registers `NewsSentimentStrategy` into `StrategyRegistry` for composite trading strategy creation (`MA + RSI + News Sentiment`).

This feature delivers the complete **News & Sentiment Module** requirements specified in `plans/Crypto_Strategy_Lab_Requirement.md` and `plans/plan-overview.md`.

---

## 2. Actors

| Actor | Role |
|-------|------|
| NewsCollectorCron | Scheduled NestJS cron job triggering periodic news collection |
| External News Sources | Public RSS feeds (e.g. CoinDesk), News APIs, and Web Crawlers |
| SentimentClient | NestJS HTTP client communicating with Python FastAPI via REST |
| Python FastAPI Service | Isolated Python process executing VADER sentiment intensity analysis |
| Frontend (Next.js) | Consumes REST endpoints `GET /api/news` & `GET /api/sentiment/aggregate` |
| Strategy Engine (Huy) | Consumes `NewsSentimentStrategy` registered in `StrategyRegistry` |

---

## 3. Scope

### In scope
- `INewsProvider` interface and concrete provider adapters (`RSSProvider`, `WebCrawlerProvider`)
- `NewsService` (ingestion, deduplication by URL hash, `crawledAt` timestamping, Prisma DB persistence)
- `NewsCollectorCron` (scheduled ingestion trigger)
- `SentimentClient` (internal HTTP gateway to Python FastAPI on port 8000 with 500ms timeout & graceful degradation)
- `FastAPI Sentiment App` (`apps/sentiment/` with `app.py`, `analyzer.py`, `models.py`, `requirements.txt`)
- `NewsController` (REST endpoints `GET /api/news` & `GET /api/sentiment/aggregate` per contract)
- `NewsSentimentStrategy` implementing `IStrategy` (emits `BUY` > +0.X, `SELL` < -0.X, `HOLD` fallback)
- Next.js UI Skeleton components (`apps/frontend/src/app/news/page.tsx`, `NewsFeed.tsx`)

### Out of scope
- CryptoPanic API live secret key integration (deferred to Week 2 extension)
- Redis caching layer for aggregate sentiment gauge (future optimization if DB load grows)
- Other members' modules (Market Data, Strategy Engine, Event Infrastructure)

---

## 4. Functional Requirements

### FR-1: Decoupled News Ingestion (`INewsProvider` Adapter Pattern)
- Define `INewsProvider` interface with `fetchLatest(limit?: number, coin?: string): Promise<RawArticle[]>` (ADR-0010 & Requirement §28).
- Implement `RSSProvider` to parse public RSS feeds (e.g. CoinDesk RSS).
- Implement `WebCrawlerProvider` for custom news portal scraping.
- Each provider converts raw payloads into standard `RawArticle` format containing `crawledAt` and `relatedCoins`.

### FR-2: Normalization, Deduplication & Storage (`NewsService`)
- Normalize `RawArticle` into standard `NewsArticle` schema (`id`, `title`, `content`, `source`, `publishedAt`, `crawledAt`, `relatedCoins`, `sentimentScore`, `sentimentLabel`, `url`) (Requirement §27).
- Deduplicate articles by unique `url` hash before saving to PostgreSQL via Prisma. Skip existing articles without re-analyzing within 24h.

### FR-3: Cron Scheduled Collection (`NewsCollectorCron`)
- Run scheduled job periodically to trigger `NewsService.collectAllNews()`.
- Log summary of fetched, deduplicated, and processed articles.

### FR-4: Process-Isolated ML Sentiment Analysis (`SentimentClient` & Python FastAPI)
- Run isolated Python FastAPI service (`apps/sentiment/`) listening on `http://localhost:8000/analyze` (ADR-0009 & Requirement §29).
- `analyzer.py` utilizes VADER `SentimentIntensityAnalyzer` to output compound `score` (-1.0 to 1.0) and classification (`POSITIVE`, `NEGATIVE`, `NEUTRAL`).
- `SentimentClient` in NestJS sends article text via HTTP POST `/analyze` with 500ms timeout.

### FR-5: Graceful Degradation Fault Tolerance
- If Python FastAPI service is offline or times out, `SentimentClient` catches error, logs warning, and returns fallback object `{ score: 0.0, label: "NEUTRAL" }`.
- NestJS server and trading engine continue operating smoothly without crashing.

### FR-6: REST API Surface (`NewsController`)
- `GET /api/news?limit=10&coin=BTC`: Returns latest news articles filtered by coin with sentiment classification.
- `GET /api/sentiment/aggregate?timeframe=1h&coin=BTC`: Returns average sentiment score and total article count for timeframe.

### FR-7: Strategy Plugin Integration (`NewsSentimentStrategy`)
- Implement `NewsSentimentStrategy` adhering to `IStrategy` interface (Requirement §30).
- Register `NewsSentimentStrategy` into `StrategyRegistry`.
- Output `BUY` when aggregate sentiment > +0.X, `SELL` when < -0.X, `HOLD` otherwise (or when degraded).
- Enable strategy builder to compose `MA + RSI + News Sentiment` composite strategies.

---

## 5. Non-Functional Requirements

| Attribute | Requirement |
|-----------|-------------|
| **Modifiability** | Provider Adapter Pattern — new news provider = 1 new adapter class, zero changes to existing code (ADR-0010) |
| **Process Isolation** | Python FastAPI ML service runs in separate process; high CPU NLP does not block NestJS event loop or WS charts (ADR-0009) |
| **Reliability** | Graceful Degradation — fallback score `0.0` neutral & `HOLD` signal when sentiment service is offline |
| **Performance** | Internal HTTP REST timeout capped at 500ms; deduplication prevents redundant ML scoring |
| **Security** | Internal Python API (`:8000`) never exposed directly to frontend; all requests routed through NestJS |

---

## 6. Constraints (Constitution & ADRs)

- **Constitution §I**: Must conform to architecture in `ARCHITECTURE.md` & `modules/news-sentiment.md`.
- **Constitution §II**: Contract-driven — endpoints and schemas must strictly match `kb/contracts/news.yaml`.
- **ADR-0009**: Process isolation for Python FastAPI sentiment service.
- **ADR-0010**: Provider adapter pattern for all news providers.

---

## 7. Data Entities

- **NewsArticle**: `id`, `source`, `title`, `content`, `url` (unique), `publishedAt`, `crawledAt`, `relatedCoins` (String[]), `sentimentScore`, `sentimentLabel`, `createdAt`.
- **SentimentScore**: `id`, `articleId` (FK), `score` (-1.0 to 1.0), `label` (`POSITIVE`, `NEGATIVE`, `NEUTRAL`), `model` ('VADER'), `scoredAt`.

---

## 8. Success Criteria

- **SC-001**: 100% provider decoupling via `INewsProvider` interface.
- **SC-002**: Process isolation & graceful degradation verified — stopping Python process does not crash NestJS or WebSocket streams.
- **SC-003**: 100% compliance with REST contract `kb/contracts/news.yaml`.
- **SC-004**: `NewsSentimentStrategy` registered in `StrategyRegistry` and operable in composite strategies (`MA + RSI + News Sentiment`).

---

## 9. Assumptions

- Python FastAPI runs on `http://localhost:8000` during development.
- Initial RSS provider uses public feeds (CoinDesk RSS).
- PostgreSQL & Prisma migration already initialized.

---

## 10. KB Cross-References

- **Official Requirements**: `plans/Crypto_Strategy_Lab_Requirement.md` (Sections 27–30), `plans/plan-overview.md`
- **Modules affected**: `kb/modules/news-sentiment.md` (`apps/backend/src/news/`, `apps/sentiment/`, `apps/frontend/src/app/news/`)
- **E2E flows affected**: `kb/flows/news-sentiment-pipeline.md`
- **Architecture constraints**: `kb/ARCHITECTURE.md`, `kb/CONSTITUTION.md`
- **Relevant ADRs**: `kb/ADR/0009-sentiment-service-as-separate-process.md`, `kb/ADR/0010-news-provider-adapter-pattern.md`
- **API Contracts**: `kb/contracts/news.yaml`
- **Glossary terms**: `INewsProvider`, `NewsArticle`, `NewsSentimentStrategy`, `Process Isolation`, `Graceful Degradation`
