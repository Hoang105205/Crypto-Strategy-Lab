# Module: News & Sentiment

> **Owner**: Member C
> **Status**: Draft
> **Last Updated**: 2026-08-05

## 1. Overview
- **Responsibility**: Collect crypto news, analyze sentiment in an isolated Python service, and expose sentiment as a pluggable trading strategy
- **Layer**: Backend (NestJS + Python FastAPI)
- **Depends on**: Shared types + `IEventBus`
- **Depended by**: Strategy Engine (SentimentStrategy registration), Frontend (news feed)
- **Contracts**: `kb/contracts/news.yaml`
- **Source files**: `apps/backend/news/`, `apps/sentiment-service/`
- **Related ADRs**: ADR-0009 (Sentiment as Separate Process), ADR-0010 (News Provider Adapter)

## 2. Component Architecture

### Components
| Component | Responsibility | Pattern | File(s) |
|-----------|---------------|---------|---------|
| RSSAdapter / CryptoPanicAdapter | News collection | Adapter | [TODO] |
| NewsCollector | Cron collection → normalize → dedupe → store | [TODO] | [TODO] |
| SentimentClient | NestJS → Python FastAPI (VADER) | Client | [TODO] |
| SentimentService (Python) | VADER sentiment scoring | Process Isolation | [TODO] |
| SentimentStrategy | Plugs into StrategyRegistry; HOLD when service down | Strategy + Graceful Degradation | [TODO] |

### Component Diagram
[TODO: fill during planning phase]

## 3. Design Patterns

### Provider Adapter Pattern — INewsProvider
- **Where**: RSSAdapter, CryptoPanicAdapter
- **Why**: New news source = 1 adapter class, zero changes elsewhere
- **How**: [TODO]
- **Trade-offs**: [TODO]

### Process Isolation
- **Where**: Python FastAPI sentiment service
- **Why**: Python crashes must not crash NestJS; ML ecosystem needs Python
- **How**: [TODO]
- **Trade-offs**: [TODO]

## 4. Internal Data Flow
[TODO: fill during planning phase]

## 5. Sequence Diagrams

### Collect News and Score Sentiment
[TODO: fill during planning phase]

## 6. Data Model
| Entity | Fields | Relationships |
|--------|--------|---------------|
| NewsArticle | [TODO] | [TODO] |
| SentimentScore | [TODO] | [TODO] |

## 7. API Surface
See `kb/contracts/news.yaml`. [TODO: summarize endpoints here]

## 8. Quality Attributes
- **Security**: [TODO]
- **Performance**: [TODO]
- **Error handling**: Service down → `SentimentStrategy` returns HOLD (graceful degradation) [TODO]

## 9. Testing Strategy
- **Unit tests**: [TODO]
- **Integration tests**: [TODO]

## 10. Open Questions / TODOs
- [ ] [unresolved items]
