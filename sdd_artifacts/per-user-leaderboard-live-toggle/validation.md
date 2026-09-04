# Validation: Per-user Leaderboard and Live Toggle

## Phase 7 partial gate — T035-T038 (2026-08-24)

**Scope**: T035-T038 only. T039-T042 were not run or marked complete.

### T035 backend E2E

Created `workspace/apps/backend/test/per-user-leaderboard.e2e-spec.ts` with a real Nest HTTP application and real Socket.IO namespace. Auth, Prisma, loop status, and Strategy result access use deterministic test doubles; production controllers, guard metadata, Leaderboard service/repository, Event Bus, and PushGateway remain in the exercised path.

Initial harness run was RED: exit `1`, `1/1` suite and `3/3` tests failed before execution because the root test module did not import the exported `IEVENT_BUS` provider. Importing the existing `EventsModule` fixed only the E2E wiring.

```powershell
npm.cmd run test:e2e -w @crypto-strategy-lab/backend -- --runInBand per-user-leaderboard.e2e-spec.ts
```

- Exit: `0`
- Suites: `1 passed / 1 total`
- Tests: `3 passed / 3 total`
- Evidence: anonymous is system-only; A is system+A; B is system+B; ranks are contiguous; Top-K and `updatedAt` are viewer-scoped; system detail is shared; own detail succeeds; anonymous/foreign/nonexistent detail share the stable 404; all actors observe the same global Loop; an actual namespace client receives only system rows and a null private trigger.

### T036 frontend Playwright E2E

Extended the existing infrastructure fixture only with deterministic test controls: current-session A/B/anonymous REST scopes, revisions, request audit, safe namespace-wide invalidation, transport closure/reconnect, and one delayed REST response. No production room, handshake, namespace, privacy filter, wire field, or auth behavior was added.

The first browser run was RED: exit `1`, `6/6` tests failed. It exposed test-harness ordering/cache issues: login inputs lacked associated labels, anonymous route prefetch was cached before the test cookie write, and old browser/cache owners interfered with restart measurements. The harness was corrected without weakening provider assertions or changing production code.

```powershell
npm.cmd run test:e2e -w @crypto-strategy-lab/frontend -- leaderboard.spec.ts
```

- Exit: `0`
- Tests: `6 passed / 6 total` on Chromium, one worker.
- The command's required Next production build also completed successfully; this is fixture startup for T036, not the standalone multi-package T039 build gate.
- Evidence: Dashboard -> News -> `/leaderboard` -> Dashboard keeps ON and one effective invalidation owner; one safe event produces exactly SCORE plus active-criterion REST requests; route changes cause no socket disconnect; explicit ON/OFF and accepted cache survive reload and a new browser context; OFF remains frozen; re-enable rejects an older delayed response; reconnect ON refetches and reconnect OFF does not; A->B clears A; A->anonymous stores system-only cache and rejects delayed A; no Loop lifecycle request is observed.
- The production middleware redirects anonymous protected pages to `/login`; anonymous provider/cache isolation is therefore asserted from the root provider on `/login`, while anonymous rendered-list isolation is proven by T035 backend E2E. No middleware/auth-semantic change was authorized in this phase.

### T037 targeted backend regression

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand leaderboard loop dashboard queue strategy/ports
```

- Exit: `0`
- Suites: `27 passed / 27 total`
- Tests: `347 passed / 347 total`
- Snapshots: `0`
- Non-blocking diagnostic: Jest reported open asynchronous handles after results, then exited `0` after cleanup.

### T038 targeted frontend regression

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/contexts/leaderboard-live-context.spec.tsx src/hooks/use-dashboard-summary.spec.tsx src/hooks/use-leaderboard.spec.tsx src/components/common/app-shell.spec.tsx src/app/page.spec.tsx src/components/dashboard/dashboard-grid.spec.tsx src/components/dashboard/leaderboard-preview.spec.tsx src/components/dashboard/loop-status-panel.spec.tsx src/services/infrastructure-socket.spec.ts src/hooks/use-infrastructure-socket.spec.tsx
```

- First sandbox attempt: exit `1` before test discovery because esbuild could not read/resolve `vitest.config.ts` (`Access is denied`); zero tests ran.
- Approved rerun outside that sandbox restriction: exit `0`.
- Test files: `10 passed / 10 total`.
- Tests: `43 passed / 43 total`.
- Evidence includes absent preference default OFF, ON/OFF/cache persistence, one exact handler while ON and zero while OFF, subscribe-before-refetch, SCORE+active criterion retention, route-child survival, reconnect ON/OFF, exact provider cleanup preserving foreign listeners and shared socket, zero page-level leaderboard listeners, A->B/A->anonymous render gating, abort/generation checks, and delayed-response rejection.

### Scope audit

- T034 was `[X]` before this phase and was the satisfied dependency for both E2E branches.
- T035 -> T037 and T036 -> T038 were followed; all four tasks now have GREEN evidence.
- T039-T042 remain `[ ]`; no release/full-suite/manual-quickstart phase was run.
- No backend production, frontend production, KB, database, Prisma migration, wire/auth contract, room, socket handshake, namespace, client privacy filter, shared disconnect, or per-user SearchLoopRun change was made.

## Phase 7 build/lint gate — T039-T040 (2026-08-24)

**Scope**: T039 and T040 only. T041-T042 were not run or marked complete.

### T039 TypeScript and production build — PASS

All commands ran from `workspace/`. T037 and T038 were already `[X]` before this gate.

```powershell
npm.cmd exec -- tsc --noEmit -p libs/shared/tsconfig.json
npm.cmd exec -- tsc --noEmit -p apps/backend/tsconfig.build.json
npm.cmd exec -- tsc --noEmit -p apps/frontend/tsconfig.json
```

- Shared TypeScript check: exit `0`, no diagnostics.
- Backend TypeScript check: exit `0`, no diagnostics. The first concurrent invocation exceeded the 30-second yield boundary without a final exit code, so the identical command was rerun directly and exited `0` in 9.9 seconds.
- Frontend TypeScript check: exit `0`, no diagnostics.

```powershell
npm.cmd run build
```

