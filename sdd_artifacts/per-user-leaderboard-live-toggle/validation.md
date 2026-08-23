# Validation: Per-user Leaderboard and Live Toggle

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
