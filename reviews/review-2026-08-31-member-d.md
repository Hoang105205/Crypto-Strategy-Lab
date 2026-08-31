# E2E Project Review — Member D — 2026-08-31

**Reviewer**: Hoàng (Architect review workflow)
**Member**: Phương (Member D)
**Module**: Event Infrastructure + Dashboard
**Mode**: Full review (KB + SDD + backend + frontend + operational handoff)
**Reviewed state**: Current working tree on 2026-08-31, including uncommitted leaderboard/backtester/Search Loop changes
**Overall Health**: 🟡 Needs Attention

## Executive Verdict

Member D has delivered most of the functional scope: typed Event Bus, BullMQ queue, worker pipeline, DLQ audit/retry, viewer-scoped leaderboard, safe realtime invalidation, bounded Search Loop, persistent 24/7 supervisor, Dashboard BFF, and tested frontend live state. The architecture is substantially stronger than the 2026-08-19 review and the original A7/A8 privacy findings are largely resolved.

The work is not ready for final sign-off yet. One critical authorization defect allows anonymous callers to mutate the global Search Loop through legacy lifecycle endpoints. There are also high-impact reliability/scalability gaps around fire-and-forget process-local completion events, an integration-test regression introduced by the desired-state configuration dependency, Redis persistence documentation that does not match Compose, and incomplete release gates.

**Member verdict**: **Needs revision before course demo/final architecture review**.

## Assignment Map

| Area | Assigned deliverables | Current status |
|---|---|---|
| KB | `kb/DESIGN.md`, `kb/contracts/events.yaml`, `kb/modules/event-infrastructure.md`, Search Loop and Leaderboard flows | All exist; architecture/flows strong, DESIGN and ranking text need cleanup |
| ADR | ADR-0005, 0006, 0011, 0012; later ADR-0013, 0017, 0018 | All exist and have real decisions; operational delivery does not fully meet ADR-0013 |
| Backend | `events/`, `queue/`, `leaderboard/`, `loop/`, `dashboard/` | Broadly implemented; security, durability, DI/test, lint, and scale gaps remain |
| Frontend | App shell, Dashboard, Leaderboard, realtime/live state, common states | Functional with strong unit coverage; full lint and final E2E/manual gates remain red/open |
| W4 handoff | README, Compose reliability, full validation, demo/quickstart | Partial/incomplete |

## What Is Done Well

- The module boundary uses shared interfaces/tokens rather than importing Strategy/Market Data implementation services into business code. Cross-module module imports are composition roots, not direct domain calls.
- Queue producers await durable BullMQ acceptance before publishing observational `BacktestRequested`, avoiding false `202 Accepted` responses.
- Backtest result ownership propagates to leaderboard rows; viewer visibility is applied before ranking and Top-K.
- Namespace-wide `leaderboard:update` contains only the system projection and is treated by the frontend as invalidation followed by scoped REST.
- Search Loop state is global rather than per-user; browser Live ON/OFF no longer controls the backend loop.
- The 24/7 supervisor now has persisted desired state, a PostgreSQL lease, bounded successor runs, retry backoff, restart orphan handling, one-time environment seeding, transition logs, and graceful lease release.
- The frontend provider has unusually strong race/privacy coverage: identity generation, aborts, viewer-stamped cache, exact listener cleanup, off-route reconciliation, and default-OFF persistence.
- Current verification: frontend Vitest passed **19/19 files, 89/89 tests**; frontend production build passed; backend production build passed.

## Findings

### [CRITICAL] [D-001]: Anonymous callers can mutate the global Search Loop

**Files**:
- `workspace/apps/backend/src/auth/supabase-jwt.guard.ts:10-17, 25-28`
- `workspace/apps/backend/src/loop/loop.controller.ts:77-117`
- `workspace/apps/backend/src/loop/loop.controller.ts:53-72`
- `kb/ADR/0017-persistent-supervisor-for-24-7-search-loop.md:38`

**Checks**: 4b Contract Compliance, 4e Error/Security Handling, requirement §23-24, global-loop ownership

**Issue**: `SupabaseJwtGuard` is explicitly optional authentication and returns `true` for requests without a bearer token. The legacy `POST /api/loop/start`, pause, resume, and stop routes have no `RequireAuth`, so an anonymous caller can start, pause, resume, or stop the one global system process. The control enable/disable/config routes use `RequireAuth`, but any logged-in user can still mutate system-wide desired state because no admin/operator role exists.

**Impact**: An unauthenticated client can disrupt the 24/7 search workload. This contradicts the system-owned lifecycle documented by ADR-0017 and can directly break the demo.

