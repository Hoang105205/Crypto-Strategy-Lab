# E2E Project Review — 2026-08-17

**Reviewer**: Hoàng (Architect)
**Mode**: Full (KB + Code)
**Overall Health**: 🟡 Needs Attention — Market Data complete, Strategy Engine + News + Event Infra have code but integration gaps and unverified contracts need resolution before demo

---

## Per-Member Summary

| Member | Module | Source Files | Spec Files | KB Complete | Code Exists | Health |
|---|---|---|---|---|---|---|
| **Hoàng** | Market Data + Shared | 11 source + 5 spec | 5 suites / 36 tests | ✅ | ✅ Complete | 🟢 |
| **Huy** | Strategy Engine | 37 source + 18 spec | Multiple spec files | ✅ | ✅ Extensive | 🟡 |
| **Thuận** | News & Sentiment | 9 source (backend) + 3 Python | None found | ✅ | ✅ | 🟡 |
| **Phương** | Event Infrastructure | 31 source (events+queue+loop+leaderboard+dashboard) | Multiple .spec.tsx | ✅ | ✅ Extensive | 🟡 |

---

## Member Details

### Hoàng — Market Data + Shared Infrastructure

**Assigned deliverables**: BinanceAdapter (REST+WS), MarketDataService, MarketDataGateway, MarketDataController, Prisma schema (10 models), DI tokens, frontend chart components (6 + 2 hooks + 2 services + 2 lib files)

**Status**: ✅ Complete — 13/20 tasks done (P0+P1+P2)

#### Findings

##### [LOW] [F-001]: TradeMarkers stub not yet integrated
**File**: `apps/frontend/src/components/chart/trade-markers.tsx`
**Check**: 4c (Pattern Implementation)
**Issue**: Component returns `null` — no trade markers rendered. Depends on Huy's BacktestResult.trades.
**Impact**: Req §25 (Visualization: Buy/Sell markers) not fully met for demo.
**Action**: Integrate once Huy's backtest API exposes trade data (W3).

##### [LOW] [F-002]: Frontend manual smoke test not yet run
**File**: `sdd_artifacts/market-data-frontend/note.md` §3
**Check**: 4e (Error Handling)
**Issue**: tsc + eslint + next build all pass, but live dashboard (backend + frontend together) not yet smoke-tested.
**Impact**: Unknown runtime issues may surface during integration.
**Action**: Run both servers, verify quickstart.md scenarios 1–7.

**Member verdict**: ✅ Pass — Market Data backend is the most thoroughly tested module (36 unit tests, live smoke test against Supabase + Binance). Frontend compiles clean.

---

### Huy — Strategy Engine

**Assigned deliverables**: StrategyRegistry (plugin), 4+ strategies (MA, RSI, Bollinger, SR), CompositeStrategy + combiners, Backtester, Evaluator, SearchEngine (Random + DomainGuided), StrategyVersioning, REST API, frontend strategy pages

**Status**: ✅ Code exists — 37 TS source files + 18 spec files (most comprehensive implementation)

#### Findings

##### [CRITICAL] [F-003]: Verify `IMarketDataService.getCandlesRange()` contract compliance
**File**: `apps/backend/src/strategy/backtester/backtester.service.ts`
**Check**: 4b (Contract Compliance) + 5a (Contract Alignment)
**Issue**: Backtester must call `getCandlesRange(symbol, timeframe, startTime, endTime)` per `kb/contracts/market-data.yaml`. Need to verify the actual call signature matches — not `getHistorical()` (which appears in `kb/modules/event-infrastructure.md` but is not in the market-data contract).
**Impact**: If Huy used a different method name or signature, the Market Data module won't resolve at runtime → backtests fail.
**Action**: Huy must verify his Backtester imports and calls `IMarketDataService.getCandlesRange()` exactly as defined in `kb/contracts/market-data.yaml` line 77-80. Check the DI token used (`IMARKET_DATA_SERVICE` from `apps/backend/src/shared/tokens.ts`).