- Exit: `0`.
- Turborepo scope: `@crypto-strategy-lab/shared`, `@crypto-strategy-lab/backend`, and `@crypto-strategy-lab/frontend`.
- Result: `3 successful / 3 total`; shared `tsc`, backend `nest build`, and frontend `next build` all completed.
- Frontend routes `/`, `/leaderboard`, `/login`, `/news`, `/register`, `/strategies`, and `/strategy` were generated successfully.
- Non-blocking warning: Next.js 16.3 reports that the existing `middleware` convention is deprecated in favor of `proxy`. No migration/codemod was authorized or run.

T039 is marked `[X]` from this GREEN evidence.

### T040 configured lint/format and persistence audit — BLOCKED

The exact configured root lint script was run first:

```powershell
npm.cmd run lint
```

- Exit: `1`.
- Root script: `turbo lint`, covering the same three workspaces.
- Blocking configuration error: `@crypto-strategy-lab/shared` uses ESLint 9.39.5 but has no `eslint.config.js`, `.mjs`, or `.cjs`. ESLint exits code 2 for that workspace before the root gate can be green.
- Only backend and frontend currently contain `eslint.config.mjs`; no shared config exists.

Additional read-only/no-fix diagnostics isolated the remaining configured workspaces:

```powershell
npm.cmd run lint -w @crypto-strategy-lab/backend -- --no-fix
npm.cmd run lint -w @crypto-strategy-lab/frontend
```

- Backend exit: `1`; `1057` problems (`998` errors, `59` warnings). This includes broad pre-existing type-aware ESLint and Prettier findings across backend production/tests, not a bounded T039/T040 feature fix.
- Frontend exit: `1`; `8` problems (`5` errors, `3` warnings), located in existing `src/app/strategy/page.tsx`, `src/components/trade-detail-table.tsx`, and `src/middleware.ts`.
- The backend command explicitly appends `--no-fix` after the configured `--fix` to make this diagnostic non-mutating.

The backend package exposes only a write-mode `format` script, not a format-check script. The corresponding non-mutating check was run with the package's configured Prettier dependency and the same source/test globs:

```powershell
npm.cmd exec -- prettier --check "apps/backend/src/**/*.ts" "apps/backend/test/**/*.ts"
```

- Exit: `1`; style findings in `115` files.
- No `--write` run was performed because it would rewrite unrelated repository files.

#### Linter mutation/scope audit

- SHA-256 hashes were captured for every dirty workspace file immediately before `npm.cmd run lint` and again after all lint diagnostics.
- Every hash remained identical; the backend `--fix` process did not mutate a dirty file before Turbo stopped the failed root gate.
- `git status --short` contained no newly modified production, schema, migration, package, or configuration file after the checks.
- Therefore no unrelated linter rewrite needed removal, and all pre-existing user/worktree changes were preserved.

#### Prisma and global Search Loop audit

```powershell
git status --short -- workspace/apps/backend/prisma/schema.prisma workspace/apps/backend/prisma/migrations
git diff -- workspace/apps/backend/prisma/schema.prisma workspace/apps/backend/prisma/migrations
git diff --quiet -- workspace/apps/backend/prisma
```

- Status/diff output: empty; quiet diff exit `0`.
- Existing migration directories only: `20260810005335_init_market_data`, `20260811_event_infrastructure_dashboard`, `20260812135952_init`, and `20260816_backtest_result_job_id`. No feature migration was added.
- Parsed Prisma model blocks: `SearchLoopRun` found with `HAS_USER_ID=False`; `SearchLoopCandidate` found with `HAS_USER_ID=False`.
- Production Loop search finds `strategy-loop.service.ts` explicitly emitting SEARCH_LOOP work with `userId: null` and controller auth-context parameters that are not passed into persistence/service filtering. No viewer predicate, per-user active-loop rule, or per-user lifecycle was introduced.

T040 remains `[ ]`: the schema/global-loop audit passes, but the required lint/format quality gate is RED. Per dependency order, T041 and T042 were not run.

#### T040 convergence rerun — feature scope GREEN, root gate still RED

The convergence pass added `workspace/libs/shared/eslint.config.mjs`, using ESLint recommended plus type-checked TypeScript recommended rules. It does not disable strict type checking or contract rules; it ignores only generated `dist/**` output and its own config file. The shared package's existing lint script now runs successfully.

Initial exact-scope classification after the shared config was added:

- Shared package: exit `0`, zero findings.
- Cross-route frontend feature files: exit `0`, zero findings.
- The 26 backend files recorded as modified by this feature: exit `1`, `507` findings (`473` errors and `34` warnings); `367` errors were auto-fixable formatting/line-ending findings.

The backend `--fix` run was restricted to those 26 paths. Remaining strict errors were corrected without rule suppression: promise-returning fakes no longer use unnecessary `async`; thrown duplicate fixtures use `Error` objects with a Prisma-style code; response bodies and server addresses are explicitly typed; mock function properties avoid unbound-method ambiguity; and the global Loop controller explicitly consumes but does not delegate the auth-context parameter. No loop ownership/filtering behavior changed.

Final targeted lint commands/results:

```powershell
npm.cmd run lint -w @crypto-strategy-lab/shared
npm.cmd exec -w @crypto-strategy-lab/frontend -- eslint <15 exact cross-route feature files>
npm.cmd exec -- eslint <26 exact backend feature files>
```

- Shared: exit `0`, zero findings.
- Frontend feature files: exit `0`, zero findings.
- Backend feature files: exit `0`, `0` errors and `32` configured `no-unsafe-argument` warnings from Nest/Supertest test seams.
- No broad `eslint-disable`, rule downgrade, `--max-warnings` bypass, or lint-baseline file was introduced.

TypeScript and production build rerun:

```powershell
npm.cmd exec -- tsc --noEmit -p libs/shared/tsconfig.json
npm.cmd exec -- tsc --noEmit -p apps/backend/tsconfig.build.json
npm.cmd exec -- tsc --noEmit -p apps/frontend/tsconfig.json
npm.cmd run build
```

- All three TypeScript commands: exit `0`, no diagnostics.
- Production build: exit `0`, `3 successful / 3 total` packages.
- Existing non-blocking Next.js warning remains: `middleware` is deprecated in favor of `proxy`.

