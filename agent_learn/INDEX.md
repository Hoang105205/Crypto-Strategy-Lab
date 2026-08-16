# Agent Learn Index

- [Event Infrastructure Dashboard T027 — 2026-08-16](lessons/event-infrastructure-dashboard-t027-2026-08-16.md): production Nest/EventBus integration harness, executable Prisma ownership tripwires, REST/event acceptance, cleanup, and scoring-provider swap proof.

- [Event Infrastructure Dashboard T026 — 2026-08-16](lessons/event-infrastructure-dashboard-t026-2026-08-16.md): Strategy-owned full detail read reconciliation, stable Leaderboard DTO errors, ConfigService Top-K wiring, module exports, and ownership audits.

- [Event Infrastructure Dashboard T025 — 2026-08-16](lessons/event-infrastructure-dashboard-t025-2026-08-16.md): Idempotent Observer lifecycle, runtime metric validation, ordered persistence/ranking publication, duplicate-race suppression, and port-only detail composition.

- [Event Infrastructure Dashboard T024 — 2026-08-16](lessons/event-infrastructure-dashboard-t024-2026-08-16.md): Transactional full reranking, criterion-specific best-per-version projections, P2002 duplicate no-op, explicit payload mapping, and strict LeaderboardEntry ownership.

- [Event Infrastructure Dashboard T022 — 2026-08-16](lessons/event-infrastructure-dashboard-t022-2026-08-16.md): RED-first mocked-Prisma repository contract, deterministic full ranking, best-per-version Top-K, and executable Strategy-table boundary protection.

- [Event Infrastructure Dashboard T020 — 2026-08-16](lessons/event-infrastructure-dashboard-t020-2026-08-16.md): Redis-isolated acceptance harness, real stalled recovery, fail-fast/persistent connection evidence, Redis date rehydration, and honest AOF scope.
- [Event Infrastructure Dashboard T019 — 2026-08-16](lessons/event-infrastructure-dashboard-t019-2026-08-16.md): acyclic runtime-module wiring, one BullMQ provider behind `IJOB_QUEUE`, split Redis ownership, producer ordering, and clean Nest teardown.

- [Event Infrastructure Dashboard T018 — 2026-08-16](lessons/event-infrastructure-dashboard-t018-2026-08-16.md): stable Queue REST responses, explicit UUID pipe validation, port-only controller coordination, and Supertest mapping evidence.
- [Event Infrastructure Dashboard T017 — 2026-08-16](lessons/event-infrastructure-dashboard-t017-2026-08-16.md): unique-key DLQ mirroring, conditional transactional retry claims, rollback on Redis rejection, and stable sanitized repository errors.
- [Event Infrastructure Dashboard T016 — 2026-08-16](lessons/event-infrastructure-dashboard-t016-2026-08-16.md): shared-port worker pipeline, result-before-event ordering, stable failure taxonomy, and stalled-delivery coalescing.

- [Event Infrastructure Dashboard T015 — 2026-08-15](lessons/event-infrastructure-dashboard-t015-2026-08-15.md): explicit BullMQ duplicate detection, queue-state projection, retry reset, and Redis-backed teardown evidence.
- [Event Infrastructure Dashboard T014 — 2026-08-15](lessons/event-infrastructure-dashboard-t014-2026-08-15.md): BullMQ config, split Redis outage policies, idempotent connection ownership, and sanitized stable errors.

This directory stores what the agent has learned during SDD workflow execution.
It is for agent read-only reference — do not modify manually unless you are updating lessons.

## Lessons

| Date | Feature | File | Key takeaways |
|------|---------|------|---------------|
| 2026-08-10 | market-data-backend | [lessons/market-data-backend-2026-08-10.md](lessons/market-data-backend-2026-08-10.md) | `import type` for decorated interface params (TS1272); zero-arg constructors for `useClass` DI; poll-based async test assertions; optional `IEventBus` injection pattern; migration/smoke blocked on Docker |
| 2026-08-11 | news-sentiment-pipeline | [lessons/news-sentiment-pipeline-2026-08-11.md](lessons/news-sentiment-pipeline-2026-08-11.md) | Process isolation (ADR-0009) via Python FastAPI; Provider Adapter pattern (ADR-0010); 500ms timeout Graceful Degradation in NestJS SentimentClient; centralized constants in libs/shared; CronExpression enum handling |
| 2026-08-10 | market-data-frontend | [lessons/market-data-frontend-2026-08-10.md](lessons/market-data-frontend-2026-08-10.md) | lightweight-charts v5 `addSeries()` API; React 19 ref-during-render lint rule (use `useState` not `useRef` for chart instance); Tailwind v4 `@theme` CSS config; socket.io room joining required in addition to REST subscribe |
| 2026-08-12 | event-infrastructure-dashboard (Phase 0) | [lessons/event-infrastructure-dashboard-phase-0-2026-08-12.md](lessons/event-infrastructure-dashboard-phase-0-2026-08-12.md) | Executable contract gate; discriminated queue payload correlation; Strategy-owned ports/tokens; no Prisma migration before review |
| 2026-08-15 | event-infrastructure-dashboard (Phase 1) | [lessons/event-infrastructure-dashboard-phase-1-2026-08-15.md](lessons/event-infrastructure-dashboard-phase-1-2026-08-15.md) | `useExisting` public-token seam; per-subscriber sync/async isolation; adapter override test; source-vs-legacy-test type evidence |
| 2026-08-11 | strategy-registry | [lessons/strategy-registry-2026-08-11.md](lessons/strategy-registry-2026-08-11.md) | Enhanced StrategyRegistry with collision validation, delegation analyze method, and full unit test coverage. |
| 2026-08-12 | strategy-engine | [lessons/strategy-engine-2026-08-12.md](lessons/strategy-engine-2026-08-12.md) | Fullstack Strategy Engine (Plugin Registry, Base Strategies, Composite & Combiners, Backtest & Evaluator, REST APIs, and Strategy Builder UI). |
| 2026-08-13 | search-engine-coordinator | [lessons/search-engine-coordinator-2026-08-13.md](lessons/search-engine-coordinator-2026-08-13.md) | Facade pattern over Strategy Generators. |
| 2026-08-13 | news-pagination-multicoin | [lessons/news-pagination-multicoin-2026-08-13.md](lessons/news-pagination-multicoin-2026-08-13.md) | News Feed Offset Pagination & Multi-Coin Filter |
| 2026-08-13 | sentiment-timeframe-selector | [lessons/sentiment-timeframe-selector-2026-08-13.md](lessons/sentiment-timeframe-selector-2026-08-13.md) | Aggregate Mood Timeframe Selector (`1h`, `24h`, `7d`) |
| 2026-08-13 | fix-backtest-mock-data | [lessons/fix-backtest-mock-data-2026-08-13.md](lessons/fix-backtest-mock-data-2026-08-13.md) | Replaced mock backtest data with Prisma integration |
| 2026-08-14 | domain-guided-search-enhancement | [lessons/domain-guided-search-enhancement-2026-08-14.md](lessons/domain-guided-search-enhancement-2026-08-14.md) | technicalindicators library; Record mapping for StrategyType |
| 2026-08-14 | fix-strategy-engine-bugs | [lessons/fix-strategy-engine-bugs-2026-08-14.md](lessons/fix-strategy-engine-bugs-2026-08-14.md) | Inject interfaces via tokens; avoid local implementations of shared event buses |