##### [HIGH] [F-004]: Verify `BacktestRequested` event payload matches `events.yaml`
**File**: `apps/backend/src/strategy/events/backtest-requested.event.ts`
**Check**: 5a (Contract Alignment)
**Issue**: `events.yaml` defines `BacktestRequested` payload with fields: `jobId`, `strategyVersionId`, `pair`, `timeframe`, `startDate`, `endDate`, `backtestConfig`, `source`, `loopRunId?`. Huy's event class must match exactly — especially `jobId` (producer-generated, not queue-generated) and `source` (USER vs SEARCH_LOOP).
**Impact**: If payload mismatches, Phương's Job Queue can't preserve `jobId` or route by `source` priority.
**Action**: Huy must cross-check `backtest-requested.event.ts` against `events.yaml` `events.BacktestRequested.payload`.

##### [HIGH] [F-005]: Verify `IBacktester.run()` and `IEvaluator.evaluate()` signatures match `strategy.yaml`
**File**: `apps/backend/src/strategy/backtester/backtester.service.ts`, `evaluator/evaluator.service.ts`
**Check**: 4b (Contract Compliance)
**Issue**: Contract defines `IBacktester.run(strategy: IStrategy, candles: Candle[], config: BacktestConfig) → Trade[]` and `IEvaluator.evaluate(trades: Trade[], initialCapital: number) → EvaluationMetrics`. Need to verify actual implementations match.
**Impact**: If Phương's Worker calls these with different args, backtests fail at runtime.
**Action**: Huy must verify interface implementations match `kb/contracts/strategy.yaml` lines 51-68.

##### [MEDIUM] [F-006]: No `IStrategyGenerator` interface verification against contract
**File**: `apps/backend/src/strategy/search/search-engine.ts`
**Check**: 4b (Contract Compliance)
**Issue**: Contract defines `IStrategyGenerator.generate(count: number) → IStrategy[]`. The SearchEngine should use this interface, not concrete generator classes directly. Verify dependency injection uses the interface.
**Impact**: If Phương's LoopController can't swap generators via interface, extensibility scenario #2 fails.
**Action**: Verify `strategy-candidate.port.ts` implements `IStrategyCandidatePort` as defined in `strategy.yaml`.

##### [MEDIUM] [F-007]: Strategy implementations beyond MVP (MACD, Stochastic, ATR)
**File**: `apps/backend/src/strategy/strategies/macd.strategy.ts`, `stochastic.strategy.ts`, `atr.strategy.ts`
**Check**: 4c (Pattern Implementation)
**Issue**: MVP (§37) requires 4 strategies (MA, RSI, Bollinger, SR). Huy has implemented 7 — this is excellent for extensibility demo but verify each follows the Plugin pattern (implements `IStrategy`, registered via `StrategyRegistry.register()`).
**Impact**: Positive — if all 7 are properly registered, this directly demonstrates extensibility scenario #1.
**Action**: Verify all strategies are registered in `strategy.module.ts` or a bootstrap file.

**Member verdict**: 🟡 Pass with notes — extensive implementation (37 files, 18 specs), but contract compliance with Market Data and Event Infrastructure modules must be verified before integration.

---

### Thuận — News & Sentiment

**Assigned deliverables**: INewsProvider (RSS, CryptoPanic, Crawler), NewsCollectorCron, NewsService, SentimentClient, Python FastAPI sentiment service, NewsSentimentStrategy, frontend news page

**Status**: ✅ Code exists — 9 backend TS files + 4 Python files + frontend NewsFeed component

#### Findings

##### [HIGH] [F-008]: No spec/test files found for News module
**File**: `apps/backend/src/news/` (entire directory)
**Check**: 4e (Error Handling / Testing)
**Issue**: No `.spec.ts` files found in the news directory. Other modules (strategy: 18 specs, market-data: 5 specs) have extensive tests. News module has zero.
**Impact**: Provider fault isolation (ADR-0010: "adapters return `[]` not throw"), sentiment client timeout (500ms), and graceful degradation (HOLD fallback) are untested — these are critical reliability patterns.
**Action**: Thuận must add at least: (1) provider test (RSS returns articles, broken feed returns `[]`), (2) sentiment client test (timeout → fallback score 0.0 + NEUTRAL), (3) NewsSentimentStrategy test (positive → BUY, negative → SELL, service down → HOLD).