Focused regression evidence after lint corrections:

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand dashboard/dashboard.service.spec.ts leaderboard/leaderboard.controller.spec.ts leaderboard/leaderboard.integration.spec.ts leaderboard/leaderboard.repository.spec.ts leaderboard/leaderboard.service.spec.ts loop/loop.controller.spec.ts loop/loop.integration.spec.ts loop/loop.module.spec.ts loop/strategy-loop.service.spec.ts strategy/controllers/tests/strategy.controller.spec.ts strategy/ports/backtest-result.port.spec.ts
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand queue/backtest.worker.spec.ts -t copies
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand queue/backtest.worker.spec.ts -t normalizes
npm.cmd run test:e2e -w @crypto-strategy-lab/backend -- --runInBand per-user-leaderboard.e2e-spec.ts
```

- Non-Redis feature regression: exit `0`, `11/11` suites and `182/182` tests passed.
- Worker ownership: exit `0`, `2` selected tests passed (`10` skipped).
- Worker normalized-rate fixture: exit `0`, `1` selected test passed (`11` skipped).
- Per-user backend E2E: exit `0`, `1/1` suite and `3/3` tests passed.
- A broader targeted regression attempt produced `24` passing suites and `320` passing tests, but exited `1` because Redis 7 was not running: `4` Redis-backed suites/`34` tests failed only at their explicit infrastructure prerequisite. No assertion regression was observed.

Configured root gate rerun:

```powershell
npm.cmd run lint
```

- Exit: `1`; shared lint is now successful.
- Root failure is the existing frontend debt outside this feature: `5` errors and `3` warnings in `src/app/strategy/page.tsx`, `src/components/trade-detail-table.tsx`, and `src/middleware.ts`.
- The root task stopped the concurrent backend lint before completion. A separate non-mutating backend diagnostic (`npm.cmd run lint -w @crypto-strategy-lab/backend -- --no-fix`) reports `582` findings (`525` errors, `57` warnings), located outside the exact feature set except for the 32 allowed warnings already reported above.
- The configured backend Prettier-equivalent check exits `1` with `106` files, overwhelmingly in Auth, Market Data, News, Strategy, Queue infrastructure, and other pre-existing code. No write-mode whole-repository format was run.

Hash/status inspection before and after the exact root lint found identical SHA-256 values for every dirty file and no new path. Thus its backend `--fix` branch made no mutation before Turbo stopped. Prisma schema/migrations remain status/diff clean; `SearchLoopRun` and `SearchLoopCandidate` still contain no `userId`; SEARCH_LOOP production work still supplies explicit `userId: null`.

At the end of this convergence rerun, T040 remained `[ ]` under its then-current repository-wide wording. On 2026-08-24 the feature owner explicitly approved changing T040 to a feature-scoped quality gate. The root findings above remain recorded as separately owned repository debt and are not reclassified as feature findings; T040 still requires a fresh exact-scope lint/format rerun before it may be marked `[X]`.

#### T040 feature-scoped gate approval and final rerun — PASS

On 2026-08-24 the feature owner explicitly approved a feature-scoped quality gate so repository-wide debt owned by other modules/members does not block this feature. `plan.md`, `tasks.md`, and `quickstart.md` were synchronized with that decision. No lint rule, TypeScript strictness, contract, test, or release scenario was weakened.

The final owned set is the shared ESLint configuration plus 17 backend and 15 frontend cross-route/feature files listed by the rerun command. Cross-team Queue fixtures changed only for T034 nullable-user typed convergence remain covered by their targeted tests; unrelated pre-existing lint findings in the rest of those shared fixture files remain diagnostic debt rather than being silently reformatted or reclassified.

```powershell
npm.cmd exec -w @crypto-strategy-lab/shared -- eslint eslint.config.mjs
npm.cmd exec -w @crypto-strategy-lab/backend -- eslint <17 exact feature-owned backend paths>
npm.cmd exec -w @crypto-strategy-lab/frontend -- eslint <15 exact feature-owned frontend paths>
npm.cmd exec -- prettier --check <33 exact shared/backend/frontend feature paths>
```

- Shared lint: exit `0`; the config is intentionally ignored by its own generated-output/config ignore and reports one non-blocking ignored-file warning.
- Backend lint: exit `0`; `0` errors and the previously classified `32` configured `no-unsafe-argument` warnings at Nest/Supertest test seams.
- Frontend lint: exit `0`; zero findings.
- Initial non-mutating format check: exit `1`, identifying 20 exact feature paths. SHA-256/status were captured in the same command before a targeted `prettier --write`; exactly those 20 paths changed and `NEW_STATUS_LINES=0` proved no path outside the existing dirty set was introduced.
- Final non-mutating format check: exit `0`; all 33 paths use Prettier code style.
- `git diff --check`: exit `0`; only existing LF/CRLF conversion notices were printed.

The first broad exact-path discovery attempt was run from the monorepo root and exited `2` because ESLint 9 did not discover package-local flat configs; the corrected package-workspace commands above are the authoritative gate. A later intentionally broader task-reference diagnostic included shared Queue setup files and exited `1` with `48` errors in `queue.integration.spec.ts`; diff inspection showed the feature's T034 edits are limited to explicit UUID/null fixture convergence, while the remaining file-wide findings predate or fall outside this feature-owned scope.

Prisma/global-loop audit:

- `git diff --quiet -- workspace/apps/backend/prisma/schema.prisma workspace/apps/backend/prisma/migrations`: exit `0`.
- `SearchLoopRun`: found; `HAS_USER_ID=False`.
- `SearchLoopCandidate`: found; `HAS_USER_ID=False`.
- Production SEARCH_LOOP enqueue remains explicit `userId: null`.

T040 is now `[X]`. The feature-scoped quality gate is GREEN, the repository-wide diagnostic debt remains transparently recorded above, and T041 is unblocked.

## Phase 1 — Contract and Propagation Foundation

**Validated**: 2026-08-23
**Scope**: T001-T007 only. Phase 2 was not started.

### Revalidation after local `.env` update

Revalidated on 2026-08-23 after the user updated the backend/frontend local environment files. Secret values were not printed or recorded; only the presence of expected variable names was checked.

- Requirements checklist: `16 completed / 0 incomplete`.
- `npm.cmd run build -w @crypto-strategy-lab/shared`: exit `0`.
- Required six-suite backend gate: exit `0`; `6/6` suites and `82/82` tests passed.
- `npm.cmd exec -w @crypto-strategy-lab/backend -- tsc --noEmit -p tsconfig.build.json`: exit `0`, no diagnostics.
- No production, schema, migration, auth, SearchLoopRun, or SearchLoopCandidate change was needed during revalidation.

### Task evidence

| Task | Evidence | Result |
|---|---|---|
| T001 | Reviewed the focused YAML diff and ran `git diff --check`. `BacktestCompleted.userId` is explicitly required-nullable; namespace-wide `LeaderboardUpdated.topK` is system-only; its trigger is nullable; both feature contract documents are cross-referenced. | PASS |
| T002 | Ran the three focused `Phase 1 shared ownership contract` assertions before changing shared types. | RED as intended: exit 1; 3 suites failed, 3 tests failed because the three required shared fields were absent or non-nullable. |
| T003 | Built `@crypto-strategy-lab/shared`, then reran the same three focused assertions. | GREEN: build exit 0; 3 suites passed, 3 tests passed (32 unrelated tests skipped). |
| T004 | Ran worker and result-port tests matching `ownership` before implementation. | RED as intended: exit 1; 2 suites failed; 3 tests failed because worker save/completion omitted owner and idempotent port replay ignored an owner mismatch. The create/map cases for both UUID and null already passed because the port spreads the supplied input. |
| T005 | Reran the worker/result-port ownership tests after copying `payload.userId` and including owner in immutable replay identity. | GREEN: exit 0; 2 suites passed, 6 tests passed (14 unrelated tests skipped). |
| T006 | Ran the complete Strategy controller and Strategy loop service specs. | GREEN: exit 0; 2 suites passed, 37 tests passed. USER producer carries the authenticated UUID; SEARCH_LOOP enqueue/event carries explicit `null`. |
| T007 | Ran all required Phase 1 gate commands from `workspace/`. | GREEN; command-level evidence is recorded below. |

### T002 contract RED command

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand queue/backtest.worker.spec.ts leaderboard/leaderboard.repository.spec.ts dashboard/push.gateway.spec.ts -t "Phase 1 shared ownership contract"
```

