# Business Flow: News & Sentiment Pipeline

> **Owner**: Member C
> **Status**: Draft
> **Last Updated**: 2026-08-05

## 1. Overview
- **Description**: News articles are collected on a schedule, normalized, deduplicated, scored for sentiment by the Python service, and stored for display and strategy use
- **Primary Actor**: Cron scheduler
- **Business Value**: Sentiment becomes both a dashboard feed and a signal source for strategies
- **Modules Involved**: News & Sentiment (NestJS + Python FastAPI)

## 2. Preconditions
- [TODO: fill during planning phase]

## 3. Flow Steps
1. Cron triggers NewsCollector — News & Sentiment (internal)
2. Adapters fetch from RSS / CryptoPanic — News & Sentiment → external providers via `INewsProvider`
3. Articles normalized + deduplicated + stored — News & Sentiment → PostgreSQL
4. SentimentClient sends text to Python FastAPI (VADER) — News & Sentiment → sentiment service via HTTP
5. Scores stored and exposed via REST for frontend + SentimentStrategy — News & Sentiment

## 4. Postconditions
- [TODO: fill during planning phase]

## 5. Alternative Paths
### [TODO Path Name]
- [TODO]

## 6. Error & Exception Flows
### Python service down
- SentimentClient times out; latest stored score kept; `SentimentStrategy` returns HOLD [TODO: detail]

## 7. Business Rules
- **BR-1**: Frontend never calls the Python service directly — always through the NestJS API

## 8. Related
- **Contracts**: `kb/contracts/news.yaml`
- **ADRs**: ADR-0009, ADR-0010
- **Module files**: `kb/modules/news-sentiment.md`
