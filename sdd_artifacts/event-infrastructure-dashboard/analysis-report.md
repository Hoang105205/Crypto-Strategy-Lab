# Analysis Report: event-infrastructure-dashboard

**Date**: 2026-08-14  
**Scope**: `kb/INDEX.md`, `kb/CONSTITUTION.md`, `kb/ARCHITECTURE.md`, `kb/MODULES.md`, all files in `kb/modules/` and `kb/flows/`, feature `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `research.md`, `quickstart.md`, all feature contracts, Prisma schema/migrations, shared TypeScript contracts, backend modules/configuration, Docker Compose, and relevant frontend source  
**Overall Health**: 🔴 Critical

## Findings

### [CRITICAL] [F-001]: No user story is implemented beyond the Phase 0 foundation

**Category**: tasks-code  
**Location**: `sdd_artifacts/event-infrastructure-dashboard/tasks.md:29-141`; `workspace/apps/backend/src/events/events.module.ts:7`; `workspace/apps/backend/src/queue/queue.module.ts:7`; `workspace/apps/backend/src/leaderboard/leaderboard.module.ts:7`; `workspace/apps/backend/src/loop/loop.module.ts:7`; `workspace/apps/backend/src/dashboard/dashboard.module.ts:7`; `workspace/apps/frontend/src/app/leaderboard/page.tsx:4-10`  
**Description**: T007-T049 are correctly still marked pending. The five backend feature modules are empty NestJS module shells, and the Leaderboard frontend is a static placeholder. There is no Event Bus adapter, BullMQ queue/worker, Leaderboard service/API, Search Loop, Dashboard BFF/gateway, or infrastructure frontend flow in source.  
**Impact**: None of US1-US5 or SC-002-SC-017 can currently execute. The feature is a contract/schema foundation, not a deployable dashboard or event-infrastructure implementation.  
**Recommendation**: Continue from T007 in dependency order. Do not present the feature as implemented until T007-T049 and their recorded validation gates are complete.

### [HIGH] [F-002]: Persisted Search Loop state cannot reproduce or continue its start request

**Category**: spec-plan  
**Location**: `sdd_artifacts/event-infrastructure-dashboard/spec.md:220-231`; `sdd_artifacts/event-infrastructure-dashboard/contracts/loop-api.md:6-15`; `sdd_artifacts/event-infrastructure-dashboard/data-model.md:72-90`; `workspace/apps/backend/prisma/schema.prisma:152-172`; `workspace/libs/shared/src/types/infrastructure.ts:82-110`  
**Description**: The Loop start contract requires `pair`, `timeframe`, `startDate`, `endDate`, and `backtestConfig`, and FR-074/FR-075 require restart recovery and reproducibility. `SearchLoopConfig` contains these values, but persistent `SearchLoopRun`, its shared response type, and the Prisma model omit all five. The plan's repository design does not specify another durable source for them.  
**Impact**: After the current in-flight candidate completes or the backend restarts, the Loop cannot reliably construct the next backtest request or reproduce the run from persisted state. This undermines the bounded restart behavior required by US4.  
**Recommendation**: Before T028-T034, add these immutable run inputs to `SearchLoopRun` (individual fields or a validated JSON snapshot), update the data model, Prisma migration, shared type, Loop API response, and repository/state tests.

### [HIGH] [F-003]: The documented Redis AOF guarantee is absent from Docker Compose

**Category**: constitution  
**Location**: `kb/ARCHITECTURE.md:90,146`; `kb/contracts/events.yaml:149-160`; `sdd_artifacts/event-infrastructure-dashboard/spec.md:191-196`; `workspace/docker-compose.yml:18-25`; `sdd_artifacts/event-infrastructure-dashboard/tasks.md:141`  
**Description**: The KB and active queue contract state that Redis uses AOF persistence, but the Redis service has no `appendonly yes` command or equivalent configuration. T049 acknowledges this work and remains pending.  
**Impact**: The checked-in development topology does not provide the persistence policy claimed by the KB. Accepted jobs may not have the documented durability characteristics across Redis/container failure, and restart acceptance evidence would not validate the stated topology.  
**Recommendation**: Configure AOF and a Redis health check in Compose before queue integration validation, then update quickstart/README operational notes and verify persistence with the actual Compose service.

### [HIGH] [F-004]: Plan and installed frontend violate the KB's authoritative Next.js version

**Category**: constitution  
**Location**: `kb/CONSTITUTION.md:3-17`; `kb/ARCHITECTURE.md:37`; `sdd_artifacts/event-infrastructure-dashboard/plan.md:13-16,26-33`; `workspace/apps/frontend/package.json:17,30`  
**Description**: The KB mandates Next.js 15.x, while the plan explicitly targets Next.js 16.3 and the frontend installs Next.js/eslint-config-next 16.3.0. The plan nevertheless records Knowledge Base compliance as PASS and contains no Complexity Tracking entry or approved KB/ADR change for the version deviation.  
**Impact**: This is a direct Article I/V governance conflict and makes the plan's constitution gate inaccurate. It also changes framework behavior and build assumptions for the planned UI work.  
**Recommendation**: Either align the frontend to the KB-supported version or update the KB through the governed decision process (including compatibility rationale), then correct the plan's Technical Context and Constitution Check.

### [MEDIUM] [F-005]: The canonical Leaderboard event contract omits one supported ranking criterion

**Category**: contracts-code  
**Location**: `sdd_artifacts/event-infrastructure-dashboard/spec.md:203-210`; `sdd_artifacts/event-infrastructure-dashboard/contracts/leaderboard-api.md:3-6`; `kb/contracts/events.yaml:287-298`; `workspace/libs/shared/src/types/enums.ts:65-71`  
**Description**: The spec, feature API contract, and shared enum support `maxDrawdown`, but the canonical `LeaderboardUpdated.rankingCriterion` comment lists only `score`, `totalReturn`, `winRate`, and `sharpeRatio`.  
**Impact**: Contract consumers generated or implemented from the KB contract can reject or omit a valid realtime ranking criterion even though REST and TypeScript accept it.  
**Recommendation**: Add `maxDrawdown` to the canonical event-contract value list and cover all five values in the Phase 1 contract/event tests.

### [MEDIUM] [F-006]: Plan and tasks disagree on the Leaderboard detail component path

**Category**: plan-tasks  
**Location**: `sdd_artifacts/event-infrastructure-dashboard/plan.md:212-215`; `sdd_artifacts/event-infrastructure-dashboard/tasks.md:127-128`  
**Description**: The source tree in the plan calls the component `strategy-detail.tsx`, while T044/T045 require `leaderboard-detail.tsx` and matching tests.  
**Impact**: Implementation may create duplicate components or leave the planned structure and task evidence pointing at different files.  
**Recommendation**: Choose one canonical name before T044. `leaderboard-detail.tsx` is already used consistently by the executable tasks and is the lower-impact choice.

### [MEDIUM] [F-007]: Queue module source still documents the superseded architecture

**Category**: module-architecture-code  
**Location**: `kb/modules/event-infrastructure.md:14`; `workspace/apps/backend/src/queue/queue.module.ts:1-3`; `kb/ADR/0013-adopt-bullmq-redis-for-backtest-jobs.md`  
**Description**: The Queue module header still describes an in-memory queue and cites ADR-0012, although ADR-0013 supersedes it and the active design requires BullMQ/Redis.  
**Impact**: The source-level module documentation contradicts the active architecture and can lead maintainers to implement or review against the obsolete adapter.  
**Recommendation**: Update the module header when T019 wires the BullMQ implementation, citing ADR-0013 and the Redis-backed queue contract.

## Verified Alignments

- T002 shared Event, queue, ranking, and Loop types mirror the active envelope and terminal-failure shapes; no active `willRetry` field was found.
- T003 exposes Strategy-owned execution/result ports and centralized DI tokens; no Event Infrastructure source directly accesses `StrategyVersion` or `BacktestResult` through Prisma.
- T004's Prisma schema contains `LeaderboardEntry.executedAt`, unique non-null `SearchLoopCandidate.jobId`, candidate `updatedAt`, and a non-null default-50 no-improvement bound. Its review-only migration safely aborts rather than inventing legacy candidate job IDs.
- T005's frontend Vitest/jsdom/Testing Library harness and smoke test files are present.
- T006's BullMQ/ioredis dependencies and Redis/queue environment validation are present. The feature validation file records the focused Phase 0 checks; this read-only analysis did not rerun mutation-producing build or migration commands.
- Existing runtime files outside Event Infrastructure are covered by their own feature/task sets; no verified direct implementation import or cross-module Strategy-table access was found in the current Event Infrastructure shells.

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH | 3 |
| MEDIUM | 3 |
| LOW | 0 |

## Constitution Compliance

| Principle | Status | Violations |
|-----------|--------|------------|
| I. Architecture Quality Over Trading Profitability | ⚠️ | 1: unapproved frontend stack divergence |
| II. Contract-Driven | ⚠️ | 1: `LeaderboardUpdated` criterion drift |
| III. Extension Points Must Be Demonstrable | ⚠️ | 1: demonstrations remain pending with T007-T049 |
| IV. Simplicity Over Cleverness | ✅ | 0 |
| V. Knowledge Base as Truth | ❌ | 2: Next.js version and Redis runtime configuration contradict the KB |
| VI. Explicit Over Implicit | ⚠️ | 1: persisted Loop inputs are implicit/missing |
| Security constraint | ✅ | 0 verified violations |

## Recommended Actions

1. Repair the Search Loop persistence design before implementing T028-T034; otherwise restart recovery cannot be correct.
2. Resolve the Next.js 15/16 governance conflict and configure Redis AOF before claiming constitution or durability compliance.
3. Correct the canonical ranking criterion list and the two documentation/path drifts.
4. Implement T007-T049 in the declared dependency order and rerun this analysis after the integration gates pass.