- Exit: `1`
- Suites: `3 failed / 3 total`
- Tests: `3 failed / 35 total` (`32` skipped by the focused name filter)
- Intended failures: missing `BacktestCompletedPayload.userId`, missing `LeaderboardEntryPayload.userId`, and non-nullable `LeaderboardUpdatedPayload.triggeredByBacktestResultId` in shared source.

### T003 contract GREEN commands

```powershell
npm.cmd run build -w @crypto-strategy-lab/shared
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand queue/backtest.worker.spec.ts leaderboard/leaderboard.repository.spec.ts dashboard/push.gateway.spec.ts -t "Phase 1 shared ownership contract"
```

- Shared build: exit `0`
- Focused assertions: exit `0`; `3/3` suites passed; `3/3` selected tests passed.

### T004/T005 propagation RED-GREEN command

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand queue/backtest.worker.spec.ts strategy/ports/backtest-result.port.spec.ts -t ownership
```

- Before implementation: exit `1`; `2/2` suites failed; `3` failed and `3` passed selected tests.
- After implementation: exit `0`; `2/2` suites passed; `6/6` selected tests passed.

### T006 producer regression command

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand strategy/controllers/tests/strategy.controller.spec.ts loop/strategy-loop.service.spec.ts
```

- Exit: `0`
- Suites: `2 passed / 2 total`
- Tests: `37 passed / 37 total`

### Final Phase 1 gate

All commands ran with workdir `workspace/`.

```powershell
npm.cmd run build -w @crypto-strategy-lab/shared
```

- Exit: `0`
- Result: TypeScript shared build completed.

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand queue/backtest.worker.spec.ts strategy/ports/backtest-result.port.spec.ts strategy/controllers/tests/strategy.controller.spec.ts loop/strategy-loop.service.spec.ts leaderboard/leaderboard.repository.spec.ts dashboard/push.gateway.spec.ts
```

- Exit: `0`
- Suites: `6 passed / 6 total`
- Tests: `82 passed / 82 total`
- Snapshots: `0`

```powershell
npm.cmd exec -w @crypto-strategy-lab/backend -- tsc --noEmit -p tsconfig.build.json
```

- Exit: `0`
- Diagnostics: none.

### Prerequisites and deviations

- Installed dependencies from the existing `workspace/package-lock.json` because `@supabase/supabase-js` was declared but absent from `node_modules`; no manifest or lockfile change was introduced.
- Started the existing `redis` Docker Compose service because three real BullMQ lifecycle tests intentionally fail when Redis 7 is unavailable. The first gate attempt had 79 passing tests and 3 Redis-prerequisite failures; the recorded final gate is the successful rerun.
- Ran `prisma generate` against the existing schema because the generated client was stale and did not expose existing `userId` or `CrawlerRule` fields. No Prisma schema edit or migration was created.
- Added `userId: entry.userId` to the existing leaderboard repository mapper, plus matching fixture fields. This is the minimum required consumer alignment after T003 made `LeaderboardEntryPayload.userId` required. No viewer scoping, filtering, Top-K, detail, `updatedAt`, or rank behavior from Phase 2 was implemented.
- Repaired the existing Strategy controller test harness in its T006-owned test file to supply the controller's current execution-port dependency and use two children for a valid composite fixture. Production controller/auth behavior was unchanged.
- `SearchLoopRun` and `SearchLoopCandidate` remain global and unchanged; no `userId` field or per-user query was added to either model.

### Files modified in Phase 1

- `kb/contracts/events.yaml`
- `workspace/libs/shared/src/events/index.ts`
- `workspace/libs/shared/src/types/infrastructure.ts`
- `workspace/apps/backend/src/queue/backtest.worker.spec.ts`
- `workspace/apps/backend/src/queue/backtest.worker.ts`
- `workspace/apps/backend/src/strategy/ports/backtest-result.port.spec.ts`
- `workspace/apps/backend/src/strategy/ports/backtest-result.port.ts`
- `workspace/apps/backend/src/strategy/controllers/tests/strategy.controller.spec.ts`
- `workspace/apps/backend/src/loop/strategy-loop.service.spec.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.repository.spec.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.repository.ts`
- `workspace/apps/backend/src/dashboard/push.gateway.spec.ts`
- `sdd_artifacts/per-user-leaderboard-live-toggle/tasks.md`
- `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`

## Phase 6 — Cross-route Provider Convergence (T044–T050, 2026-08-24)

This evidence closes only T044–T050. Release tasks T034–T042 remain pending.

### RED evidence

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/contexts/leaderboard-live-context.spec.tsx
```