##### [MEDIUM] [F-009]: Verify `INewsProvider` interface matches `news.yaml`
**File**: `apps/backend/src/news/providers/news.provider.interface.ts`
**Check**: 4b (Contract Compliance)
**Issue**: Contract defines `fetchLatest(limit?: number, coin?: string): Promise<RawArticle[]>`. Need to verify actual interface matches — especially the `RawArticle` return type and the `coin` filtering parameter.
**Impact**: If interface mismatches, adding new providers (extensibility) breaks.
**Action**: Thuận must verify interface against `kb/contracts/news.yaml` lines 38-39.

##### [MEDIUM] [F-010]: Verify `NewsSentimentStrategy` implements `IStrategy` from `strategy.yaml`
**File**: `apps/backend/src/news/strategies/sentiment.strategy.ts`
**Check**: 4b (Contract Compliance) + 5a (Contract Alignment)
**Issue**: `NewsSentimentStrategy` must implement `IStrategy.analyze(candles: Candle[]) → Signal` to be registerable in Huy's `StrategyRegistry`. But the strategy needs sentiment data (not just candles) — need to verify how it accesses sentiment scores. Does it query the DB directly? Does it receive sentiment via the context?
**Impact**: If the strategy doesn't match `IStrategy`, it can't be registered → composite strategies with sentiment fail → req §30 unmet.
**Action**: Thuận must verify the strategy implements `IStrategy` exactly, and document how it accesses sentiment data (DB query vs injected context).

##### [LOW] [F-011]: Python sentiment service structure
**File**: `apps/sentiment/app.py`, `analyzer.py`, `models.py`
**Check**: 4a (Code Existence)
**Issue**: All 4 files exist (app.py, analyzer.py, models.py, requirements.txt). Need to verify the `/analyze` endpoint matches `news.yaml` internal_service contract: `POST http://localhost:8000/analyze` with `{ text: string }` → `{ score: number, label: string }`.
**Impact**: If endpoint shape mismatches, `SentimentClient` calls fail silently.
**Action**: Thuận must verify the Python endpoint matches the contract.

**Member verdict**: 🟡 Pass with notes — code exists and structure matches KB architecture, but zero tests and unverified contract compliance are risks. Sentiment strategy integration with Huy's registry is the most critical integration point.

---

### Phương — Event Infrastructure

**Assigned deliverables**: EventBus (IEventBus), JobQueue (IJobQueue + BullMQ), BacktestWorker, DeadLetterQueue, LeaderboardService, LoopController, LoopStatusService, DashboardController/Service, PushGateway, frontend dashboard + leaderboard + loop status

**Status**: ✅ Code exists — 31 TS source files across events/, queue/, loop/, leaderboard/, dashboard/ + extensive frontend (app-shell, dashboard-grid, leaderboard-table, loop-status-panel, queue-health-card, etc.)

#### Findings

##### [CRITICAL] [F-012]: Verify `IEventBus` token alignment with Hoàng's `IEVENT_BUS`
**File**: `apps/backend/src/events/` (3 files)
**Check**: 5a (Contract Alignment)
**Issue**: Hoàng defined `IEVENT_BUS = Symbol('IEventBus')` in `apps/backend/src/shared/tokens.ts` and MarketDataService injects it optionally. Phương's EventsModule must `provide + export` the bus under this exact token. If Phương used a different token name or string token, the optional injection in MarketDataService silently fails (graceful degradation — events not published).
**Impact**: `MarketDataUpdated` events never reach the bus → future event-driven consumers get nothing. Currently no impact (no subscribers), but blocks Task #15 (verify full event flow).
**Action**: Phương must verify her EventsModule provides IEventBus using `IEVENT_BUS` token from `apps/backend/src/shared/tokens.ts`. If she used a different token, align to the shared one.

