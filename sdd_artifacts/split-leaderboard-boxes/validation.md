# Validation: Split Leaderboard Boxes

## Phase 1 — Prerequisite and Contract Gate (2026-08-25)

**Scope**: T001–T002 only. T003 and later tasks were not run or marked complete. No production code, Prisma schema, migration, KB contract, baseline feature artifact, or unrelated dirty-worktree file was changed in this phase.

**Phase command result**: all read-only audit/status/hash command groups exited `0`. Test suites executed in this phase: `0`; Phase 1 is an evidence and contract audit, and running T041/T042 was not claimed. The earlier baseline test counts below are carried evidence, not fresh executions.

### Pre-execution gate

- The feature requirements checklist is complete and contains no unresolved clarification marker.
- The implement skill, relevant KB, current feature `spec.md`, `plan.md`, `research.md`, `data-model.md`, both contracts, `quickstart.md`, and `tasks.md` were read before this audit.
- The worktree was already dirty. Its existing changes were treated as user-owned; this phase only creates this file and updates the T001/T002 checkboxes in this feature's `tasks.md`.

## T001 — Baseline T041/T042 evidence carry-forward — PASS

T001 explicitly permits either running the outstanding baseline validation or carrying its real pending state forward. This phase uses the carry-forward branch. It does **not** claim that the baseline release gate passed and does **not** mark either baseline task complete.

### Status/evidence inspection

Run from the repository root:

```powershell
rg -n "^- \[[ xX]\] T04[012]" sdd_artifacts/per-user-leaderboard-live-toggle/tasks.md
rg -n "T041|T042|full E2E|manual|13 scenarios|not run|not executed|remain" sdd_artifacts/per-user-leaderboard-live-toggle/validation.md
```

- Command group exit: `0`.
- Current baseline task status: T040 `[X]`; T041 `[ ]`; T042 `[ ]`.
- The baseline validation explicitly says T041–T042 were not run in its T035–T040 gates and that T041 was merely unblocked after T040.

Existing narrower evidence was also inspected:

| Prior baseline evidence | Command | Exit | Count | Interpretation for this gate |
|---|---|---:|---:|---|
| T035 dedicated backend E2E | `npm.cmd run test:e2e -w @crypto-strategy-lab/backend -- --runInBand per-user-leaderboard.e2e-spec.ts` | `0` | 1 suite, 3 tests passed | Useful anonymous/A/B and safe-wire evidence, but it is not the **full backend E2E suite** required by T041. |
| T036 dedicated frontend browser spec | `npm.cmd run test:e2e -w @crypto-strategy-lab/frontend -- leaderboard.spec.ts` | `0` | 6 Chromium tests passed | Useful provider/identity/reconnect evidence, but it is not recorded as the **full frontend Playwright suite** required by T041. |

### Carried-forward blockers

- **T041 remains pending**: no evidence records a current full backend E2E run including `per-user-leaderboard.e2e-spec.ts` together with a full frontend Playwright run including `leaderboard.spec.ts`.
- **T042 remains pending**: it depends on T041 and has no completed evidence for all 13 manual quickstart scenarios, including real anonymous/A/B symmetric non-disclosure.
- Consequently, `sdd_artifacts/per-user-leaderboard-live-toggle/tasks.md` remains unchanged. Its T041 and T042 checkboxes stay `[ ]`.

T001 passes because the exact evidence gap and blockers have now been carried forward without upgrading targeted evidence into release evidence.

## T002 — Immutable architecture baseline audit — PASS

### Prisma ownership and migrations

```powershell
rg -n -A 18 -B 3 "model LeaderboardEntry|model SearchLoopRun|model SearchLoopCandidate" workspace/apps/backend/prisma/schema.prisma
rg --files workspace/apps/backend/prisma/migrations
```

- Command group exit: `0`.
- `LeaderboardEntry.userId` is already nullable (`String?`): null is system-owned and non-null is private ownership.
- `SearchLoopRun` and `SearchLoopCandidate` contain no `userId` field; their persistence remains global.
- Four existing `migration.sql` files were found. None is a split-leaderboard migration, and the current REST/provider contracts explicitly require no schema or migration change.