- Exit: `1` as intended.
- Failure: `leaderboard-live-context` did not exist, proving the provider contract preceded production implementation.

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/hooks/use-dashboard-summary.spec.tsx src/hooks/use-leaderboard.spec.tsx src/components/common/app-shell.spec.tsx src/app/page.spec.tsx
```

- Exit: `1` as intended.
- Six behavior failures proved Dashboard and `/leaderboard` still owned page caches/listeners and root layout lacked `LeaderboardLiveProvider`.

### GREEN targeted gate

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/contexts/leaderboard-live-context.spec.tsx src/hooks/use-dashboard-summary.spec.tsx src/hooks/use-leaderboard.spec.tsx src/components/common/app-shell.spec.tsx src/app/page.spec.tsx src/hooks/use-infrastructure-socket.spec.tsx src/services/infrastructure-socket.spec.ts src/components/dashboard/loop-status-panel.spec.tsx src/components/dashboard/dashboard-grid.spec.tsx src/components/dashboard/leaderboard-preview.spec.tsx
```

- Exit: `0`.
- Test files: `10 passed / 10 total`.
- Tests: `40 passed / 40 total`.
- Evidence includes default OFF, persisted cache/preference, one exact provider handler, route-child survival, subscribe-before-refetch, reconnect ON/OFF, exact cleanup, provider SCORE Top-5 composition, zero page-hook handler, active criterion sharing, and A→B/A→anonymous delayed-response rejection.

```powershell
npm.cmd exec -- tsc --noEmit -p apps/frontend/tsconfig.json
```

- Exit: `0`.
- Diagnostics: none.

```powershell
npm.cmd run lint -w @crypto-strategy-lab/frontend -- src/contexts/leaderboard-live-context.tsx src/contexts/leaderboard-live-context.spec.tsx src/hooks/use-dashboard-summary.ts src/hooks/use-dashboard-summary.spec.tsx src/hooks/use-leaderboard.ts src/hooks/use-leaderboard.spec.tsx src/app/layout.tsx src/app/page.tsx src/app/page.spec.tsx src/app/leaderboard/page.tsx src/components/common/app-shell.spec.tsx src/services/api-client.ts
```

- Exit: `0`.
- Targeted diagnostics: none.

### Source ownership audit

- Canonical root order is `AuthProvider -> InfrastructureProvider -> LeaderboardLiveProvider -> AppShell`.
- The only production `leaderboard:update` registration/removal under frontend contexts/hooks/app is in `leaderboard-live-context.tsx`.
- Provider code contains no shared-socket disconnect, `removeAllListeners`, loop lifecycle command, room, handshake, namespace, wire/auth, database, or migration change.
- T034–T042 were not executed or marked complete.

## T043 — Browser-persisted Live Updates choice (2026-08-24)

- Requirement amendment: absence of a stored choice defaults OFF; reload/browser restart restores the last explicit ON/OFF value.
- Added shared browser preference hook backed by `localStorage` key `crypto-strategy-lab:leaderboard-live`.
- Dashboard and full Leaderboard hooks both honor persisted OFF for invalidation/reconnect while still loading one initial REST snapshot.
- RED evidence: Dashboard suite failed 2 tests before implementation (received initial `true`; storage remained `null`).
- GREEN command: `npm.cmd run test -w @crypto-strategy-lab/frontend -- src/hooks/use-dashboard-summary.spec.tsx src/hooks/use-leaderboard.spec.tsx`.
- GREEN result: 2 files, 17 tests passed.
- Full frontend regression: `npm.cmd run test -w @crypto-strategy-lab/frontend` — 15 files, 58 tests passed.
- Frontend TypeScript: `npm.cmd exec -- tsc --noEmit` — exit 0, no diagnostics.

## Phase 5 — Frontend Live Toggle and Read-only Loop Panel

**Validated**: 2026-08-23
**Scope**: T024-T033 only. Phase 6 was not started.

### Task-by-task RED/GREEN evidence

| Task | Evidence | Result |
|---|---|---|
| T024 | Added invalidation/refetch, untrusted wire-row, request-generation, watermark, sort and selection tests in `use-leaderboard.spec.tsx`. | Valid RED: exit `1`; 2/6 tests failed because `leaderboard:update` still replaced rows and did not start a scoped REST request. |
| T025 | Replaced direct `topK` application with a scoped refetch and advanced the accepted-snapshot watermark. | GREEN: `use-leaderboard.spec.tsx`, 6/6 tests passed. |
| T026 | Added initial ON, exact OFF cleanup, frozen snapshot, loop continuity, re-enable ordering/race, reconnect and unmount tests. | Valid RED: exit `1`; 4/9 tests failed because the live state/setter and split listener lifecycle did not exist. |
| T027 | Added controlled live state, stable handler, subscribe-before-refetch and independent loop/connection listener effects. | GREEN: `use-dashboard-summary.spec.tsx`, 9/9 tests passed. |
| T028 | Replaced command-oriented expectations with global-status, accessible switch, visible state and command-absence assertions. | Valid RED: exit `1`; 3/4 tests failed because the switch/system wording were absent and command controls remained. |
| T029 | Refactored `LoopStatusPanel` to read-only system status plus controlled `role="switch"`. | GREEN: `loop-status-panel.spec.tsx`, 4/4 tests passed. |
| T030 | Added `page.spec.tsx` to reject `api`/`startRequest` props and require hook-controlled live state. | Valid RED: exit `1`; 2/2 tests failed because controlled live props were not wired. |
| T031 | Removed loop-command request construction/API wiring and passed the dashboard live state through the grid's loop-status slot. | GREEN: page/grid/preview checkpoint, 3 suites and 7/7 tests passed. |
| T032 | Added frozen-OFF/caught-up-ON composition coverage and changed preview fixtures to continuous view-local ranks. | Characterization/regression GREEN: dashboard grid + preview suites, 5/5 tests passed. |
| T033 | Extended singleton and infrastructure-hook coverage for shared instance, exact cleanup, preserved leaderboard/loop/queue listeners and zero disconnects. | Characterization/regression GREEN: singleton + infrastructure hook suites, 8/8 tests passed. |

### Listener identity and race evidence

