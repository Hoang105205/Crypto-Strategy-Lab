# KB Consistency Review — 2026-08-31

> **Mode**: KB-only consistency audit  
> **Scope**: Current `kb/` against the approved plan, requirement document, SDD artifacts, and implementation at commit `148ca0f`  
> **Overall status**: **Needs revision**

## Executive Summary

The Search Loop desired-state and operator-authorization documentation is aligned with the implementation. ADR-0017/0018/0019, the Search Loop flow, the auth contract, the module map, and the glossary consistently describe database-authoritative bootstrap, `SEARCH_LOOP_DEFAULT_ENABLED` as a one-time default, deny-by-default operator authorization, and shutdown hooks.

The KB is not fully current in other recently changed areas. Two high-priority contradictions remain: persisted Leaderboard reranking is still described after the implementation deliberately removed it, and Strategy Engine documentation still says authentication is not required even though user backtest/composite/result endpoints require it. Dashboard design, disconnected Live-update reconciliation, incremental backtesting, contract metadata, and runtime/deployment metadata also need smaller corrections.

No broken relative Markdown links were found under `kb/`. ADR numbering is continuous from 0001 through 0019.

## Findings

### KB-001 — HIGH — Persisted Leaderboard reranking is still documented

**Owner**: Phương, with Hoàng review  
**Evidence in KB**:

- `kb/ADR/0011-leaderboard-as-observer.md:38` says the event handler re-sorts and trims persisted Top-K; lines 47–48 say cleanup reranks survivors.
- `kb/flows/leaderboard-update.md:96` says surviving rows are reranked after orphan cleanup.
- `kb/modules/event-infrastructure.md:120`, `:287`, `:341`, and `:351` repeat persisted reranking language.
- `kb/GLOSSARY.md:17` defines orphan cleanup as deletion followed by survivor reranking.

**Implementation evidence**:

- `workspace/apps/backend/src/leaderboard/leaderboard.repository.ts:55-64` performs one insert with stored `rank: 0`.
- `workspace/apps/backend/src/leaderboard/leaderboard.repository.ts:100-125` computes Top-K and assigns `index + 1` on read.
- `workspace/apps/backend/src/leaderboard/leaderboard.repository.ts:280-297` bounds the production query with SQL `ROW_NUMBER`, ordering, and `LIMIT`.
- `workspace/apps/backend/src/leaderboard/leaderboard.service.ts:138-159` inserts and reads the system Top-K; it does not call `rerank()`.

**Impact**: This directly contradicts the main scalability fix. A future maintainer following the KB could restore the removed N-update write path.

**Required update**: State that rows are append-only projections with non-authoritative stored `rank`; rank is computed per visibility scope and criterion at read time. Cleanup deletes confirmed orphans only, and the next read naturally closes rank gaps without survivor updates.

### KB-002 — HIGH — Strategy Engine security statement contradicts guarded APIs

**Owner**: Huy, with Hoàng review  
**Evidence in KB**:

- `kb/modules/strategy-engine.md:281` says “No auth required (course project).”
- `kb/flows/strategy-backtest.md:21-25` describes user submission but does not state the authentication precondition.

**Implementation evidence**:

- `workspace/apps/backend/src/strategy/controllers/strategy.controller.ts:31-33` applies `SupabaseJwtGuard` to the controller.
- The same file at `:86-88`, `:151-154`, and `:222-224` additionally applies `RequireAuth` to composite creation, backtest submission, and backtest-result reads.
- `kb/contracts/auth.yaml:42-61` already defines the correct optional-auth and required-auth guard behavior.

**Impact**: The source of truth gives an incorrect security posture and can cause incorrect API clients, tests, or future endpoint implementations.

**Required update**: Replace the blanket no-auth statement with endpoint-level rules and add “authenticated user” to the backtest flow preconditions.

### KB-003 — MEDIUM — Dashboard design still includes UI that was removed

**Owner**: Phương  
**Evidence in KB**:

- `kb/DESIGN.md:590` says the Dashboard monitors queue health.
- `kb/DESIGN.md:599` places a queue-health summary in the right column.
- `kb/DESIGN.md:604` says `LoopStatusPanel` displays candidate count, best score, and elapsed time.
- `kb/modules/event-infrastructure.md:334` describes those counts as part of the visible demo story.