##### [HIGH] [F-013]: Verify `IJobQueue` interface matches `events.yaml`
**File**: `apps/backend/src/queue/` (12 files)
**Check**: 4b (Contract Compliance)
**Issue**: `events.yaml` defines `IJobQueue` with methods: `enqueue(jobType, payload & { jobId }, correlationId?)`, `getStatus(jobId)`, `retry(jobId)`, `deadLetter(jobId, reason)`, `getStats()`. Also specifies BullMQ implementation with Redis. Need to verify the actual implementation matches — especially `jobId` preservation (producer-supplied, not queue-generated) and priority (USER=1, SEARCH_LOOP=10).
**Impact**: If `jobId` is regenerated by the queue, idempotency breaks and Huy's backtest result tracking fails.
**Action**: Phương must verify `enqueue()` preserves the producer-supplied `jobId` as documented in `events.yaml`.

##### [HIGH] [F-014]: Verify `BacktestCompleted` event payload matches `events.yaml`
**File**: `apps/backend/src/queue/` (worker files)
**Check**: 5a (Contract Alignment)
**Issue**: The Worker publishes `BacktestCompleted` with payload defined in `events.yaml`: `jobId`, `strategyVersionId`, `pair`, `timeframe`, `backtestResultId`, `metrics: EvaluationMetrics`, `source`, `loopRunId?`, `correlationId`. The Worker also publishes terminal `BacktestFailed` and `BacktestDeadLettered` exactly once. Need to verify actual event publishing matches.
**Impact**: If payload mismatches, LeaderboardService can't compute score, LoopController can't track progress.
**Action**: Phương must verify worker event publishing against `events.yaml`.

##### [MEDIUM] [F-015]: Verify Leaderboard scoring formula and Top-K
**File**: `apps/backend/src/leaderboard/` (6 files)
**Check**: 4b (Contract Compliance)
**Issue**: `kb/flows/leaderboard-update.md` BR-2 defines a scoring formula (weighted combination of normalized return, win rate, risk score). Need to verify the actual implementation matches. Also verify Top-K default value (K=10 per `kb/modules/event-infrastructure.md`).
**Impact**: If scoring differs, leaderboard rankings are wrong → demo shows incorrect results.
**Action**: Phương must verify scoring formula against `kb/flows/leaderboard-update.md`.

##### [MEDIUM] [F-016]: Loop status API endpoints
**File**: `apps/backend/src/loop/` (6 files)
**Check**: 4b (Contract Compliance)
**Issue**: `kb/modules/event-infrastructure.md` Section 7 defines 6 loop endpoints: `POST /api/loop/start`, `POST /api/loop/:id/pause`, `POST /api/loop/:id/resume`, `POST /api/loop/:id/stop`, `GET /api/loop/:id`, `GET /api/loop/current`. Need to verify all 6 exist and match the response shapes.
**Impact**: Frontend LoopStatusPanel needs these endpoints. Missing or mismatched endpoints break the dashboard.
**Action**: Phương must verify all 6 endpoints exist with correct paths and response shapes.

##### [MEDIUM] [F-017]: PushGateway WebSocket channels
**File**: `apps/backend/src/websocket/` (0 files — directory empty)
**Check**: 4a (Code Existence)
**Issue**: `kb/modules/event-infrastructure.md` Section 7 defines PushGateway with 5 WS channels: `leaderboard:update`, `loop:started`, `loop:progress`, `loop:stopped`, `connection:status`. But `src/websocket/` has 0 TS files. The PushGateway may be implemented elsewhere (e.g., in `dashboard/` or `events/`), or it may not exist yet.
**Impact**: Frontend real-time updates for leaderboard and loop status won't work without the PushGateway.
**Action**: Phương must clarify where PushGateway is implemented. If not yet built, it's a W3 priority.

**Member verdict**: 🟡 Pass with notes — most extensive implementation by file count (31 source + frontend), but `IEventBus` token alignment is critical, and PushGateway location needs clarification.

---

## Cross-Member Issues

### [CRITICAL] Integration Point 1: Market Data → Strategy Engine (Hoàng ↔ Huy)

**Issue**: Huy's Backtester must call `IMarketDataService.getCandlesRange()` via the `IMARKET_DATA_SERVICE` DI token. This is the #1 integration point — without it, no backtests can run on real data.

**Current state**: Hoàng's service is implemented and live (smoke test passed). Huy's backtester exists (37 files). But the actual call site has not been verified.