- Historical T026 baseline used initial ON. Superseded on 2026-08-24 by T043: absent browser choice defaults OFF and only explicit persisted ON owns a listener.
- OFF calls `socket.off('leaderboard:update', handler)` with the same function captured from `socket.on`; listener count becomes zero while `loop:progress` remains one.
- Re-enable records the second `socket.on` invocation before the catch-up REST invocation. An event emitted while catch-up is pending starts a newer request generation; the older response cannot overwrite the newer scoped snapshot.
- Accepted REST snapshots advance the watermark. Older realtime invalidations cause no additional REST call.
- Reconnect while ON refetches. Reconnect while OFF leaves the leaderboard frozen and does not reattach/refetch the leaderboard view.
- Repeated registration remains set-deduplicated at one exact handler. Unmount removes owned handlers only; external leaderboard, loop and queue listeners remain registered.
- No tested cleanup calls `disconnect()`, `removeAllListeners()`, or the exported `disconnectInfrastructureSocket()` seam.

### Accessibility and command absence

- The toggle is a native focusable `button` with `role="switch"`, accessible name `Live updates`, `aria-checked`, and visible `ON`/`OFF` text.
- The panel states that Search Loop is system-wide and that the system loop keeps running when the view is frozen.
- Start, Pause, Resume and Stop controls and their production props/imports were removed from the panel and page.
- Page tests exercise the toggle and assert zero calls to mocked `startLoop`, `pauseLoop`, `resumeLoop`, and `stopLoop` methods.

### Final Phase 5 gate

All commands ran with workdir `workspace/`.

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/hooks/use-leaderboard.spec.tsx src/hooks/use-dashboard-summary.spec.tsx src/hooks/use-infrastructure-socket.spec.tsx src/components/dashboard/loop-status-panel.spec.tsx src/app/page.spec.tsx src/components/dashboard/dashboard-grid.spec.tsx src/components/dashboard/leaderboard-preview.spec.tsx src/services/infrastructure-socket.spec.ts
```

- Exit: `0`
- Suites: `8 passed / 8 total`
- Tests: `34 passed / 34 total`

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend
```

- Exit: `0`
- Suites: `15 passed / 15 total`
- Tests: `56 passed / 56 total`

```powershell
npm.cmd run build -w @crypto-strategy-lab/frontend
```

- Exit: `0`
- Next.js 16.3 production compilation, TypeScript check, page-data collection and 10/10 static page generation succeeded.
- Non-blocking existing warning: the Next.js `middleware` filename convention is deprecated in favor of `proxy`.

### Scope audit and deviations

- `infrastructure-socket.ts` remains the sole production owner of the `/infrastructure` socket singleton and was not functionally changed. The separate pre-existing Market Data socket is outside this toggle. No socket, room, namespace, auth handshake or disconnect behavior was added.
- `leaderboard:update` is treated only as invalidation in both frontend hooks; event `topK` is never applied as a private snapshot.
- Loop handlers remain independent of the leaderboard toggle. No loop/queue listener was removed from production ownership.
- No backend, Prisma, migration, `SearchLoopRun`, or `SearchLoopCandidate` file was changed during Phase 5.
- The full-suite gate initially exposed a pre-existing Vitest/Next environment mismatch in `leaderboard-detail.spec.tsx`: `.env` contains non-empty Supabase keys, but the test imports `process.env`-based Next client initialization before its fetch seam. A test-only anonymous Supabase session mock was added, matching the established unit-test boundary; production auth semantics were not changed.

### Files modified in Phase 5

- `workspace/apps/frontend/src/hooks/use-leaderboard.spec.tsx`
- `workspace/apps/frontend/src/hooks/use-leaderboard.ts`
- `workspace/apps/frontend/src/hooks/use-dashboard-summary.spec.tsx`
- `workspace/apps/frontend/src/hooks/use-dashboard-summary.ts`
- `workspace/apps/frontend/src/components/dashboard/loop-status-panel.spec.tsx`
- `workspace/apps/frontend/src/components/dashboard/loop-status-panel.tsx`
- `workspace/apps/frontend/src/app/page.spec.tsx`
- `workspace/apps/frontend/src/app/page.tsx`
- `workspace/apps/frontend/src/components/dashboard/dashboard-grid.spec.tsx`
- `workspace/apps/frontend/src/components/dashboard/dashboard-grid.tsx`
- `workspace/apps/frontend/src/components/dashboard/leaderboard-preview.spec.tsx`
- `workspace/apps/frontend/src/hooks/use-infrastructure-socket.spec.tsx`
- `workspace/apps/frontend/src/services/infrastructure-socket.spec.ts`
- `workspace/apps/frontend/src/components/leaderboard/leaderboard-detail.spec.tsx` (test-only full-gate harness)
- `sdd_artifacts/per-user-leaderboard-live-toggle/tasks.md`
- `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`

## Phase 4 — Privacy-safe Namespace-wide Realtime

**Validated**: 2026-08-23
**Scope**: T020-T023 only. Phase 5 was not started.

### Task-by-task test-first evidence

| Task | Evidence | Result |
|---|---|---|
| T020 | Ran `leaderboard/leaderboard.service.spec.ts -t T020` before publisher implementation. | RED as intended: exit `1`; 2/2 selected system/private branch tests failed because publisher called `getTopK("score")` without explicit system viewer `null`. The private fixture consequently selected private Top-K/watermark and exposed the unsafe publisher behavior. |
| T021 | Ran `dashboard/push.gateway.spec.ts -t T021` against the existing gateway. | Characterization GREEN: exit `0`; 1/1 selected test passed. Gateway calls `server.emit("leaderboard:update", payload)` with the exact same payload reference and contains no room, socket-auth, namespace, or disconnect behavior. No production gateway edit was made. |
| T022 | Ran `leaderboard/leaderboard.integration.spec.ts -t T022` before publisher implementation. | RED as intended: exit `1`; 1/1 selected test failed at the gateway boundary because private A's result ID was present in `triggeredByBacktestResultId`. System Top-K and watermark were already scoped correctly. |
| T023 | Passed explicit system scope and redacted private triggers in `leaderboard.service.ts`, then reran T020/T021/T022 independently. | GREEN: T020 `2/2`, T021 `1/1`, T022 `1/1`; all three commands exited `0`. |

### Exact emitted payload branches

```text
system completion:
  updatedAt = newest system entry timestamp
  triggeredByBacktestResultId = system result ID
  rankingCriterion = score
  topK = system entries only (every userId is null)

private A or B completion:
  updatedAt = unchanged/newest system entry timestamp
  triggeredByBacktestResultId = null
  rankingCriterion = score
  topK = the same system-only projection
```