**Action**: Immediately protect every lifecycle mutation with an operator authorization boundary. At minimum add `RequireAuth` to compatibility commands; preferred final design is an admin/operator guard or removal of normal public lifecycle commands. Add anonymous, ordinary-user, and operator authorization tests.

### [HIGH] [D-002]: Durable BullMQ completion can be lost before Leaderboard/Loop observers finish

**Files**:
- `workspace/apps/backend/src/events/event-bus.ts:18-32, 35-51`
- `workspace/apps/backend/src/queue/backtest.worker.ts:170-178`
- `workspace/apps/backend/src/leaderboard/leaderboard.service.ts:121-177`
- `workspace/apps/backend/src/queue/bullmq-worker.host.ts:20-31`
- `kb/flows/leaderboard-update.md:80-83`
- `kb/flows/strategy-search-loop.md:67-71`

**Checks**: 4c Event/Observer implementation, 4e reliability, 4f scalability, requirements §32.2/32.5/32.7/34/43

**Issue**: `EventBus.publish()` calls EventEmitter2 synchronously but deliberately does not await async handlers; it catches them through `void handling.catch(...)`. Therefore BullMQ can mark a job complete immediately after the event is emitted while the Leaderboard and Loop database side effects are still running. A backend crash in that window permanently loses those projections/progress because the completed job is not retried and startup reconciliation only removes invalid leaderboard entries—it does not reconstruct missing ones. The same process-local bus prevents a separate worker process from delivering completion events to API-process observers.

**Impact**: A successful backtest may exist without appearing in the Leaderboard or advancing the Loop. Horizontal worker scaling—the central 100→100,000 scenario—cannot currently be demonstrated honestly.

**Action**: Implement the worker-process migration decision in `docs/worker-process-migration-SA.md`: use a cross-process durable event/outbox-inbox path or publish completion through Redis Streams/PubSub with durable recovery semantics. At minimum add a database reconciliation path that creates missing leaderboard projections and reconciles loop candidates from persisted results.

### [HIGH] [D-003]: Desired-state change broke LoopModule integration/module-boot suites

**Files**:
- `workspace/apps/backend/src/loop/search-loop-supervisor.service.ts:32-42`
- `workspace/apps/backend/src/loop/loop.module.ts:33-41`
- `workspace/apps/backend/src/app.module.ts:20-22`
- `workspace/apps/backend/src/loop/loop.module.spec.ts:150-152`
- `workspace/apps/backend/src/loop/loop.integration.spec.ts:566-568`

**Checks**: 4a module boot, 4d modularity, W4 validation gate

**Issue**: `SearchLoopSupervisorService` now injects `ConfigService`, but `LoopModule` does not declare/import the configuration dependency. Production root boot succeeds only because `AppModule` installs `ConfigModule` globally. Isolated module/integration harnesses cannot resolve the dependency.

**Observed evidence**: Review command `jest --runInBand leaderboard loop dashboard events` produced **18 passing suites, 2 failing suites; 286 passing tests, 21 failing tests**. All failures were dependency-resolution failures for `ConfigService` in `SearchLoopSupervisorService`.

**Impact**: The Loop module is no longer independently bootable under its existing contract, and the backend cross-cutting test gate is red. Logic tests that mock the supervisor alone gave a false-green result.

**Action**: Make the dependency explicit in `LoopModule` or inject a dedicated configuration token/provider that the module owns. Update both module-boot and integration harnesses, then rerun the complete Loop matrix.

### [HIGH] [D-004]: Redis AOF/reliability claims do not match Docker Compose or README

**Files**:
- `workspace/docker-compose.yml:5-13`
- `workspace/README.md:83-93`
- `kb/contracts/events.yaml:186-187`
- `kb/ADR/0013-adopt-bullmq-redis-for-backtest-jobs.md:50-58`
- `sdd_artifacts/event-infrastructure-dashboard/tasks.md:140-141`

**Checks**: 3e cross-reference integrity, 4e restart reliability, W4 handoff

**Issue**: The contract, ADR, module KB, and README claim Redis AOF persistence, but Compose starts plain `redis:7-alpine` with only a volume; there is no `--appendonly yes`, Redis config, or healthcheck. README also says Compose starts PostgreSQL + Redis even though the current Compose file contains Redis only and the project uses hosted Supabase PostgreSQL.

**Impact**: The documented restart/durability guarantee is unproven and potentially false. Setup instructions can confuse graders or fail during demo recovery.

**Action**: Complete T049: enable and verify AOF/healthcheck, or downgrade all claims to the actual configuration. Correct README infrastructure steps and document Supabase versus local dependencies.