### Event contract and PushGateway

```powershell
rg -n -A 35 -B 5 "LeaderboardUpdated" kb/contracts/events.yaml
Get-Content -Raw workspace/apps/backend/src/dashboard/push.gateway.ts
rg -n "\.to\(|\.join\(|\.leave\(|handshake|rooms?|namespace|auth|client" workspace/apps/backend/src/dashboard/push.gateway.ts
```

- Command group exit: `0`.
- `LeaderboardUpdated.topK` is system-only (`userId=null`); a private trigger uses `triggeredByBacktestResultId=null`.
- `PushGateway` relays the event with `server.emit` on the existing `/infrastructure` namespace.
- The search finds only the existing namespace declaration and no room targeting, join/leave, socket-auth handshake, or client authorization branch.
- Therefore this feature needs no event field, private websocket payload, room, handshake, or namespace change. Scoped REST remains the authoritative snapshot source.

### Global Search Loop

```powershell
rg -n "CurrentUser|viewerUserId|userId|scope|SearchLoopRun|SearchLoopCandidate" workspace/apps/backend/src/loop --glob "!*.spec.ts"
```

- Command exit: `0`.
- Controller identity parameters are deliberately ignored before invoking the one global loop/status service.
- SEARCH_LOOP backtest enqueue explicitly supplies `userId: null`.
- No viewer/scope predicate exists in loop persistence. No per-user loop is required or authorized.

### Contract boundary and client authorization audit

```powershell
rg -n "migration|socket room|room|handshake|namespace|private payload|client-side|client filtering|per-user loop|combined|scope" sdd_artifacts/split-leaderboard-boxes/plan.md sdd_artifacts/split-leaderboard-boxes/research.md sdd_artifacts/split-leaderboard-boxes/contracts/leaderboard-rest.md sdd_artifacts/split-leaderboard-boxes/contracts/leaderboard-provider.md sdd_artifacts/split-leaderboard-boxes/data-model.md
rg -n "\.filter\([^\r\n]*userId|entry\.userId|row\.userId" workspace/apps/frontend/src/contexts/leaderboard-live-context.tsx workspace/apps/frontend/src/hooks/use-leaderboard.ts workspace/apps/frontend/src/app/leaderboard/page.tsx
```

- Contract search exit: `0`.
- Current frontend ownership-filter search exit: `1`, meaning no matching client ownership filter was found in the inspected leaderboard provider/hook/page files.
- The contracts require `scope=system|mine|combined`, default Combined compatibility, server-side filter-before-projection/detail, scope-aware caches, and REST refetch after safe invalidation.
- They explicitly exclude client filtering as an authorization boundary, schema/migration changes, private websocket topology/payload, and a per-user loop.

### Pre-implementation SHA-256 baseline

```powershell
$paths=@(
  'workspace/apps/backend/prisma/schema.prisma',
  'kb/contracts/events.yaml',
  'workspace/apps/backend/src/dashboard/push.gateway.ts',
  'workspace/apps/backend/src/loop/loop.controller.ts',
  'workspace/apps/backend/src/loop/loop.repository.ts',
  'workspace/apps/backend/src/loop/strategy-loop.service.ts'
)
Get-FileHash -Algorithm SHA256 -LiteralPath $paths
```

- Command exit: `0`.

| File | SHA-256 at Phase 1 checkpoint |
|---|---|
| `workspace/apps/backend/prisma/schema.prisma` | `59B08210207C7AEE1CEF2B13084331E04B043D5F7A6C6A71E5FE3031BC8C9DDC` |
| `kb/contracts/events.yaml` | `11613658EA6DB034883223D0021C8E4699D0B100FC90EC935A70DE8C8205FA53` |
| `workspace/apps/backend/src/dashboard/push.gateway.ts` | `2D57E005476D0E6FF3BF546CCE0F72938048465CF7FCCE677665572675F2ED90` |
| `workspace/apps/backend/src/loop/loop.controller.ts` | `84FAAA2E0779E672B7FF5AA81566FF35C66461C95417D58AB73F20A6E8075C00` |
| `workspace/apps/backend/src/loop/loop.repository.ts` | `4FD36DAA5FD5E9CB779A0BF9B76637C4F3AD19CEE9D92BA32BF6D4861707591B` |
| `workspace/apps/backend/src/loop/strategy-loop.service.ts` | `F68944F407464F40627AA43F230FF15EE58069EE812E20514ADE1FFEB648ED59` |