- The publisher calls `getTopK(RankingCriterion.SCORE, null)` and `getUpdatedAt(null)` explicitly.
- Private entries are still persisted with their owner ID; only the namespace-wide notification is redacted.
- The A/B integration test rejects either private user UUID, result ID, strategy-version ID, or private strategy name anywhere in the emitted private-trigger payloads.
- The integration test also asserts every emitted Top-K row has `userId = null`, both private emissions retain the system watermark, and the gateway receives the exact safe payload.

### Final Phase 4 gate

All commands ran with workdir `workspace/`.

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand leaderboard dashboard/push.gateway.spec.ts
```

- Exit: `0`
- Suites: `6 passed / 6 total`
- Tests: `95 passed / 95 total`
- Snapshots: `0`

```powershell
npm.cmd run test:cov -w @crypto-strategy-lab/backend -- --runInBand leaderboard dashboard/push.gateway
```

- Exit: `0`
- Suites/tests: `6/6` suites and `95/95` tests passed.
- Branch evidence:
  - `src/leaderboard`: `88.23%`
  - `leaderboard.service.ts`: `86.36%`
  - `leaderboard.repository.ts`: `86.95%`
  - `leaderboard.controller.ts`: `79.16%`
  - `push.gateway.ts`: `100%`
- Statement/line evidence:
  - `src/leaderboard`: `95.47%` statements, `96.05%` lines
  - `leaderboard.service.ts`: `94.91%` statements, `100%` lines
  - `push.gateway.ts`: `95.12%` statements, `94.73%` lines

```powershell
npm.cmd exec -w @crypto-strategy-lab/backend -- tsc --noEmit -p tsconfig.build.json
```

- Exit: `0`
- Diagnostics: none.

### Scope and architecture audit

- `PushGateway` remains an exact namespace-wide transport relay. Its production file has no diff and no room, join, socket-auth handshake, namespace, client filter, or disconnect addition.
- Privacy is enforced before the gateway in `LeaderboardService`; no client-side filtering is used as an authorization control.
- No frontend, Prisma schema, migration, SearchLoopRun, or SearchLoopCandidate file changed in Phase 4.
- T024 and every later Phase 5 task remain unchecked.

### Files modified in Phase 4

- `workspace/apps/backend/src/leaderboard/leaderboard.service.spec.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.integration.spec.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.service.ts`
- `workspace/apps/backend/src/dashboard/push.gateway.spec.ts`
- `sdd_artifacts/per-user-leaderboard-live-toggle/tasks.md`
- `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`

## Phase 3 — Guarded Controller, Global Search Loop

**Validated**: 2026-08-23
**Scope**: T018-T019 only. Phase 4 was not started.

### T018 valid RED evidence

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand loop/loop.controller.spec.ts loop/loop.integration.spec.ts -t T018
```

- Exit: `1`
- Suites/tests: `2/2` suites failed; `2` selected tests failed and `41` were skipped.
- Intended failures only: `LoopController` had no `GUARDS_METADATA`, and the optional-auth guard was invoked `0/6` times across anonymous, user A, and user B current/detail requests.
- The three actors already received identical global loop responses, so the RED was caused by missing controller wiring rather than fixture, mock, service, or persistence behavior.

### T019 paired GREEN evidence

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand loop/loop.controller.spec.ts loop/loop.integration.spec.ts -t T018
```

- Exit: `0`
- Suites/tests: `2/2` suites passed; `2/2` selected tests passed.
- Every one of the six routes uses the class guard and a `@CurrentUser()` parameter. Anonymous, A, and B receive identical current/detail projections; the guard runs six times while Prisma run/candidate arguments and records contain neither viewer UUID nor `userId`.

### Final Phase 3 gate

All commands ran with workdir `workspace/`.

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand loop
```

- Exit: `0`
- Suites: `6 passed / 6 total`
- Tests: `130 passed / 130 total`
- Snapshots: `0`

```powershell
npm.cmd exec -w @crypto-strategy-lab/backend -- tsc --noEmit -p tsconfig.build.json
```

- Exit: `0`
- Diagnostics: none.

```powershell
rg -n "userId|SearchLoopRun|SearchLoopCandidate" apps/backend/src/loop apps/backend/prisma/schema.prisma
```

- Exit: `0`; matches were reviewed rather than treated as automatic failures.
- Schema `userId` matches are the pre-existing nullable fields on `StrategyVersion`, `BacktestResult`, and `LeaderboardEntry`. The `SearchLoopRun` and `SearchLoopCandidate` model blocks contain no `userId` field.
- `strategy-loop.service.ts:284` is the required `userId: null` on the `SEARCH_LOOP` backtest producer. Matching specs assert the same invariant.
- Remaining `SearchLoopRun`/`SearchLoopCandidate` matches are type/model references, repository operations, and test fixtures. No viewer parameter, owner predicate, or per-user active-loop rule exists.
- `git diff` is empty for `loop.repository.ts`, `loop-status.service.ts`, `strategy-loop.service.ts`, Prisma schema, and migrations. Production changes are limited to controller auth context and `AuthModule` reuse.

### Requirement authority and deviations

- `kb/flows/strategy-search-loop.md` is stale where it assigns start/pause/resume/stop ownership to an end user. The 2026-08-18 assignment/summary decision is authoritative: the loop remains one global system process.
- The task artifact names `strategy-loop.repository.ts`, but that path does not exist in the workspace. The actual persistence owner is `workspace/apps/backend/src/loop/loop.repository.ts`; it was audited and left unchanged. No replacement repository was created.
- `loop.module.spec.ts` received an Auth provider fake because importing `AuthModule` makes isolated module tests resolve `SupabaseService` without AppModule's global ConfigModule. This changes only the test harness.
- No `RequireAuth`, migration, Prisma change, service/repository viewer argument, or Phase 4 implementation was added.

### Files modified in Phase 3

- `workspace/apps/backend/src/loop/loop.controller.spec.ts`
- `workspace/apps/backend/src/loop/loop.integration.spec.ts`
- `workspace/apps/backend/src/loop/loop.module.spec.ts`
- `workspace/apps/backend/src/loop/loop.controller.ts`
- `workspace/apps/backend/src/loop/loop.module.ts`
- `sdd_artifacts/per-user-leaderboard-live-toggle/tasks.md`
- `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`