### [HIGH] [D-005]: Release-quality gates remain incomplete and current lint is red

**Files**:
- `sdd_artifacts/event-infrastructure-dashboard/tasks.md:138-141`
- `sdd_artifacts/event-infrastructure-dashboard/validation.md:970-1073`
- `sdd_artifacts/per-user-leaderboard-live-toggle/tasks.md:110-111`
- `sdd_artifacts/split-leaderboard-boxes/tasks.md:112-130`

**Checks**: Phase 4 W4 validation, Constitution quality gates

**Issue**: Event Infrastructure T046-T049 remain unchecked; per-user feature full E2E/manual tasks T041-T042 remain unchecked; split-leaderboard T035-T044 remain unchecked. Current non-mutating lint review found:

- Full backend: **855 errors, 85 warnings** across all owners.
- Member-D backend production directories: **38 errors**, including **10 non-Prettier semantic errors**.
- Member-D backend production + specs: **417 errors, 51 warnings**.
- Frontend full lint: **6 errors, 1 warning** across Strategy/News/shared trade UI; Member-D frontend tests/build still passed.

**Impact**: The repository is not at the plan's W4 “all contracts/gates green” state. Unfinished E2E/manual matrices leave privacy, reconnect, mobile, restart, outage, and operational claims without current end-to-end evidence.

**Action**: First fix D-001 and D-003, then close feature-owned production lint and coordinate cross-owner lint debt. Execute the checked-in backend/frontend E2E and quickstart matrices and record fresh evidence instead of relying on the 18/08 validation snapshot.

### [MEDIUM] [D-006]: Leaderboard detail and cleanup still scale in Node, and KB describes obsolete reranking

**Files**:
- `workspace/apps/backend/src/leaderboard/leaderboard.repository.ts:128-143`
- `workspace/apps/backend/src/leaderboard/leaderboard.service.ts:97-116`
- `kb/modules/event-infrastructure.md:120, 287, 341, 351`
- `kb/flows/leaderboard-update.md:94-96`
- `workspace/apps/backend/prisma/schema.prisma:151-173`

**Checks**: 3e KB/code consistency, 4b data contract, 4f scalability

**Issue**: Main Top-K now uses bounded SQL and no longer rewrites all ranks after insert, which is a strong improvement. However, `findBestByStrategyVersionId()` still loads every visible leaderboard row and ranks it in Node to answer one detail request. Orphan cleanup loads every reference and makes one port lookup per row. The Prisma `rank` column remains required and receives placeholder `0`, while several KB sections still say survivors are persisted/reranked after cleanup.

**Impact**: Detail/cleanup paths degrade with 10,000-100,000 candidates, and documentation teaches a ranking behavior the implementation intentionally removed.

**Action**: Move detail rank/best-version selection to SQL; page/batch reconciliation; document `rank` as legacy or remove it in an approved migration; update ADR-0011/module/flow text from write-time reranking to read-time projection.

### [MEDIUM] [D-007]: DLQ contract overstates atomicity and does not match implementation calls

**Files**:
- `kb/contracts/events.yaml:154-178`
- `workspace/apps/backend/src/queue/backtest.worker.ts:217-251`
- `workspace/apps/backend/src/queue/dead-letter.repository.ts:76-104`
- `workspace/apps/backend/src/queue/queue.controller.ts:48-50`

**Checks**: 3d contract quality, 4b contract compliance, 4e failure handling

**Issue**: The contract says terminal paths call `IJobQueue.deadLetter()` and manual retry atomically resets Redis while resolving PostgreSQL. Production worker instead mutates BullMQ job data directly and calls `DeadLetterRepository.mirror()`. Manual recovery performs a Redis retry inside a Prisma transaction, which can roll back DB when Redis fails but cannot atomically roll back Redis if the later DB commit fails.

**Impact**: Contracts overpromise cross-store atomicity. A failure between Redis metadata, PostgreSQL mirror, event publication, or transaction commit can leave audit and queue state divergent.

**Action**: Document saga/compensation semantics rather than atomicity, or introduce an outbox/reconciliation mechanism. Align `events.yaml` method descriptions with the actual adapter/repository boundary and add injected-failure tests at each boundary.

### [MEDIUM] [D-008]: DESIGN.md is mostly a Binance site extraction rather than a focused project design contract

**Files**:
- `kb/DESIGN.md:1-5`
- `kb/DESIGN.md:339-351`
- `kb/DESIGN.md:399-433`
- `kb/DESIGN.md:494-570`
- `kb/DESIGN.md:714-721`

**Checks**: 3c content quality, 3f plan alignment, W4 design handoff

