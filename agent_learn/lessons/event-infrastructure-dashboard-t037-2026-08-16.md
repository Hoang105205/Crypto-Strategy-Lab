# Event Infrastructure Dashboard T037 - 2026-08-16

## What worked

- `PushGateway` injects only the canonical `IEVENT_BUS`/`IEventBus` seam. Four typed subscriptions map the exact shared Event payloads to `leaderboard:update`, `loop:started`, `loop:progress`, and `loop:stopped` without importing EventBus, EventEmitter2, Leaderboard, Loop, or Market Data implementations.
- The gateway sends `envelope.payload` by identity. There is no envelope forwarding, wrapper, ranking, scoring, Loop-state derivation, room protocol, or connection-status business Event.
- Initialization stages subscription handles locally and publishes them to gateway state only after all four registrations succeed. Repeated initialization is a no-op; shutdown drains state before cleanup, so repeated destroy is safe and one unsubscribe failure cannot prevent the other handles from being attempted.
- Socket emit and cleanup failures are caught independently and logged with fixed operational codes plus the Event type where available. Raw exception messages, stacks, causes, credentials, and transport details are not logged by the gateway.
- Connection/disconnection hooks are explicit no-ops. Domain subscriptions remain gateway-scoped rather than client-scoped.
- Default and custom namespace metadata are executable tests. EventBus and Market Data regression suites prove delivery isolation without modifying the existing gateway, namespace, rooms, or channels.

## What did not work initially

- The first GREEN run had two logger-spy failures because resetting Jest's module registry in every `beforeEach` created a second Nest `Logger` class instance. Restricting module reset to the custom-namespace case preserved module-load re-evaluation while letting lifecycle tests observe the production logger instance.
- The first targeted lint run exposed unbound-method assertions and two intentionally ignored union sync/async lifecycle returns in the T035 harness. Assertions now inspect typed mock call arrays, and the runtime lifecycle calls use explicit `void`; production behavior did not change.
- The wide 21-suite regression passed 254 tests but printed Jest's existing post-run open-handle warning after Queue/Redis coverage. Exit status remained zero and the focused three-suite rerun exited cleanly.
- Repository-wide `tsc --noEmit` continues to report the same 16 pre-existing errors in Leaderboard, Loop, Queue, and Strategy tests. T037 adds zero type errors; source-only TypeScript, lint, and backend build pass.

## Boundary decisions

- `INFRASTRUCTURE_WS_NAMESPACE` is resolved when `push.gateway.ts` is evaluated because `@WebSocketGateway` metadata is created before constructor DI. A missing or empty value selects `/infrastructure`; a non-empty custom value is used verbatim. Changing the environment after import does not mutate the existing gateway metadata, so a process/module restart is required.
- No `environment.ts`/`environment.spec.ts` change is needed. The namespace is decorator/bootstrap configuration rather than constructor-injected runtime state, and T037 does not introduce validation or normalization semantics absent from the task.
- T037 creates only `dashboard/push.gateway.ts` as production behavior and tightens its existing T035 spec. `DashboardModule`, `AppModule`, integration wiring, and validation evidence remain T038.
- Market Data remains on its existing metadata value `market-data` and retains all per-client room/subscription behavior. The infrastructure gateway uses no rooms and does not import or reuse `MarketDataGateway`.

## Reusable lesson

Configuration consumed by a class decorator must be selected before the module is imported. Test default/custom metadata by controlling the environment and module cache before evaluation, then treat later environment changes as restart-required. Keep event relays typed at the shared payload map, store cleanup handles at gateway scope, and sanitize adapter failure logs independently from the Event Bus's broader subscriber logging policy.

## KB impact

No public contract or architecture change is required. T037 implements the accepted `/infrastructure` topology and task-defined environment override. T049 should document the bootstrap-time namespace setting and restart requirement in the final environment/operations handoff.
