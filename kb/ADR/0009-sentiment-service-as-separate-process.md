# ADR-0009: Sentiment Service as Separate Process

## Status
Accepted

## Context
The News & Sentiment module (owned by Thuận) requires Natural Language Processing (NLP) / Machine Learning (ML) capabilities (specifically VADER sentiment intensity analysis) to score crypto news articles and produce numerical sentiment values (-1.0 to 1.0) and sentiment labels (`POSITIVE`, `NEGATIVE`, `NEUTRAL`).

The main application backend is built on NestJS (TypeScript/Node.js). Node.js operates on a single-threaded event loop model and lacks mature native NLP/ML libraries comparable to Python's ecosystem (`vaderSentiment`, `transformers`, `nltk`, `pydantic`).

Running heavy text analysis or ML inference directly inside the NestJS main process could block the event loop, degrade WebSocket real-time candlestick chart streaming, and cause server crashes if Python/ML bindings encounter native memory faults. The architecture constitution requires system components to remain operational even during sub-service failures (extensibility & reliability scenario #5: *News Service down -> Charts still work, SentimentStrategy returns HOLD*).

## Decision Drivers
- **ML Ecosystem Maturity**: Python possesses the industry-standard ML/NLP ecosystem (`vaderSentiment`, `FastAPI`, `pydantic`).
- **Process Isolation**: Heavy NLP computation must be isolated to prevent freezing the NestJS main event loop or WebSocket chart gateway.
- **Fault Tolerance & Reliability**: A failure or crash in the sentiment service must not bring down the main NestJS monolith or trading charts.
- **Graceful Degradation**: System must handle service unavailability by defaulting to neutral sentiment (`0.0`) and `HOLD` trading signals.

## Considered Options
1. **Monolithic Node.js integration** — Use JavaScript NLP libraries (e.g., `sentiment`, `natural`). Fails because JS libraries lack specialized financial/VADER sentiment scoring accuracy and stall the event loop under heavy load.
2. **In-process Python execution via Node.js spawn/exec** — Spawn Python child processes per request using `child_process.spawn()`. Fails due to high OS process creation overhead and latency per request.
3. **Isolated Python FastAPI micro-process via REST HTTP** — Run an independent Python FastAPI process (`apps/sentiment/`) listening on `http://localhost:8000`. NestJS `SentimentClient` communicates via HTTP REST `POST /analyze`. Frontend never touches Python directly.

## Decision Outcome
Chosen option: **Isolated Python FastAPI micro-process via REST HTTP**, using **VADER ML** as the core NLP sentiment engine.

### Architectural Rationale: Local VADER ML vs External LLM APIs (OpenAI/Gemini)

| Criterion | Local VADER ML (`apps/sentiment`) | External LLM API (OpenAI/Gemini) |
|---|---|---|
| **Latency / SLA** | ⚡ **< 1ms per article** (Fast) | 🐢 **1000ms - 3000ms** (Stalls Cron/Ingestion) |
| **API Rate Limits** | ✅ **None (Unlimited local execution)** | ❌ **Strict Rate Limits / 429 Quota Exceeded risks** |
| **Cost & Reliability** | ✅ **100% Free & Offline Reliable** | ❌ **Per-token billing & internet outage risk** |
| **Extensibility** | ✅ **Pluggable via `POST /analyze`** | ✅ **Pluggable via `POST /analyze`** |

- **Process Isolation**: Heavy NLP computation must be isolated to prevent freezing the NestJS main event loop or WebSocket chart gateway.
- **Fault Tolerance & Reliability**: A failure or crash in the sentiment service must not bring down the main NestJS monolith or trading charts.
- **Graceful Degradation**: System must handle service unavailability by defaulting to neutral sentiment (`0.0`) and `HOLD` trading signals.

**Conclusion**: VADER ML is 100% compliant with project ML/AI requirements. By isolating Python behind `POST http://localhost:8000/analyze`, the architecture achieves 0-cost, 0-rate-limit local execution while preserving the modifiability to plug in FinBERT or LLM APIs if needed.

### Process Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NestJS Backend Monolith                            │
│                                                                             │
│  ┌──────────────────────┐        ┌──────────────────┐                       │
│  │   NewsCollectorCron  │ ─────> │   NewsService    │                       │
│  └──────────────────────┘        └────────┬─────────┘                       │
│                                           │                                 │
│                                           ▼                                 │
│                                  ┌──────────────────┐     HTTP REST         │
│                                  │ SentimentClient  │ ────────────────┐     │
│                                  └────────┬─────────┘                 │     │
└───────────────────────────────────────────┼───────────────────────────┼─────┘
                                            │ Error / Timeout           │
                                            ▼                           │
                                   ┌──────────────────┐                 │
                                   │ Graceful Fallback│                 │
                                   │ (Neutral / HOLD) │                 │
                                   └──────────────────┘                 │
┌───────────────────────────────────────────────────────────────────────┼─────┐
│                       Python Sentiment Process                        │     │
│                                                                       ▼     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ FastAPI App (POST /analyze) ──> VADER Analyzer ──> { score, label }   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Reliability & Graceful Degradation Rules
1. **Internal Boundary**: Python FastAPI endpoint (`http://localhost:8000/analyze`) is an internal service. Frontend client only calls NestJS `/api/news`.
2. **Timeout & Catching**: `SentimentClient` calls Python API with a 500ms timeout. Any timeout or HTTP error is caught cleanly.
3. **Fallback Score**: On error, `SentimentClient` returns `{ score: 0.0, label: "NEUTRAL" }`.
4. **Fallback Signal**: `NewsSentimentStrategy` checks for neutral/degraded status and issues `HOLD` signal to `StrategyRegistry`.

### Consequences
- **Positive**: Complete process isolation. High CPU usage in sentiment analysis cannot freeze NestJS or candlestick chart WebSocket streams.
- **Positive**: Full access to Python ML packages (`vaderSentiment`).
- **Positive**: Enables zero-downtime fallback (Graceful Degradation scenario #5).
- **Negative**: Requires running two processes during local development (NestJS + Python FastAPI).
- **Negative**: Adds minor inter-process HTTP latency (~5–15ms per request).
- **Risks**: Network connection failure if Python service is not started. Mitigated by `SentimentClient` fallback to neutral score and `HOLD` signal.

## Links
- Relates to ADR-0003 (Plugin Architecture — `NewsSentimentStrategy` is a versioned plugin)
- Relates to ADR-0001 (Record Architecture Decisions)
- Affects: `kb/modules/news-sentiment.md` (Sections 1, 2, 3, 8)
- Affects: `kb/flows/news-sentiment-pipeline.md` (Sections 3, 6, 7)