**Issue**: The document is named `Binance-design-analysis`, mandates proprietary BinanceNova/BinancePlex fonts, and spends substantial space on unrelated marketing, Buy Crypto, deposit, futures arena, SAFU, FAQ, footer, and cookie components. The project-specific Dashboard/Leaderboard content is useful but buried after hundreds of lines. The app also currently builds both `/strategies` and legacy `/strategy`, while DESIGN declares `/strategies` canonical without documenting redirect/removal.

**Impact**: The design SSoT is noisy and can mislead implementation/interview explanations. Proprietary typography claims are not backed by local assets.

**Action**: Reduce DESIGN.md to Crypto Strategy Lab routes/components/tokens, use available/open fonts, explicitly resolve the duplicate Strategy route, and move visual inspiration notes to a non-authoritative reference appendix if desired.

## Cross-Member / Dependency Notes

- Backend-wide lint debt is not solely Member D's responsibility; Auth, Strategy, Market Data, and News files contribute heavily. Member D still owns 38 production-directory errors and should not mark T046 complete until its own portion is clean.
- `LoopModule` imports Strategy/Queue modules at the Nest composition boundary. No direct Strategy implementation or cross-module Prisma delegate was found in Event Infrastructure business services; this is a pass, not a boundary violation.
- Frontend lint failures observed during this review are currently outside the primary Member-D files, but they still block the repository-level W4 gate and require team coordination.
- The current working tree contains uncommitted architecture/performance changes. Final review evidence should be rerun after those changes are committed or deliberately reverted.

## Requirement Coverage

| Requirement | Status | Assessment |
|---|---|---|
| §21-22 Leaderboard / Top-K | 🟢 Mostly covered | Observer, scoring, scoped Top-K, sorting and realtime exist; detail/cleanup scaling and stale KB remain |
| §23-24 Continuous Loop | 🟡 Partial | Bounded runs + 24/7 supervisor are strong; anonymous lifecycle mutation and current DI test regression block sign-off |
| §32.2 / §43 Scalability | 🟡 Partial | BullMQ and SQL Top-K improve scale; worker remains in-process and completion bus remains process-local |
| §32.5 Performance | 🟢 Mostly covered | Queue concurrency, user priority, read-time Top-K, incremental backtester work exist; non-Top-K paths still need work |
| §32.7 Observability | 🟢 Covered for MVP | Queue stats, loop status, progress events, retry/lease state are exposed |
| §34 Events | 🟡 Partial | Typed contracts and decoupling are strong; completion delivery is not durable/replayable |
| §37 MVP | 🟢 Functional coverage | Required Leaderboard/Search/Backtest infrastructure exists; final release evidence remains incomplete |
| §44 Anti-patterns | 🟢 Pass | No God Service, frontend ranking, hard-coded strategy dispatch, or cross-module DB access found in Member-D core |

## Verification Performed During Review

| Command/gate | Result |
|---|---|
| Backend targeted `leaderboard loop dashboard events` Jest | **FAIL** — 18/20 suites pass; 286/307 tests pass; 21 ConfigService DI failures |
| Backend production build | **PASS** |
| Frontend Vitest | **PASS** — 19/19 files, 89/89 tests |
| Frontend production build | **PASS** — 10 static pages generated |
| Backend full non-mutating ESLint | **FAIL** — 855 errors, 85 warnings |
| Member-D backend production ESLint scope | **FAIL** — 38 errors, 0 warnings; 10 non-formatting errors |
| Frontend ESLint | **FAIL** — 6 errors, 1 warning |

## Recommended Actions — Priority Order

1. **Block anonymous/global lifecycle mutation** and define operator/admin authorization.
2. **Repair LoopModule configuration DI** and rerun all Loop integration/module-boot suites.
3. **Make completion delivery recoverable/cross-process** before claiming 100k horizontal worker scalability.
4. **Align Redis Compose with ADR/README**: AOF, healthcheck, restart/outage proof, correct Supabase setup text.
5. **Close release gates**: Member-D lint, backend/frontend E2E, quickstart/manual matrices, dirty-tree reconciliation.
6. **Finish leaderboard read-time-ranking convergence** for detail/cleanup and update stale KB/rank schema language.
7. **Correct DLQ atomicity contract** and add failure-window reconciliation/tests.
8. **Refocus DESIGN.md** on the actual Crypto Strategy Lab application.

## Final Sign-off Condition

Member D can move from 🟡 to 🟢 when D-001 through D-005 are resolved and verified with fresh full backend/frontend gates. D-006 through D-008 should be addressed before the final report/interview, but they do not individually prevent an MVP demo once the critical/high items are closed.