These hashes capture the current user-owned worktree state; they do not imply those files were clean before this phase.

## Phase 1 checkpoint

**PASS for the Phase 1 purpose**: baseline privacy/provider evidence and its remaining gaps are known, feature contracts are authoritative, and forbidden architecture changes have a recorded pre-implementation baseline.

This is not a release pass for `per-user-leaderboard-live-toggle`: its T041 and T042 remain blockers for closing that baseline feature. Per the requested stop condition, T003 and later work was not started and no production code was changed.

## Phase 2 RED wave — T003–T008 (2026-08-25)

Only the seven test files named by T003–T008 were changed before these runs. No Phase 2 production file had been changed when the following failures were captured.

### T003–T006 and T008 targeted Jest RED

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand leaderboard/leaderboard.controller.spec.ts leaderboard/leaderboard.repository.spec.ts leaderboard/leaderboard.service.spec.ts leaderboard/leaderboard.integration.spec.ts dashboard/dashboard.service.spec.ts dashboard/dashboard.integration.spec.ts
```

- Workdir: `workspace/`
- Exit: `1` (expected RED)
- Suites: `6 failed / 6 total`
- Tests: `30 failed, 83 passed / 113 total`
- T003: shared `LeaderboardScope` and `LeaderboardScopePipe` were absent; list/detail calls omitted both explicit and default Combined scope.
- T004: repository ignored scope, used the old Combined predicate, derived System/Mine rows and timestamps from the wrong visibility set, and queried anonymous Mine.
- T005: service ignored explicit scope and omitted default Combined; `BacktestCompleted` publication did not request System explicitly.
- T006: HTTP `scope=mine` returned Combined rows and wrong metadata; source-scoped unauthorized detail returned `200` instead of the stable `404`.
- T008: Dashboard called Leaderboard with only criterion/viewer rather than explicit Combined; Loop and Queue regression assertions remained passing.
- The 83 passing tests show the pre-existing baseline continued to execute while the new contract assertions failed.

### T007 backend E2E RED

```powershell
npm.cmd run test:e2e -w @crypto-strategy-lab/backend -- --runInBand per-user-leaderboard.e2e-spec.ts
```

- Workdir: `workspace/`
- Exit: `1` (expected RED)
- Suites: `1 failed / 1 total`
- Tests: `1 failed, 3 passed / 4 total`
- The new explicit-scope scenario failed because authenticated Mine returned three System rows instead of A's two private rows. Existing combined list/privacy, detail anti-enumeration, and real-websocket system-safe scenarios remained passing.

The RED failures are contract failures, not infrastructure or fixture blockers. T003–T008 therefore have valid RED evidence and unblock T009; no GREEN claim is made here.

## Phase 2 GREEN wave — T009–T014 (2026-08-25)

### Dependency-ordered implementation evidence

| Task | Command | Exit | Result |
|---|---|---:|---|
| T009 shared enum/pipe | `npm.cmd run build -w @crypto-strategy-lab/shared` | `0` | Shared TypeScript build passed. |
| T009 focused contract | `npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand leaderboard/leaderboard.controller.spec.ts -t "defines exactly system, mine, combined"` | `0` | 1 suite; 1 passed, 13 skipped. |
| T010 repository | `npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand leaderboard/leaderboard.repository.spec.ts` | `0` | 1 suite; 29/29 passed. |
| T011 service, first convergence run | `npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand leaderboard/leaderboard.service.spec.ts` | `1` | 2 old call-shape expectations still expected two arguments; 31 tests passed. Production scope behavior was correct. |
| T011 service, reconciled | same command | `0` | 1 suite; 33/33 passed after the two baseline expectations required explicit System/Combined arguments. |
| T012 controller | `npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand leaderboard/leaderboard.controller.spec.ts` | `0` | 1 suite; 14/14 passed. |
| T013 Dashboard | `npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand dashboard/dashboard.service.spec.ts dashboard/dashboard.integration.spec.ts` | `0` | 2 suites; 26/26 passed. |

The two T011 expectation changes are contract reconciliation in the T005-owned test file, not a production deviation: event publication now proves explicit System while legacy detail proves default Combined.

### T014 final targeted backend gate

```powershell
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand leaderboard/leaderboard.controller.spec.ts leaderboard/leaderboard.repository.spec.ts leaderboard/leaderboard.service.spec.ts leaderboard/leaderboard.integration.spec.ts dashboard/dashboard.service.spec.ts dashboard/dashboard.integration.spec.ts
```

- Workdir: `workspace/`
- Exit: `0`
- Suites: `6 passed / 6 total`
- Tests: `113 passed / 113 total`
- Snapshots: `0`

```powershell
npm.cmd run test:e2e -w @crypto-strategy-lab/backend -- --runInBand per-user-leaderboard.e2e-spec.ts
```

- Workdir: `workspace/`
- Exit: `0`
- Suites: `1 passed / 1 total`
- Tests: `4 passed / 4 total`
- Snapshots: `0`

The E2E matrix proves identical System projection for anonymous/A/B; A-only and B-only Mine; neutral anonymous Mine with no Prisma list/timestamp query; Mine entries below Combined Top-K; scope-local ranks and timestamps; omitted Combined compatibility; stable invalid scope; scoped detail anti-enumeration with zero Strategy result-port calls for invisible IDs; one global Loop; and unchanged real-websocket system-safe invalidation.

### Forbidden-change audit

The Phase 1 SHA-256 values were recomputed after GREEN and remain identical for:

- `workspace/apps/backend/prisma/schema.prisma`: `59B08210207C7AEE1CEF2B13084331E04B043D5F7A6C6A71E5FE3031BC8C9DDC`
- `kb/contracts/events.yaml`: `11613658EA6DB034883223D0021C8E4699D0B100FC90EC935A70DE8C8205FA53`
- `workspace/apps/backend/src/dashboard/push.gateway.ts`: `2D57E005476D0E6FF3BF546CCE0F72938048465CF7FCCE677665572675F2ED90`
- `workspace/apps/backend/src/loop/loop.controller.ts`: `84FAAA2E0779E672B7FF5AA81566FF35C66461C95417D58AB73F20A6E8075C00`
- `workspace/apps/backend/src/loop/loop.repository.ts`: `4FD36DAA5FD5E9CB779A0BF9B76637C4F3AD19CEE9D92BA32BF6D4861707591B`
- `workspace/apps/backend/src/loop/strategy-loop.service.ts`: `F68944F407464F40627AA43F230FF15EE58069EE812E20514ADE1FFEB648ED59`

No Prisma schema/migration, event field, PushGateway, socket room/handshake/namespace, private payload, or global/per-user Loop change occurred.

### Non-blocking formatting diagnostic

```powershell
npx.cmd prettier --check apps/backend/src/leaderboard/leaderboard.controller.spec.ts apps/backend/src/leaderboard/leaderboard.service.spec.ts apps/backend/src/leaderboard/leaderboard.integration.spec.ts apps/backend/test/per-user-leaderboard.e2e-spec.ts libs/shared/src/types/enums.ts
```

- Exit: `1`.
- Five files were reported as needing formatting.
- This is not part of T014's test gate. No `--write` was run because these files overlap pre-existing dirty user changes and whole-file formatting would mutate unrelated hunks. It remains explicit debt for the later feature-scoped formatting gate T041.

## Phase 2 checkpoint

**PASS**: T003–T014 have RED/GREEN or regression evidence. Existing list/detail routes now support System/Mine/Combined with Combined default; Dashboard remains Combined SCORE Top-5; event invalidation remains System-safe; anonymous/A/B privacy is symmetric; and forbidden architecture baselines are unchanged.

T015 and every later task remain unstarted. The older `per-user-leaderboard-live-toggle` T041/T042 release evidence also remains pending and is not reclassified by this checkpoint.

## Phase 3 RED — T015 (2026-08-25)

`workspace/apps/frontend/src/services/api-client.spec.ts` was created before any Phase 3 production edit.

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/services/api-client.spec.ts
```

