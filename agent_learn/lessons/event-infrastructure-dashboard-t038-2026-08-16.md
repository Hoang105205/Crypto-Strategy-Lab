# Event Infrastructure Dashboard T038 - 2026-08-16

## What worked

- `DashboardModule` imports only the public `EventsModule`, `LeaderboardModule`, `LoopModule`, and `QueueModule` boundaries and wires the controller, composition service, infrastructure gateway, and local error filter without `forwardRef` or implementation-specific providers.
- The integration harness imports the production `DashboardModule` and `EventsModule` behavior while replacing the three stateful dependency modules with contract modules that export the same public service/token boundaries. This exercises real Dashboard DI, HTTP filtering, EventBus subscriptions, gateway lifecycle, and Socket.IO transport without booting PostgreSQL, BullMQ workers, or external Market Data.
- Supertest verifies both active and null Loop snapshots, authoritative SCORE Top-5 slice order/ranks, full QueueStats, ISO timestamps, complete failure semantics, sanitized dependency failures, and preservation of an exact stable `HttpException` body.
- A real `socket.io-client` connects to `/infrastructure` on an ephemeral local port and observes all four exact channel/payload JSON projections. EventBus listener counts prove one gateway-scoped subscription per relay event and zero remaining relay listeners after application shutdown.
- Gateway failure isolation is tested through the production EventBus: a throwing socket emitter does not escape to the publisher or block a sibling subscriber, and the gateway log contains only its stable operational code/event type.
- Market Data namespace metadata, candle room naming, candle/status channels, and client lifecycle remain covered by both the integration boundary assertion and the unchanged Market Data gateway regression suite.

## What did not work initially

- The intentional RED run initialized an empty `DashboardModule`, then failed while resolving the first contract fake. Because the harness had not yet recorded the partially initialized app, that exploratory run retained a Jest handle until its command timeout. A focused `--forceExit` rerun captured the valid RED reason: the provider was absent. After production wiring, every final run with `--detectOpenHandles` exited normally.
- The first full TypeScript run found one new integration-test typing issue: an untyped `jest.fn()` was not assignable to the generic EventBus handler. Recording received envelopes in a typed callback preserved the sibling-delivery assertion and removed the T038 error.
- Repository-wide `tsc --noEmit` initially reported 16 pre-existing test-only errors in Leaderboard, Loop, Queue, and Strategy. Completion cleanup reconciled their Jest mock generics, transaction fake signatures, enum fixture, `BacktestResultDetail`, and required environment fields without changing production behavior; full backend TypeScript now passes.
- The first completion audit found 16 lint errors and one warning in the new Dashboard integration harness plus two editor-only diagnostics. Typed Supertest wire projections, a typed listening-server boundary, non-async Promise fakes, explicit `afterEach`, and Nest's definite-assignment assertion made the complete Phase 5 surface lint/IDE-clean without weakening assertions.

## Boundary decisions

- `AppModule` already imported `DashboardModule` exactly once, so T038 deliberately did not edit it or add a duplicate import.
- The production module imports `EventsModule` directly even though other imported modules also consume it. This makes the gateway's `IEVENT_BUS` dependency explicit; Nest reuses module instances rather than requiring a circular `forwardRef`.
- `socket.io-client` is declared as a backend development dependency because it is executable integration-test infrastructure, not production behavior.
- No Dashboard provider imports repositories, Prisma, `BullMqJobQueue`, MarketDataGateway, ranking algorithms, scoring policy, or Loop orchestration. The integration source audits lock the reserved-event and business-recomputation boundaries.
- No public contract or environment behavior changed in T038.

## Reusable lesson

For a Nest integration test around an orchestration module, import the production module under test and replace only stateful dependency modules with small contract modules exporting the same public classes/tokens. This validates real module metadata and lifecycle without accidentally constructing external infrastructure. Use a real ephemeral HTTP/Socket.IO server for wire behavior, then assert underlying EventEmitter listener counts before and after shutdown to turn cleanup and duplicate-subscription claims into executable evidence.

## KB impact

No new ADR is required. The accepted architecture did not change, but `kb/modules/event-infrastructure.md` and `kb/INDEX.md` were reconciled after the completion audit so source paths, public BFF calls, `generatedAt`, namespace configuration, and real Socket.IO integration evidence match the implementation.
