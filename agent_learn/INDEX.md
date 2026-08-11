# Agent Learn Index

This directory stores what the agent has learned during SDD workflow execution.
It is for agent read-only reference — do not modify manually unless you are updating lessons.

## Lessons

| Date | Feature | File | Key takeaways |
|------|---------|------|---------------|
| 2026-08-10 | market-data-backend | [lessons/market-data-backend-2026-08-10.md](lessons/market-data-backend-2026-08-10.md) | `import type` for decorated interface params (TS1272); zero-arg constructors for `useClass` DI; poll-based async test assertions; optional `IEventBus` injection pattern; migration/smoke blocked on Docker |
| 2026-08-10 | market-data-frontend | [lessons/market-data-frontend-2026-08-10.md](lessons/market-data-frontend-2026-08-10.md) | lightweight-charts v5 `addSeries()` API; React 19 ref-during-render lint rule (use `useState` not `useRef` for chart instance); Tailwind v4 `@theme` CSS config; socket.io room joining required in addition to REST subscribe |
