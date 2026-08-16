# Event Infrastructure Dashboard T036 - 2026-08-16

## What worked

- Reconciling `contracts/dashboard-realtime.md` before production code removed the ambiguous public-error decision. The accepted vocabulary preserves `QUEUE_UNAVAILABLE` and `STRATEGY_ENGINE_UNAVAILABLE` at 503 and sanitizes every unclassified failure as `INTERNAL_ERROR` at 500.
- `DashboardService` composes only `LeaderboardService.getLeaderboard(SCORE)`, `LoopStatusService.getCurrent()`, and `IJobQueue.getStats()`. `Promise.all` prevents a successful partial response, while `slice(0, 5)` preserves the authoritative rank, criterion, timestamp, entry order, Loop state, and complete QueueStats projection.
- The reusable error filter recognizes an application-created `HttpException` only when its body is exactly `{error, code}`. Malformed/default exception bodies and unknown errors cannot reflect provider messages, stacks, or causes.
- Applying the filter with `@UseFilters` on `DashboardController` kept the change local. Source search and executable decorator metadata prove Queue, Loop, Leaderboard, and Market Data controllers are unchanged.
- The source-only TypeScript gate, targeted ESLint, backend build, Dashboard unit suite, and the 20-suite regression selection all passed. The combined T035 run leaves only PushGateway/T037 cases red.

## What did not work initially

- T035 originally locked only a non-empty error code, so production could not choose an internal code without inventing public contract behavior. Work paused until the contract explicitly approved the vocabulary and mapping semantics.
- The first targeted lint run exposed dynamic CommonJS loaders and unbound-method assertions in the RED harness. Replacing loaders with `jest.requireActual`, retaining runtime missing-module behavior, and asserting mock call arrays/metadata through a reflected handler made the test lint-clean without weakening its contract.
- Repository-wide `tsc --noEmit` still reports 16 pre-existing errors in Leaderboard, Loop, Queue, and Strategy test files. The production/source type-check and backend build pass, and the full output contains zero Dashboard or infrastructure-filter errors; unrelated tests were not modified under T036.

## Boundary decisions

- T036 creates only `dashboard.service.ts`, `dashboard.controller.ts`, and `shared/infrastructure-error.filter.ts` as production files. It does not wire `DashboardModule`/`AppModule`, create `PushGateway`, or perform T037/T038 behavior.
- Dashboard composition does not inject repositories, Prisma, `BullMqJobQueue`, scoring policy, or Loop orchestration. It neither recalculates score/rank nor derives Loop state.
- Any dependency read rejection rejects the entire summary. The controller boundary converts it to a stable response; no degraded or partial 200 shape exists.
- `generatedAt` is created only after all three authoritative reads resolve, representing the completed composite snapshot time.
- Stable `HttpException` preservation is structural and limited to an exact two-field public body. Known non-HTTP dependency codes use the explicit contract table; every other value becomes `INTERNAL_ERROR`.

## Reusable lesson

A reusable error filter can remain safe and locally adoptable when the contract first defines exact dependency/internal mappings, stable HTTP bodies are validated structurally, and controller-level scope is executable metadata rather than an assumption. For BFF reads, fail the complete concurrent composition and sanitize at the transport boundary instead of inventing partial health data.

## KB impact

No architecture or shared-interface update is required. The feature-local Dashboard contract was reconciled with the explicit error vocabulary needed by T036. The 16 unrelated backend test typing errors should be handled by their owning validation/convergence task rather than expanded into this implementation.