- First sandbox run: exit `1` before discovery because esbuild was denied access while resolving `vitest.config.ts`; zero tests ran, so this is infrastructure evidence rather than contract RED.
- Approved rerun outside that sandbox restriction: exit `1` with valid RED.
- Test files: `1 failed / 1 total`.
- Tests: `2 failed, 4 passed / 6 total`.
- List failure: the current positional implementation serialized the options object as `sortBy=%5Bobject+Object%5D`, omitted `scope`, and lost the options `AbortSignal`.
- Detail failure: the current method ignored its options, omitted `scope=system`, and did not forward `AbortSignal`.
- Passing RED tests already preserved omitted-scope list/detail URLs, legacy positional list+signal, ISO date decoding, session-derived Authorization, and the type-level no-owner/no-auth-override assertions.

These are expected contract failures, not fixture failures. T015 has valid RED evidence and unblocks T016.

## Phase 3 GREEN — T016 (2026-08-25)

`api-client.ts` now accepts either the existing positional list arguments or typed leaderboard options. This preserves current provider callers while adding `sortBy`, `scope`, and `signal` to `LeaderboardListOptions`, plus `scope` and `signal` to `LeaderboardDetailOptions`. Neither options type contains ownership, headers, token, or identity fields.

### Targeted API client test

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/services/api-client.spec.ts
```

- Final approved run outside the esbuild sandbox restriction: exit `0`.
- Test files: `1 passed / 1 total`.
- Tests: `6 passed / 6 total`.
- Evidence: ordered `URLSearchParams` encoding for list `sortBy+scope`; same optional scope for detail; unchanged omitted-scope URLs; legacy positional list+AbortSignal; options AbortSignal; snapshot/detail ISO dates decoded to `Date`; current Supabase session resolved for every request; anonymous request has no Authorization header; response fields remain the existing snapshot/detail fields.

### Type and formatting checks

```powershell
npx.cmd tsc --noEmit --incremental false --pretty false
```

- Workdir: `workspace/apps/frontend/`.
- First run: exit `1` only because two multiline `@ts-expect-error` comments were attached to the call rather than the rejected `owner`/`headers` properties. TypeScript correctly rejected those properties.
- After moving the comments to the rejected fields: exit `0` with no output.
- This proves the options cannot accept `userId`, `owner`, or `headers`/Authorization overrides while all existing frontend callers still type-check.

```powershell
npx.cmd prettier --check src/services/api-client.ts src/services/api-client.spec.ts
```

- Exit: `0`.
- Both Phase 3 files match configured formatting.

### Phase 3 checkpoint

**PASS**: authoritative System/Mine/Combined REST scopes can be requested by the frontend API boundary; legacy omitted-scope and positional list calls remain valid; auth identity still comes only from `supabase.auth.getSession()` through the unchanged `apiRequest` path; wire response types are unchanged.

No provider, hook, component/page, Dashboard UI, socket, backend, Prisma, event, gateway, or Loop file was changed by Phase 3. T017 and every later task remain unstarted.

## Phase 4 RED — T017–T019, T021–T022 (2026-08-25)

The provider RED tasks were added sequentially to the one owned test file before `leaderboard-live-context.tsx` was changed.

| Task | Command | Exit | RED result and contract cause |
|---|---|---:|---|
| Baseline | `npm.cmd run test -w @crypto-strategy-lab/frontend -- src/contexts/leaderboard-live-context.spec.tsx` | `0` | 1 file, 11/11 passed before Phase 4 tests. |
| T017 | same provider command | `1` | 4 failed, 11 passed / 15: cache key was v1; no scoped projection surface, scoped requests, exact-key dedupe, or anonymous Mine-neutral state. |
| T018 | same provider command | `1` | 6 failed, 11 passed / 17: the two new tests could not fan invalidation/reconnect to three maintained keys or abort all scoped requests. |
| T019 | same provider command | `1` | 10 failed, 11 passed / 21: source-scoped selection, scoped identity clearing, late-response rejection, and per-key generations/watermarks were absent. |
| T021 | `npm.cmd run test -w @crypto-strategy-lab/frontend -- src/hooks/use-leaderboard.spec.tsx` | `1` | 1 failed, 2 passed / 3: the hook did not activate scoped maintenance or expose System/Mine and scope-aware selection. |
| T022 | `npm.cmd run test -w @crypto-strategy-lab/frontend -- src/hooks/use-dashboard-summary.spec.tsx src/components/dashboard/leaderboard-preview.spec.tsx` | `1` | Approved rerun after a sandbox config-read failure: 1 failed, 7 passed / 8; Dashboard rendered the legacy alias instead of `combinedScore`. The one-box Top-5 preview regression passed. |

Each failing run exercised the newly required contract; the pre-existing tests continued to provide regression evidence. The two esbuild `Access is denied` startup attempts discovered zero tests and are recorded as infrastructure noise, not RED evidence.

## Phase 4 GREEN — T020, T023–T025 (2026-08-25)

### T020 provider state and cache

- Effective in-memory key: ``${scope}:${criterion}`` inside an exact current-viewer state boundary; eligibility additionally requires the captured `viewerKey` and identity generation.
- Persisted key: `crypto-strategy-lab:leaderboard-cache:v2`.
- Envelope: `version`, exact `viewerKey`, `activeCriterion`, scope-aware `selectedStrategy`, `snapshots` keyed by `combined:score`, `system:<activeCriterion>`, and authenticated `mine:<activeCriterion>`, plus `persistedAt`.
- Criterion-only v1 is removed/rejected and never reclassified or filtered into System/Mine.
- Combined SCORE is always maintained. Full-page consumers opt into System/Mine; identical in-flight keys deduplicate, while different scopes start independently. Anonymous Mine skips HTTP and stays neutral.
- Every projection owns loading/error/stale/lastSuccessfulAt/refetch. A failure or refresh cannot borrow or erase another projection.
- Live ON owns one stable `leaderboard:update` handler. Invalidation/reconnect force authoritative REST reconciliation for each maintained key and never consume `event.topK`. Live OFF removes the handler, advances request generations, aborts all maintained requests, and freezes accepted snapshots.
- Identity transitions gate render by exact viewer, advance identity generation, abort/clear projections and metadata in a layout boundary, clear scope-aware selection/detail eligibility, and reject delayed A responses independently of transport abort. The Live preference is unchanged.

Provider GREEN command:

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/contexts/leaderboard-live-context.spec.tsx
```

