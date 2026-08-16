# Event Infrastructure Dashboard T035 - 2026-08-16

## What worked

- Runtime-loading the not-yet-created `DashboardService`, `PushGateway`, and `InfrastructureErrorFilter` kept both RED specifications compilable while producing explicit failures owned by T036 and T037.
- Typed fakes were limited to the public `LeaderboardService.getLeaderboard`, `LoopStatusService.getCurrent`, and `IJobQueue` boundaries. Shared payloads, envelopes, events, and queue/loop/leaderboard types remained the executable source of truth.
- Non-contiguous fixture ranks made a hidden BFF rerank detectable: the summary must request `SCORE`, take the existing first five entries, and preserve both rank and `updatedAt`.
- Running the gateway failure-isolation case through the production `EventBus` proved the intended boundary: a throwing socket delivery is isolated by event dispatch, logged, and does not prevent a later independent delivery.
- Gateway metadata plus a source-boundary assertion locked the dedicated `/infrastructure` default without importing, reusing, or modifying `MarketDataGateway`, its namespace, rooms, or channels.

## What did not work initially

- The first baseline run had two Redis-dependent Queue failures because Redis was unavailable. After starting Docker Desktop and the repository Redis Compose service, the unchanged targeted baseline passed 19 suites and 234 tests.
- The first Dashboard RED draft rejected dependency errors at the service boundary but did not independently prove that raw messages were absent from the public HTTP contract. A reusable error-filter contract was added to `dashboard.service.spec.ts`; it requires only `{error, code}` and rejects stack, cause, and raw dependency secrets.
- Repository-wide `tsc --noEmit` remains red on pre-existing test typing errors in Leaderboard, Loop, Queue, and Strategy specifications. None points to either T035 file; Jest/ts-jest compiled both new specs and reached the intentional missing-production failures.

## Boundary decisions

- T035 adds exactly the two requested Dashboard specification files. It does not add production behavior and does not perform T036-T038 work.
- The Dashboard error-code vocabulary is not defined by the current spec or `contracts/dashboard-realtime.md`. T035 therefore locks a non-empty stable `code` and sanitized `{error, code}` shape, but deliberately does not invent an exact Dashboard/dependency error code.
- T037 calls for configurable `INFRASTRUCTURE_WS_NAMESPACE=/infrastructure`, but the artifacts do not define configuration lookup timing, validation, normalization, or behavior for an empty/invalid value. T035 locks the required default metadata only; the dynamic configuration strategy remains a contract gap for T037 rather than an assumption embedded in RED tests.
- The current Market Data gateway metadata is `market-data` (without a leading slash). The regression assertion preserves that production value exactly while requiring the new gateway to use the independently specified `/infrastructure` namespace.
- Connection and disconnection hooks may log transport lifecycle, but they must not subscribe per client or synthesize business/connection events on the infrastructure server.

## Reusable lesson

RED tests for an absent adapter remain trustworthy when they compile through the real toolchain, fail with an explicit missing-production cause, type their fakes at public boundaries, and separately exercise any already-existing infrastructure behavior that the new adapter relies on. Avoid resolving underspecified error vocabularies or configuration semantics inside a test-only task; record those gaps and lock only the accepted contract surface.

## KB impact

No KB architecture change is required for T035. Before or during T036/T037 contract refinement, document the stable Dashboard error-code vocabulary and the namespace configuration policy (lookup timing, normalization, and invalid-value behavior) in `contracts/dashboard-realtime.md` or an approved linked artifact.
