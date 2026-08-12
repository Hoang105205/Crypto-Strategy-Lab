# Implementation Plan: Strategy REST API & Event Bus Integration

**Feature**: `strategy-rest-events` | **Date**: 2026-08-12 | **Spec**: spec.md

## Summary
Implement NestJS `StrategyController` to expose REST endpoints (`GET /api/strategies`, `POST /api/strategies/composite`, `POST /api/strategies/backtest`) and emit `BacktestRequested` events using an Event Bus service / `@nestjs/event-emitter`.

## Technical Context
**Language/Version**: TypeScript (Node.js / NestJS)
**Dependencies**: `@crypto-strategy-lab/shared`, NestJS `@Controller`, `@Get`, `@Post`, `@Body`, `@EventEmitter2` or EventBus service.
**Testing**: Jest unit tests mocking services and event emitter.
**Target Platform**: Backend Service (`StrategyModule`).

## Source Code Structure
```
apps/backend/src/strategy/
├── controllers/
│   ├── strategy.controller.ts      # REST Controller
│   ├── dtos/
│   │   ├── create-composite.dto.ts
│   │   └── request-backtest.dto.ts
│   ├── index.ts
│   └── tests/
│       └── strategy.controller.spec.ts
├── events/
│   ├── backtest-requested.event.ts # Event payload definition
│   ├── event-bus.service.ts        # Event publisher service
│   ├── index.ts
│   └── tests/
│       └── event-bus.spec.ts
└── strategy.module.ts              # Register Controller & EventBus in NestJS module
```