- Exit: `0`.
- Test files: `1 passed / 1 total`.
- Tests: `21 passed / 21 total`.

### T023/T024 consumers

- `useLeaderboard` now activates provider-owned scoped maintenance and exposes System/Mine states, one criterion, selection `{strategyVersionId, sourceScope}`, and projection-owned retry functions. It imports/creates no socket.
- `useDashboardSummary` consumes only `combinedScore`; its loop/queue listeners are unchanged and it owns zero `leaderboard:update` handlers.
- `LeaderboardPreview` production code was not changed; the regression suite proves it remains one Combined Top-5 box.

GREEN commands:

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/hooks/use-leaderboard.spec.tsx
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/hooks/use-dashboard-summary.spec.tsx src/components/dashboard/leaderboard-preview.spec.tsx
```

- Hook: exit `0`, 1 file, 3/3 passed.
- Dashboard/preview: exit `0`, 2 files, 8/8 passed.

### T025 final checkpoint

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/contexts/leaderboard-live-context.spec.tsx src/hooks/use-leaderboard.spec.tsx src/hooks/use-dashboard-summary.spec.tsx src/components/dashboard/leaderboard-preview.spec.tsx
```

- Final run exit: `0`.
- Test files: `4 passed / 4 total`.
- Tests: `32 passed / 32 total`.
- Request evidence: initial Dashboard maintenance is one Combined SCORE request; full-route activation adds one System and one authenticated Mine request; repeated activation deduplicates exact pending keys; one invalidation/reconnect produces at most one request for each of the three distinct maintained keys; anonymous activation requests System but no Mine.
- Listener evidence: one handler while ON across route child replacement and two projections; zero while OFF/unmounted; no hook/Dashboard handler; no shared-socket disconnect.
- Race evidence: subscribe occurs before catch-up; forced invalidation supersedes older success; OFF aborts all three maintained signals; A→B and A→anonymous reject three delayed A projections and clear selection before the next identity is rendered.