## Phase 2 — Authenticated, Viewer-scoped REST Reads

**Validated**: 2026-08-23
**Scope**: T008-T017 only. Phase 3 was not started.

### Task-by-task RED/GREEN evidence

| Task | Evidence | Result |
|---|---|---|
| T008 | Ran `leaderboard.repository.spec.ts -t T008` before repository implementation. | RED as intended: exit `1`; 3/3 selected anonymous/A/B cases failed because foreign rows were returned and Top-K was selected without viewer scope. |
| T009 | Ran `leaderboard.repository.spec.ts -t T009` before implementation. | RED as intended: exit `1`; 5/5 selected cases failed: persisted rank leaked into detail, foreign detail remained addressable, A/anonymous timestamp included B activity, and ranks were not contiguous. |
| T010 | Ran `leaderboard.service.spec.ts -t T010` before implementation. | RED as intended: exit `1`; 8/8 selected cases failed because viewer IDs were not delegated and completion owner was omitted from create input. |
| T011 | Ran `leaderboard.controller.spec.ts -t T011` before implementation. | RED as intended: exit `1`; 4/4 selected cases failed because guard/current-user metadata and viewer delegation were absent. |
| T012 | Ran `leaderboard.integration.spec.ts -t T012` before implementation. | RED as intended: exit `1`; foreign-existing detail returned `200` instead of the same stable `404` as nonexistent detail. |
| T013 | Ran the complete repository spec after applying visibility before projection and recomputing response ranks. | GREEN: exit `0`; 1 suite and 24/24 tests passed. |
| T014 | Ran complete repository + service specs after scoped signatures and owner propagation. | GREEN: exit `0`; 2 suites and 52/52 tests passed. |
| T015 | Ran complete controller + leaderboard integration specs after optional-auth wiring and AuthModule reuse. | GREEN: exit `0`; 2 suites and 18/18 tests passed, including symmetric A/B anti-enumeration. |
| T016 | Ran dashboard unit/integration specs matching T016 before dashboard implementation. | RED as intended: exit `1`; 4/4 selected cases failed because dashboard omitted viewer identity from leaderboard reads. Loop and queue calls were already zero-argument/global. |
| T017 | Ran dashboard unit/integration plus all leaderboard regressions after viewer threading. | GREEN: exit `0`; 6 suites and 96/96 tests passed. |

### Anonymous / User A / User B scenario matrix

| Read path | Anonymous (`null`) | User A | User B | Evidence |
|---|---|---|---|---|
| List / Top-K | System entries only | System + A; never B | System + B; never A | T008 repository scenarios; visibility is applied before best-per-version, sorting and Top-K. |
| Response rank | Continuous `1..N` over system view | Continuous `1..N` over system+A | Continuous `1..N` over system+B | T009 rank scenario and complete repository suite. |
| `updatedAt` | Newest system row only | Newest system/A row | Newest system/B row | T009 three-actor timestamp matrix. |
| System detail | Visible | Visible | Visible | Scoped detail uses the same system-or-owner predicate. |
| Own private detail | Not visible | A detail visible | B detail visible | T010 scoped delegation and integration fixture. |
| Foreign private detail | Stable 404 | B detail is identical to nonexistent 404 | A detail is identical to nonexistent 404 | T012 symmetric integration scenario. |
| Dashboard leaderboard preview | System snapshot | System+A snapshot | System+B snapshot | T016 unit/integration three-actor matrix. |
| Dashboard loop / queue | Global | Same global calls | Same global calls | T016/T017 assert `getCurrent()` and `getStats()` receive no viewer argument. |

### Final Phase 2 gate

All commands ran with workdir `workspace/`.

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand leaderboard dashboard
```

- Exit: `0`
- Suites: `8 passed / 8 total`
- Tests: `117 passed / 117 total`
- Snapshots: `0`

```powershell
npm.cmd run test:cov -w @crypto-strategy-lab/backend -- --runInBand leaderboard dashboard
```

- Exit: `0`
- Suites/tests: `8/8` suites and `117/117` tests passed.
- Branch evidence:
  - `src/leaderboard`: `88.07%` branches
  - `leaderboard.repository.ts`: `86.95%` branches
  - `leaderboard.service.ts`: `85.71%` branches
  - `leaderboard.controller.ts`: `79.16%` branches
  - `src/dashboard`: `83.33%` branches
  - `dashboard.service.ts`: `77.77%` branches
  - `dashboard.controller.ts`: `77.77%` branches

```powershell
npm.cmd exec -w @crypto-strategy-lab/backend -- tsc --noEmit -p tsconfig.build.json
```

- Exit: `0`
- Diagnostics: none.

### Phase 2 implementation notes

- Optional-auth semantics are preserved: missing identity is `null`; valid test identity is a UUID. `RequireAuth` was not added.
- A single repository visibility predicate is applied by Prisma before best-per-version, sorting, Top-K, detail selection and `updatedAt`; response ranks are recomputed after projection.
- `findByBacktestResultId` remains an internal unscoped idempotency lookup for event consumption; it is not a public read path.
- Dashboard passes viewer identity only to the leaderboard projection. Loop status and queue statistics remain global and receive no identity argument.
- Existing `AuthModule` is reused by LeaderboardModule and DashboardModule. No auth, leaderboard or dashboard module was created.
- Isolated integration harnesses override Auth-owned providers/guard with deterministic identities; production auth semantics were not changed.
- No Prisma model, migration, `SearchLoopRun`, or `SearchLoopCandidate` change was made.

### Files modified in Phase 2

- `workspace/apps/backend/src/leaderboard/leaderboard.repository.spec.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.repository.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.service.spec.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.service.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.controller.spec.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.controller.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.integration.spec.ts`
- `workspace/apps/backend/src/leaderboard/leaderboard.module.ts`
- `workspace/apps/backend/src/dashboard/dashboard.service.spec.ts`
- `workspace/apps/backend/src/dashboard/dashboard.service.ts`
- `workspace/apps/backend/src/dashboard/dashboard.controller.ts`
- `workspace/apps/backend/src/dashboard/dashboard.integration.spec.ts`
- `workspace/apps/backend/src/dashboard/dashboard.module.ts`
- `sdd_artifacts/per-user-leaderboard-live-toggle/tasks.md`
- `sdd_artifacts/per-user-leaderboard-live-toggle/validation.md`
