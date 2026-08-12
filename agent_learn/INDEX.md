# Agent Learn Index

This directory stores what the agent has learned during SDD workflow execution.
It is for agent read-only reference — do not modify manually unless you are updating lessons.

## Lessons

| Date | Feature | File | Key takeaways |
|------|---------|------|---------------|
| 2026-08-10 | market-data-backend | [lessons/market-data-backend-2026-08-10.md](lessons/market-data-backend-2026-08-10.md) | `import type` for decorated interface params (TS1272); zero-arg constructors for `useClass` DI; poll-based async test assertions; optional `IEventBus` injection pattern; migration/smoke blocked on Docker |
| 2026-08-11 | news-sentiment-pipeline | [lessons/news-sentiment-pipeline-2026-08-11.md](lessons/news-sentiment-pipeline-2026-08-11.md) | Process isolation (ADR-0009) via Python FastAPI; Provider Adapter pattern (ADR-0010); 500ms timeout Graceful Degradation in NestJS SentimentClient; centralized constants in libs/shared; CronExpression enum handling |
| 2026-08-10 | market-data-frontend | [lessons/market-data-frontend-2026-08-10.md](lessons/market-data-frontend-2026-08-10.md) | lightweight-charts v5 `addSeries()` API; React 19 ref-during-render lint rule (use `useState` not `useRef` for chart instance); Tailwind v4 `@theme` CSS config; socket.io room joining required in addition to REST subscribe |
| 2026-08-11 | strategy-registry | [lessons/strategy-registry-2026-08-11.md](lessons/strategy-registry-2026-08-11.md) | Enhanced StrategyRegistry with collision validation, delegation analyze method, and full unit test coverage. |
| 2026-08-12 | strategy-engine | [lessons/strategy-engine-2026-08-12.md](lessons/strategy-engine-2026-08-12.md) | Fullstack Strategy Engine (Plugin Registry, Base Strategies, Composite & Combiners, Backtest & Evaluator, REST APIs, and Strategy Builder UI). |