Additional checks:

```powershell
npm.cmd exec -w @crypto-strategy-lab/frontend -- tsc --noEmit
npm.cmd exec -w @crypto-strategy-lab/frontend -- eslint src/contexts/leaderboard-live-context.tsx src/contexts/leaderboard-live-context.spec.tsx src/hooks/use-leaderboard.ts src/hooks/use-leaderboard.spec.tsx src/hooks/use-dashboard-summary.ts src/hooks/use-dashboard-summary.spec.tsx src/components/dashboard/leaderboard-preview.spec.tsx
```

- TypeScript exit: `0`, no diagnostics.
- Final feature-scoped ESLint exit: `0`, no warnings or errors. An earlier lint diagnostic found five ref-during-render errors and two dependency warnings; the provider view objects and Dashboard fallback were stabilized, then lint was rerun successfully.

## Phase 4 checkpoint

**PASS**: T017–T025 have sequential RED/GREEN or regression evidence. The app-level provider now owns scope-safe v2 projections, one realtime listener, scoped REST reconciliation, reconnect/OFF behavior, exact identity isolation, and source-scoped selection. Dashboard remains Combined SCORE Top-5 and no production Dashboard preview UI changed.

No Phase 5 task was started or marked complete. The full `/leaderboard` route still awaits the two-card component/page work in T026 onward. No backend, Prisma schema/migration, event contract, PushGateway, socket topology, private WS payload, or Search Loop file was changed in Phase 4.