**Implementation evidence**:

- `workspace/apps/frontend/src/app/page.tsx:26-48` supplies only `LoopStatusPanel` and `LeaderboardPreview` to the dashboard grid.
- `workspace/apps/frontend/src/components/dashboard/loop-status-panel.spec.tsx:86` explicitly verifies that Best Score is not rendered.
- The Queue Health component remains in the repository but is no longer mounted on the Dashboard.

**Impact**: UI/design review and demo preparation will expect controls and operational details that end users no longer see. The backend summary may still return queue data; that API statement should not be removed unless the endpoint also changes.

**Required update**: Describe the current compact read-only status + Live-update switch, and remove Queue Health from the Dashboard layout/purpose. Clarify that queue telemetry remains an internal/backend capability.

### KB-004 — MEDIUM — Live-update docs omit the disconnected polling fallback

**Owner**: Phương  
**Evidence in KB**:

- `kb/ADR/0011-leaderboard-as-observer.md:20` and `:56-57`, `kb/flows/leaderboard-update.md:10`, and `kb/modules/event-infrastructure.md:102` describe Live updates as operating without polling.
- `kb/flows/leaderboard-update.md:31-37` and `:114` cover event invalidation and reconnect reconciliation but not periodic reconciliation while disconnected.

**Implementation evidence**:

- `workspace/apps/frontend/src/contexts/leaderboard-live-context.tsx:29` defines `DISCONNECTED_LIVE_POLL_MS = 15_000`.
- The same file at `:688-696` starts REST reconciliation every 15 seconds when Live is ON and the socket is not connected.

**Impact**: The primary event-driven architecture remains correct, but reliability behavior and REST load during an outage are undocumented.

**Required update**: Describe WebSocket invalidation as the primary path and the 15-second REST loop as a bounded, disconnected-only fallback that stops after reconnection or when Live is OFF.

### KB-005 — MEDIUM — Incremental backtester optimization is absent from Strategy KB

**Owner**: Huy  
**Evidence in KB**:

- `kb/flows/strategy-backtest.md:29` only says `strategy.analyze()` is called on each window.
- `kb/modules/strategy-engine.md:282-285` claims O(N × M) analysis but does not explain the incremental session contract or the compatibility fallback.
- `kb/modules/strategy-engine.md:106` describes composite analysis only through full-array `analyze(candles)`.

**Implementation evidence**:

- `workspace/apps/backend/src/strategy/backtester/backtester.service.ts:36-49` creates an isolated analysis session and feeds one candle at a time, avoiding prefix copies and repeated full-history indicator calculation.
- Built-in strategies expose `createAnalysisSession()`; equivalence is covered by `workspace/apps/backend/src/strategy/strategies/tests/incremental-analysis.spec.ts`.

**Impact**: A major performance/scalability decision is invisible in the architecture source of truth, so later strategy plugins may accidentally reintroduce O(n²) behavior.

**Required update**: Document `createAnalysisSession().next(candle)` as the preferred built-in/plugin execution path, the full-prefix API as compatibility fallback, session isolation per backtest, composite incremental delegation, and no-lookahead equivalence.

### KB-006 — MEDIUM — Event contract omits a supported ranking criterion

**Owner**: Phương, with Hoàng review  
**Evidence**:

- `kb/contracts/events.yaml:342` lists `score`, `totalReturn`, `winRate`, and `sharpeRatio` for `rankingCriterion` but omits `maxDrawdown`.
- `workspace/libs/shared/src/types/enums.ts:68-74` includes `RankingCriterion.MAX_DRAWDOWN`.

**Impact**: The event contract and shared compile-time contract disagree. This can produce incomplete generated documentation or validation.

**Required update**: Add `maxDrawdown`, or narrow and explain the event field as always `score` if that is the intended wire invariant.

### KB-007 — MEDIUM — Architecture runtime/deployment metadata is stale

**Owner**: Hoàng  
**Evidence in KB**:

- `kb/ARCHITECTURE.md:37` records Next.js 15.x; `workspace/apps/frontend/package.json:20` uses 16.3.0.
- `kb/ARCHITECTURE.md:44` records Jest 29.x; `workspace/apps/backend/package.json:59` uses Jest 30.
- `kb/ARCHITECTURE.md:91` and `:150` say local Docker Compose supplies PostgreSQL; `workspace/docker-compose.yml:4-8` currently defines Redis only, while `workspace/.env.example:8` points to a Supabase PostgreSQL connection.

**Impact**: Setup and architecture walkthroughs can fail or describe the wrong topology.

**Required update**: Align the version table and development deployment section with the actual package manifests and Redis-only Compose/Supabase database setup.

### KB-008 — LOW — Strategy module contains stale source paths

**Owner**: Huy  
**Evidence**:

- `kb/modules/strategy-engine.md:15` points to singular `app/strategy/` instead of `app/strategies/`.
- Lines `24`, `26`, `31`, `36`, and `37` reference old filenames such as `ma.strategy.ts`, `bollinger.strategy.ts`, `backtester.ts`, `strategy-version.ts`, and `strategy/strategy.controller.ts`.
- Current implementation uses `moving-average.strategy.ts`, `bollinger-bands.strategy.ts`, `backtester/backtester.service.ts`, `versioning/strategy-versioning.service.ts`, and `controllers/strategy.controller.ts`.

**Impact**: Low runtime risk, but poor navigability and confusing evidence during code review/demo.

**Required update**: Refresh the component table and frontend source directory.

## Confirmed Aligned Areas

- **Search Loop desired state**: `kb/ADR/0018-database-authoritative-search-loop-bootstrap.md`, `kb/flows/strategy-search-loop.md:17-22,92`, `kb/GLOSSARY.md:20`, and implementation agree on “missing row → environment once; existing row → database wins.”
- **Bootstrap ordering and logging**: `SearchLoopSupervisorService.onApplicationBootstrap()` seeds before ticking and logs desired-state transitions only on change.
- **Concurrent seed safety**: ADR-0018 and repository behavior agree on adopting the row after a Prisma `P2002` race.
- **Shutdown lifecycle**: `workspace/apps/backend/src/main.ts:9` now enables shutdown hooks, consistent with the Search Loop lifecycle decision.
- **Operator authorization**: ADR-0019, `kb/contracts/auth.yaml:63-72`, `kb/flows/strategy-search-loop.md:47`, module API tables, and all seven mutation routes agree on 401/403 allowlist behavior.
- **Leaderboard privacy model**: caller visibility before Top-K/rank/timestamp and privacy-safe namespace invalidation are consistently documented and implemented.
- **Document structure**: core KB indexes, module/flow templates, ADR numbering, and relative Markdown cross-references are structurally sound; broken-link scan found zero missing relative targets.

## Per-Member Summary

| Member | KB area | Status | Main action |
|---|---|---|---|
| Hoàng | Core architecture, glossary, review | Needs minor revision | Runtime versions/deployment topology; review shared glossary/security statements |
| Huy | Strategy Engine and backtest flow | Needs revision | Correct auth rules, document incremental analysis, refresh paths |
| Thuận | News & Sentiment | Pass in this change-focused audit | No contradiction found with the reviewed cross-module paths |
| Phương | Event Infrastructure, Leaderboard, Loop, Dashboard design | Needs revision | Remove persisted-rerank language; update UI, fallback, and event criterion contract |

## Recommended Order

1. Fix KB-001 and KB-002 before architecture review or further implementation work.
2. Fix KB-003 through KB-006 in the same documentation pass because they describe already-shipped behavior.
3. Refresh KB-007 and KB-008 as documentation maintenance.

## Verification Performed

- Inspected the approved ownership plan and relevant requirement sections.
- Inspected all core KB indexes, module/flow/contract inventories, ADR inventory, relevant SDD artifacts, current source, package manifests, Compose topology, Git status, and recent commit history.
- Scanned every Markdown file below `kb/` for missing relative-link targets: **0 broken links**.
- No source or KB file was modified by this review; only this report was added, as required by KB review mode.
- Tests were not run because this was a documentation consistency audit; implementation evidence was taken from current source and existing focused tests.
