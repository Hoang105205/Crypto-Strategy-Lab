# Research: Crypto News & Sentiment Analysis Pipeline

## Decisions

### D1: Sentiment Intensity Analyzer Choice
- **Chosen**: `vaderSentiment` (Valence Aware Dictionary and sEntiment Reasoner) in Python FastAPI.
- **Rationale**: VADER is specifically attuned to sentiment expressed in news headlines, financial media, and microblogging text. It computes compound sentiment intensity scores directly in range `-1.0` to `1.0` without requiring complex neural network training or high GPU overhead.
- **Alternatives considered**:
  - *JS-based sentiment library (`sentiment` npm)*: Rejected because JS ports lack financial domain tuning and running heavy text processing in Node.js event loop violates process isolation (ADR-0009).
  - *Transformers / BERT*: Overkill for course project scope; adds multi-gigabyte model download requirements and GPU dependencies.
- **KB reference**: `kb/ADR/0009-sentiment-service-as-separate-process.md`

### D2: Decoupled News Provider Architecture
- **Chosen**: Provider Adapter Pattern (`INewsProvider` interface returning `RawArticle[]`).
- **Rationale**: Isolates downstream news storage, sentiment classification, and strategy execution from specific external HTML/XML web scraper mechanics. Adding a new feed requires only 1 new class implementing `INewsProvider`.
- **Alternatives considered**:
  - *Monolithic scraper inside `NewsService`*: Rejected because it breaks Open-Closed Principle (OCP) and couples core business logic to external website structures.
- **KB reference**: `kb/ADR/0010-news-provider-adapter-pattern.md`

### D3: Graceful Degradation Strategy
- **Chosen**: 500ms HTTP timeout in NestJS `SentimentClient`. On timeout/failure, return neutral score `{ score: 0.0, label: "NEUTRAL" }` and issue `HOLD` signal in `NewsSentimentStrategy`.
- **Rationale**: Satisfies Extensibility & Reliability Scenario #5 (*News Service down -> Charts still work, SentimentStrategy returns HOLD*).
- **Alternatives considered**:
  - *Throwing HTTP Exception*: Rejected because it would crash NestJS endpoints or disrupt backtest evaluation workers.
- **KB reference**: `kb/modules/news-sentiment.md` (§8 Quality Attributes)