## Phase 5 RED — T026–T029 (2026-08-25)

All four test files were changed or created before any Phase 5 production UI or middleware edit. They own disjoint files and were authored as one RED wave.

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/components/leaderboard/leaderboard-table.spec.tsx src/components/leaderboard/leaderboard-detail.spec.tsx src/app/leaderboard/page.spec.tsx src/middleware.spec.ts
```

- The first sandbox attempts exited `1` during esbuild config discovery (`Access is denied`) and ran zero tests; they are environment evidence only.
- Approved rerun exit: `1` with valid contract RED.
- Test files: `4 failed / 4 total`.
- Tests: `11 failed, 4 passed / 15 total`.
- T026: all 3 scoped-card tests failed because the old table required a single snapshot and had fixed heading/table IDs with no projection state or source scope.
- T027: 3 new assertions failed because detail omitted `scope`, omitted `AbortSignal`, and did not start/reject a request when only source scope changed; the existing safe presentation tests remained useful regression evidence.
- T028: all 4 route tests failed because the page still rendered one combined/legacy box and a route-wide empty state instead of independent System/Mine projections.
- T029: the anonymous `/leaderboard` assertion failed because middleware still required a session; login/register and protected-route regressions passed.

These failures map directly to the Phase 5 contract and precede T030–T033.

## Phase 5 GREEN — T030–T033 (2026-08-25)

- T030: `LeaderboardTable` now receives unique heading/description/heading ID/table name, exact System/Mine source scope, and one projection state. Loading, initial error, empty, stale-with-data, timestamp, and retry are projection-local. Populated tables retain Rank, Strategy, all five financial metrics, and Trades inside a named, keyboard-focusable horizontal scroller.
- T031: `LeaderboardDetail` passes the selected source scope and an `AbortSignal` to the existing detail endpoint. Its render/commit key is `scope:strategyVersionId`; cleanup aborts and invalidates the old request, so scope changes and disappearing selections cannot render delayed old detail. Safe 404 and one retry remain unchanged.
- T032: middleware returns immediately for exact `/leaderboard`; it does not read Supabase for that public route. Login/register session behavior and redirect destinations for unrelated protected routes remain unchanged.
- T033: the page consumes `system` and `mine` directly from `useLeaderboard`, owns no row filter, and exposes one shared criterion. The ranking column stacks System then Mine; the one shared detail follows it in DOM/source order and becomes the desktop side column. Anonymous Mine renders a sign-in link; authenticated empty Mine renders exactly one primary `/strategy` CTA.

Targeted GREEN command:

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/components/leaderboard/leaderboard-table.spec.tsx src/components/leaderboard/leaderboard-detail.spec.tsx src/app/leaderboard/page.spec.tsx src/middleware.spec.ts
```

