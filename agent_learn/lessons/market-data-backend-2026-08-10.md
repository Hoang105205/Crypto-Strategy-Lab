# Lessons: market-data-backend — 2026-08-10

## What Worked
- Bottom-up build along the dependency chain (adapter → service → gateway/controller → module) meant every layer had a passing unit test before the next was wired — the final module-boot spec passed first try on the DI graph.
- Constructor-less test seams: making the reconnect backoff a `protected` property (`reconnectDelaysMs`) instead of a constructor arg kept `BinanceAdapter` DI-clean (Nest can't resolve `Array` param metadata) while tests still inject fast delays.
- `waitFor(predicate)` polling in async tests instead of fixed `setTimeout` sleeps — fixed a flaky bounded-reconnect test where 20ms wasn't enough for chained macrotasks on a busy jest worker.
- Optional DI injection (`@Optional() @Inject(IEVENT_BUS)`) + skip/log cleanly handled the unresolved `IEventBus` dependency without blocking the feature.
- A DI-wiring spec (`Test.createTestingModule` + `overrideProvider(PrismaService)`) proved "module boots without DI errors" without needing a live database.

## What Didn't Work
- `useClass: BinanceAdapter` with a defaulted constructor arg → Nest tried to inject `Array` and failed at boot. Prefer zero-arg constructors for `useClass` providers; put test knobs on properties.
- `waitForOpen` that checked `readyState` synchronously raced the socket lifecycle; waiting for the real `open`/`close`/`error` events is deterministic.
- Fixed-sleep `flush(20)` assertions in reconnect tests — replaced by bounded polling.
- `import { ISomeInterface }` (value import) in decorated constructor signatures fails TS1272 under `isolatedModules` + `emitDecoratorMetadata` — must use `import type`.
- Circular class imports (service ↔ gateway, each injecting the other via `forwardRef(() => Class)`) keep tripping the IDE even when tsc/eslint pass. Broke it with an interface file + DI tokens (`IMarketDataGateway` in `tokens.ts`): each side now depends only on the contract. Note: mutual `useExisting` token aliases deadlocked module boot (init() timeout) — the injecting side still needs `forwardRef(() => TOKEN)` on one edge.
- Generated files didn't satisfy prettier (80-char lines) — the IDE showed them as red errors on the import lines. After writing code, run `npm run lint` (auto-fixes) and resolve remaining type-safety errors: avoid `.catch((e) => e)` (use `unknown` + cast), avoid untyped `mock.calls[i][j]` indexing (cast `mock.calls` to a typed array), cast `expect.any()`/`expect.objectContaining()` as `unknown` in assertions.

## Deviations from Plan
- DI tokens centralized in `apps/backend/src/shared/tokens.ts` (`IMARKET_DATA_ADAPTER`, `IMARKET_DATA_SERVICE`, `IEVENT_BUS`) — plan §4 left the location open; needed so Huy/Phương import one canonical file.
- `T0.3` (Prisma migration) and `T2.3` (manual smoke) BLOCKED: Docker Desktop daemon not running during implementation. Code-side prerequisites done (schema verified, seed.ts, prisma generate). Re-run when infra is up.
- Gateway adds socket-level `subscribe`/`unsubscribe` handlers (joins per-`symbol:timeframe` rooms) — required by flow 6c per-client unsubscribe; REST subscribe alone can't track clients. Contract channels unchanged.
- `status:connected` is emitted optimistically on 0→1 subscribe (no `onConnect` in `IMarketDataAdapter` contract) — logged as known limitation in note.md.
- Contract's `400` body matched exactly via `new BadRequestException({ error: '...' })` (object payload bypasses Nest's default body wrapping).

## KB Updates Needed
- [ ] Update kb/modules/market-data.md: document the DI token file (`src/shared/tokens.ts`) and the gateway's socket `subscribe` event + room model.
- [ ] Update kb/flows/realtime-market-data.md: clarify that the frontend joins candle rooms by emitting `subscribe` over socket.io (in addition to REST subscribe opening the Binance stream).
- [ ] Update kb/CONTRIBUTING.md (or a patterns card): TS1272 rule — `import type` for interfaces in decorated signatures; zero-arg constructors for `useClass` providers.
- [ ] New ADR needed: none (ADR-0004/0007 applied as designed; Symbol-token DI convention is minor — record in tokens.ts comments, confirm with Phương).