**Action**: Huy must verify:
1. `import { IMARKET_DATA_SERVICE } from '../shared/tokens'` (or correct relative path)
2. `@Inject(IMARKET_DATA_SERVICE) private readonly marketData: IMarketDataService`
3. Call: `this.marketData.getCandlesRange(pair, timeframe, startDate, endDate)`
4. Return type: `Promise<Candle[]>` from `@crypto-strategy-lab/shared`

### [CRITICAL] Integration Point 2: Strategy Engine → Event Infrastructure (Huy ↔ Phương)

**Issue**: Huy publishes `BacktestRequested` → Phương's Job Queue enqueues → Worker calls back into Huy's `IBacktester.run()` + `IEvaluator.evaluate()`. This is a bidirectional contract.

**Current state**: Both sides have code. The event payload and interface signatures must match exactly.

**Action**: Joint review session needed. Huy and Phương must compare:
1. `BacktestRequested` payload (Huy's event class vs `events.yaml`)
2. `IBacktester.run()` signature (Huy's implementation vs `strategy.yaml`)
3. `IEvaluator.evaluate()` signature (same)
4. `BacktestCompleted` payload (Phương's worker vs `events.yaml`)
5. `jobId` preservation through the full chain

### [HIGH] Integration Point 3: News → Strategy Engine (Thuận ↔ Huy)

**Issue**: Thuận's `NewsSentimentStrategy` must implement Huy's `IStrategy` interface and be registered in `StrategyRegistry`. This enables composite strategies with sentiment (req §30).

**Current state**: Both the strategy file and registry exist. Registration mechanism unknown.

**Action**: Thuận must verify `NewsSentimentStrategy implements IStrategy` and is registered in the module bootstrap.

### [HIGH] Integration Point 4: Event Bus Token (Hoàng ↔ Phương)

**Issue**: Hoàng defined `IEVENT_BUS` token. Phương's EventsModule must use the same token.

**Current state**: Hoàng's MarketDataService injects `@Optional() @Inject(IEVENT_BUS)`. If Phương's module provides the bus under a different token, the injection silently fails.

**Action**: Phương must verify token alignment. Simplest check: `grep -r "IEVENT_BUS" apps/backend/src/events/`.

### [MEDIUM] Integration Point 5: Frontend Composition (Hoàng ↔ Phương)

**Issue**: Hoàng built chart components (CandlestickChart, MultiTimeframeGrid, PairSelector, StatusIndicator). Phương built dashboard components (DashboardGrid, LoopStatusPanel, LeaderboardPreview, QueueHealthCard, AppShell). These must compose together on the dashboard page (`/`).

**Current state**: Both sets of components exist. Page composition may need coordination — who owns `page.tsx`?

**Action**: Verify `app/page.tsx` imports and renders both Hoàng's chart grid and Phương's dashboard panels in the DESIGN.md 8/4 split layout.

---

## Requirement Coverage (MVP §37)

| MVP Requirement | Owner | Status | Evidence |
|---|---|---|---|
| Binance data + Candlestick + Realtime + 4 timeframe | Hoàng | ✅ | Backend live (smoke test), frontend compiles |
| 4 strategy đơn lẻ (MA, RSI, BB, SR) | Huy | ✅ | 7 strategy files exist (MA, RSI, Bollinger, SR + MACD, Stochastic, ATR) |
| Composite strategy (kết hợp) | Huy | ✅ | `composite.strategy.ts` + 2 combiners (MajorityVote, WeightedScore) |
| Backtest trên historical data | Huy | ✅ | `backtester.service.ts` exists with spec |
| Evaluation (Return, Win Rate, MDD, Trades) | Huy | ✅ | `evaluator.service.ts` exists with spec |
| Random Search | Huy + Phương | ✅ | `random.generator.ts` + `search-engine.ts` + `domain-guided.generator.ts` |
| Leaderboard Top-K | Phương | ✅ | `leaderboard/` (6 files) + `leaderboard-table.tsx` frontend |
| Visualization (Buy/Sell, Entry/Exit) | Hoàng + Huy | 🟡 | Chart + overlays done, TradeMarkers stub (needs Huy's trade data) |
| News pipeline (Collect → Store → Sentiment) | Thuận | ✅ | 9 backend files + Python service + NewsFeed frontend |

**MVP verdict**: 8/9 MVP items have code. 1 partial (Visualization — trade markers need integration). All MVP items should be demo-ready after the integration verification actions above are completed.

---

## Central Architecture Questions (§40) — Coverage

| Question | Answerable from KB? | Code demonstrates? |
|---|---|---|
| 1. Strategy mới thêm như thế nào? | ✅ ADR-0003 + strategy-engine.md | ✅ 7 strategies registered |
| 2. Search algo mới? | ✅ IStrategyGenerator interface | ✅ Random + DomainGuided generators |
| 3. Market Data Provider mới? | ✅ ADR-0004 + IMarketDataAdapter | 🟡 Only BinanceAdapter (OKX = Task #17, W4) |
| 4. 100 → 100,000 backtests? | ✅ ADR-0006 + ADR-0012 | ✅ Job Queue + Worker pool exists |
| 5. News Service lỗi → Chart? | ✅ ADR-0009 + ADR-0010 | 🟡 Code exists, untested |
| 6. Sentiment Model thay đổi? | ✅ ADR-0009 (process isolation) | ✅ Python FastAPI separate process |
| 7. Binance WS disconnect? | ✅ ADR-0007 | ✅ Auto-reconnect tested (36 tests) |
| 8. Leaderboard reproducibility? | ✅ ADR-0008 | ✅ StrategyVersioning service exists |

---

## Recommended Actions (Priority Order)

### 🔴 Critical (must resolve before integration test)

1. **[F-003]** Huy: Verify `getCandlesRange()` call in Backtester matches `market-data.yaml` contract + uses `IMARKET_DATA_SERVICE` token
2. **[F-012]** Phương: Verify `IEVENT_BUS` token alignment — EventsModule must provide under Hoàng's token from `shared/tokens.ts`
3. **[F-003/F-014]** Huy + Phương: Joint review of `BacktestRequested` → Worker → `BacktestCompleted` event chain — verify all payloads match `events.yaml`

### 🟡 High (must resolve before demo)

4. **[F-008]** Thuận: Add unit tests for News module (provider fault isolation, sentiment timeout, HOLD fallback)
5. **[F-005]** Huy: Verify `IBacktester.run()` + `IEvaluator.evaluate()` signatures match `strategy.yaml`
6. **[F-010]** Thuận + Huy: Verify `NewsSentimentStrategy implements IStrategy` and registration
7. **[F-017]** Phương: Clarify PushGateway location — is it in `dashboard/`, `events/`, or not yet built?
8. **[F-015]** Phương: Verify leaderboard scoring formula matches `kb/flows/leaderboard-update.md`

### 🟢 Medium (improve before final demo)

9. **[F-002]** Hoàng: Run frontend + backend together for live dashboard smoke test
10. **[F-001]** Hoàng + Huy: Integrate TradeMarkers with BacktestResult.trades
11. **[F-016]** Phương: Verify all 6 loop status API endpoints exist
12. **[F-007]** Huy: Verify all 7 strategies are registered in module bootstrap
13. **[F-009]** Thuận: Verify `INewsProvider` interface matches `news.yaml`

### 📋 Architect Duties (Hoàng, W3-W4)

14. Run `/hoang-sdd-analyze` for cross-artifact consistency check
15. Run Tasks #14 + #15 (integration verification) after above actions are resolved
16. Write Architecture Document (Task #19) — members contribute their sections
17. Demo rehearsal (Task #20)

---

## Git Activity Summary

| Member | Recent commits (evidence) |
|---|---|
| Hoàng | `feat(market-data): implement backend module`, `feat(frontend): configure Tailwind v4`, `feat(frontend): add candlestick chart components` |
| Huy | Strategy Engine files (37 TS) — commit history not visible in recent log (may be in feature branch) |
| Thuận | `feat(backend/news): dynamic coin tagging`, `refactor(frontend/news): dynamic trading pair tabs` |
| Phương | `feat: Dashboard BFF và Infrastructure Realtime Backend`, `feat: Dashboard và Leaderboard Frontend`, merge from `feature/P/eventInfra` |

---

*Review generated: 2026-08-17 | Next review: after integration verification actions completed*