- Exit: `0`.
- Test files: `4 passed / 4 total`.
- Tests: `15 passed / 15 total`.

## Phase 5 checkpoint — T034 (2026-08-25)

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/components/leaderboard/leaderboard-table.spec.tsx src/components/leaderboard/leaderboard-detail.spec.tsx src/app/leaderboard/page.spec.tsx src/middleware.spec.ts src/components/common/app-shell.spec.tsx
```

- Approved run exit: `0`.
- Test files: `5 passed / 5 total`.
- Tests: `22 passed / 22 total`.
- Accessibility evidence: unique `System leaderboard rankings` and `My strategies rankings` accessible names; unique heading IDs; named focusable scroll regions; textual loading/error/stale/empty states; keyboard-reachable sort, select, retry, sign-in, and CTA controls.
- Layout evidence: both ranking cards share `ranking-column` with vertical spacing; desktop workspace has one ranking column plus one detail column; DOM/source assertions prove System → Mine → Detail for mobile; each populated table owns its own `overflow-x-auto` region.
- State evidence: System remains rendered while Mine is loading/error/empty; stale System retains its table and timestamp/retry; anonymous Mine has no private table/read surface; authenticated empty Mine has one primary action.
- Route evidence: anonymous exact `/leaderboard` bypasses the Supabase session read; login/register and `/strategy` redirect behavior remain intact.

Listener/provider regression:

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/contexts/leaderboard-live-context.spec.tsx src/hooks/use-leaderboard.spec.tsx
```

- Sandbox config-discovery attempt: exit `1`, zero tests, not counted.
- Approved rerun exit: `0`.
- Test files: `2 passed / 2 total`.
- Tests: `24 passed / 24 total`.
- Evidence: the hook only activates provider-owned scoped projections; two cards add no listener. Provider remains the sole owner with exactly one handler while Live is ON and zero while OFF/unmounted.

Additional checks:

```powershell
npm.cmd exec -w @crypto-strategy-lab/frontend -- tsc --noEmit
npm.cmd run lint -w @crypto-strategy-lab/frontend -- src/components/leaderboard/leaderboard-table.tsx src/components/leaderboard/leaderboard-table.spec.tsx src/components/leaderboard/leaderboard-detail.tsx src/components/leaderboard/leaderboard-detail.spec.tsx src/app/leaderboard/page.tsx src/app/leaderboard/page.spec.tsx src/middleware.ts src/middleware.spec.ts
git diff --check -- workspace/apps/frontend/src/components/leaderboard/leaderboard-table.tsx workspace/apps/frontend/src/components/leaderboard/leaderboard-table.spec.tsx workspace/apps/frontend/src/components/leaderboard/leaderboard-detail.tsx workspace/apps/frontend/src/components/leaderboard/leaderboard-detail.spec.tsx workspace/apps/frontend/src/app/leaderboard/page.tsx workspace/apps/frontend/src/middleware.ts
```

- TypeScript: exit `0`, no diagnostics.
- Final feature-scoped ESLint: exit `0`, no warnings or errors. An earlier exit-0 run exposed one existing unused middleware callback parameter; the Phase 5-owned callback was made parameterless and lint was rerun cleanly.
- Diff check: exit `0`.

### Phase 5 result

**PASS**: T026–T034 have valid RED/GREEN or regression evidence. No production Dashboard preview, backend, socket, event, Prisma, PushGateway, or Search Loop file was changed in this phase. Next.js 16 documents `middleware.ts` as deprecated in favor of `proxy.ts`; this phase intentionally retained the repository's existing file/export convention because renaming the auth boundary is outside T032 and would broaden risk. T035 and all Phase 6 tasks remain unstarted.
