# Tasks: Split Leaderboard Boxes

**Input**: Design documents from `sdd_artifacts/split-leaderboard-boxes/`
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/leaderboard-rest.md`, `contracts/leaderboard-provider.md`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: May run in parallel because file ownership is disjoint and all prerequisites are already complete.
- **[Story]**: Primary specification story covered by the task (`US1`-`US5`) or `Foundation`/`Validation` for cross-cutting gates.
- Every task remains unchecked until its stated evidence exists.

---

## Phase 1: Prerequisite and Contract Gate

**Purpose**: Establish the approved baseline and immutable boundaries before any production implementation.

- [X] T001 [Foundation] Run or explicitly carry forward the pending `per-user-leaderboard-live-toggle` T041 full E2E and T042 manual matrix, recording exact commands/results and unresolved blockers in `sdd_artifacts/split-leaderboard-boxes/validation.md`; do not mark the baseline tasks complete without their evidence. (Depends on: none)
- [X] T002 [Foundation] Audit `sdd_artifacts/split-leaderboard-boxes/contracts/leaderboard-rest.md`, `sdd_artifacts/split-leaderboard-boxes/contracts/leaderboard-provider.md`, `workspace/apps/backend/prisma/schema.prisma`, `workspace/apps/backend/prisma/migrations/`, `kb/contracts/events.yaml`, `workspace/apps/backend/src/dashboard/push.gateway.ts`, and `workspace/apps/backend/src/loop/` and record in `sdd_artifacts/split-leaderboard-boxes/validation.md` that the planned change requires no migration, event/socket wire change, room/handshake/namespace, or per-user loop. (Depends on: T001)

**Checkpoint**: Baseline provider/privacy evidence is known, feature contracts are authoritative, and forbidden architecture changes have a recorded pre-implementation baseline.

---

## Phase 2: Backend Scope Contract, Repository, and Controller — RED/GREEN

**Purpose**: Deliver server-authorized System, Mine, and Combined list/detail projections while preserving the current response and default behavior.

### RED Tests

- [X] T003 [P] [US1] Add failing scope enum/pipe and controller delegation tests in `workspace/apps/backend/src/leaderboard/leaderboard.controller.spec.ts` for `system|mine|combined`, omitted/empty default Combined, stable `INVALID_LEADERBOARD_SCOPE`, verified viewer forwarding, and optional scope on both list and detail. (Depends on: T002)
- [X] T004 [P] [US2] Add failing repository tests in `workspace/apps/backend/src/leaderboard/leaderboard.repository.spec.ts` for the single scope-plus-viewer visibility resolver, anonymous Mine short-circuit, symmetric A/B predicates, filter-before-best-per-version/sort/Top-K/rank/`updatedAt`, independent Mine below Combined cutoff, contiguous `1..N`, and scoped detail lookup. (Depends on: T002)
- [X] T005 [P] [US4] Add failing service tests in `workspace/apps/backend/src/leaderboard/leaderboard.service.spec.ts` proving list/detail pass scope and viewer to every repository read, omission remains Combined, anonymous Mine is neutral, and `BacktestCompleted` publication explicitly reads System while preserving the safe payload. (Depends on: T002)
- [X] T006 [P] [US2] Add failing Nest integration scenarios in `workspace/apps/backend/src/leaderboard/leaderboard.integration.spec.ts` for all scopes and criteria, invalid scope, independent timestamps/ranks/Top-K, source-scoped detail, foreign/nonexistent 404 equivalence, and zero Strategy result-port calls for invisible entries. (Depends on: T002)
- [X] T007 [P] [US2] Extend `workspace/apps/backend/test/per-user-leaderboard.e2e-spec.ts` with failing real-HTTP anonymous/A/B symmetric scope tests, omitted-scope compatibility, Mine-below-Combined-Top-K proof, metadata non-disclosure, detail anti-enumeration, and unchanged system-safe `leaderboard:update`. (Depends on: T002)
- [X] T008 [P] [US1] Add failing Combined SCORE regression assertions in `workspace/apps/backend/src/dashboard/dashboard.service.spec.ts` and `workspace/apps/backend/src/dashboard/dashboard.integration.spec.ts`, including viewer identity reaching only Leaderboard while Loop and Queue remain global zero-argument reads. (Depends on: T002)

### GREEN Implementation

- [X] T009 [US1] Implement shared `LeaderboardScope` in `workspace/libs/shared/src/types/enums.ts` and `LeaderboardScopePipe` plus `INVALID_LEADERBOARD_SCOPE` in `workspace/apps/backend/src/leaderboard/leaderboard.dto.ts` exactly per `contracts/leaderboard-rest.md`; preserve `LeaderboardSnapshot` unchanged. (Depends on: T003, T004, T005, T006, T007, T008)
- [X] T010 [US2] Replace the criterion-only visibility helper with one scope-plus-viewer resolver and no-authorized-rows short-circuit in `workspace/apps/backend/src/leaderboard/leaderboard.repository.ts`, applying it before list ranking, scope-local timestamp, and SCORE-best detail without changing Prisma persistence or global `rerank()`. (Depends on: T004, T009)
- [X] T011 [US4] Thread scope through `getLeaderboard` and `getDetail` in `workspace/apps/backend/src/leaderboard/leaderboard.service.ts`, default old call shapes to Combined, and keep event publication explicitly System-scoped without changing event fields. (Depends on: T005, T010)
- [X] T012 [US1] Accept the shared scope pipe on existing list and detail queries in `workspace/apps/backend/src/leaderboard/leaderboard.controller.ts`, retaining `SupabaseJwtGuard`, `@CurrentUser()`, existing paths, response types, and anti-enumeration errors. (Depends on: T003, T009, T011)
- [X] T013 [US1] Make Dashboard request Combined SCORE explicitly in `workspace/apps/backend/src/dashboard/dashboard.service.ts` and reconcile only its affected expectations in `workspace/apps/backend/src/dashboard/dashboard.service.spec.ts` and `workspace/apps/backend/src/dashboard/dashboard.integration.spec.ts`; do not alter Dashboard response or Top-5 composition. (Depends on: T008, T011)
- [X] T014 [Validation] Run the Phase 2 controller/repository/service/integration/Dashboard tests plus `workspace/apps/backend/test/per-user-leaderboard.e2e-spec.ts`, append RED-before-GREEN and final pass evidence to `sdd_artifacts/split-leaderboard-boxes/validation.md`, and verify no foreign rows, identifiers, ranks, counts, or timestamps appear. (Depends on: T006, T007, T010, T011, T012, T013)

**Checkpoint**: The existing REST routes support explicit System/Mine/Combined projections; omission is Combined; anonymous/A/B list and detail isolation is symmetric; Dashboard and event wire remain compatible.

---

## Phase 3: Frontend API Client — RED/GREEN

**Purpose**: Add typed scope requests without changing how authentication is resolved.

- [X] T015 [US2] Create failing API client tests in `workspace/apps/frontend/src/services/api-client.spec.ts` for list/detail scope URL encoding, omitted scope compatibility, existing `sortBy` and `AbortSignal`, ISO date decoding, and bearer token sourced only from the current Supabase session. (Depends on: T014)
- [X] T016 [US2] Extend `getLeaderboard` and `getLeaderboardDetail` in `workspace/apps/frontend/src/services/api-client.ts` with typed scope options using `URLSearchParams`, making T015 GREEN without accepting caller ownership or changing `apiRequest` auth semantics. (Depends on: T015)

**Checkpoint**: Frontend can request authoritative scoped snapshots/details, while legacy omitted-scope and current-session authentication semantics remain unchanged.

---

## Phase 4: App-Level Provider, Cache, Realtime, and Identity — RED/GREEN

**Purpose**: Make scope part of provider state without adding realtime owners or weakening the proven identity boundary.

### RED Tests

- [X] T017 [US4] Add failing scoped projection/cache tests in `workspace/apps/frontend/src/contexts/leaderboard-live-context.spec.tsx` for effective `(viewer, scope, criterion)` uniqueness, v2 exact-viewer envelope, v1 rejection, Combined SCORE retention, System/Mine active-criterion pruning, anonymous Mine HTTP skip, exact-key deduplication, and two scoped reads starting independently. (Depends on: T016)
- [X] T018 [US4] Add failing realtime lifecycle tests in `workspace/apps/frontend/src/contexts/leaderboard-live-context.spec.tsx` for exactly one listener while ON and zero while OFF, subscribe-before-catch-up, safe invalidation/reconnect fan-out to maintained scopes, OFF freeze/abort, route navigation persistence, and explicit proof that `event.topK` is never cached or rendered. (Depends on: T017)
- [X] T019 [US4] Add failing identity/selection tests in `workspace/apps/frontend/src/contexts/leaderboard-live-context.spec.tsx` for scope-aware selection, disappearance after scope/sort refresh, A→B and A→anonymous pre-paint clearing, delayed A System/Mine responses, delayed A detail eligibility, watermark/request generation, and Live preference survival. (Depends on: T018)

### GREEN Implementation

- [X] T020 [US4] Refactor `workspace/apps/frontend/src/contexts/leaderboard-live-context.tsx` to implement projection-keyed state/controllers/generations/watermarks, v2 exact-viewer persistence, independent projection states, maintained Combined SCORE plus System/Mine active criterion, scope-aware selection, parallel/deduplicated scoped REST reconciliation, and the existing single stable listener contract. (Depends on: T017, T018, T019)
- [X] T021 [P] [US3] Add failing consumer tests in `workspace/apps/frontend/src/hooks/use-leaderboard.spec.tsx` for System/Mine projection states, one shared criterion, scope-aware selection/refetch, and zero hook-owned listeners. (Depends on: T020)
- [X] T022 [P] [US4] Add failing Dashboard compatibility tests in `workspace/apps/frontend/src/hooks/use-dashboard-summary.spec.tsx` and `workspace/apps/frontend/src/components/dashboard/leaderboard-preview.spec.tsx` proving only provider Combined SCORE is consumed, the preview remains Top-5/one-box, and Dashboard registers zero leaderboard listeners. (Depends on: T020)
- [X] T023 [US3] Refactor `workspace/apps/frontend/src/hooks/use-leaderboard.ts` into a scoped provider consumer exposing independent System/Mine state, shared criterion, scope-aware selection, and per-projection retry, making T021 GREEN without socket ownership. (Depends on: T021)
- [X] T024 [US4] Adapt `workspace/apps/frontend/src/hooks/use-dashboard-summary.ts` only as needed for the new provider surface while retaining Combined SCORE and existing global loop/queue behavior; make T022 GREEN without changing `workspace/apps/frontend/src/components/dashboard/leaderboard-preview.tsx` production UI. (Depends on: T022)
- [X] T025 [Validation] Run `workspace/apps/frontend/src/contexts/leaderboard-live-context.spec.tsx`, `workspace/apps/frontend/src/hooks/use-leaderboard.spec.tsx`, and `workspace/apps/frontend/src/hooks/use-dashboard-summary.spec.tsx`; record cache collision, request-count, listener-count, reconnect, OFF freeze, Dashboard, and identity-race evidence in `sdd_artifacts/split-leaderboard-boxes/validation.md`. (Depends on: T020, T023, T024)

**Checkpoint**: One app-level provider safely maintains scoped projections and Combined Dashboard SCORE; two cards create no listeners; old identity/cache/responses are ineligible to render or commit.

---

## Phase 5: Components, Public Route, and Two-Box Page — RED/GREEN

**Purpose**: Render the full two-box experience with independent states, shared selection/detail, and accessible desktop/mobile layout.

### RED Tests

- [X] T026 [P] [US5] Extend `workspace/apps/frontend/src/components/leaderboard/leaderboard-table.spec.tsx` with failing reusable-card tests for supplied heading/description/heading ID/table name/source scope, independent loading/error/stale/empty/retry rendering, retained financial columns, keyboard sort/selection, and a dedicated horizontal scroll region. (Depends on: T025)
- [X] T027 [P] [US3] Extend `workspace/apps/frontend/src/components/leaderboard/leaderboard-detail.spec.tsx` with failing source-scope URL, authorized System/Mine selection, stable 404, retry, disappearing selection, and late old-viewer/scope response suppression tests. (Depends on: T025)
- [X] T028 [P] [US5] Create failing route tests in `workspace/apps/frontend/src/app/leaderboard/page.spec.tsx` for System/My headings and unique table names, one shared criterion, anonymous sign-in, empty Mine `/strategy` CTA, independent partial loading/error/stale states, desktop vertical table stack with shared detail, and mobile System→Mine→Detail source order. (Depends on: T025)
- [X] T029 [P] [US1] Create failing middleware tests in `workspace/apps/frontend/src/middleware.spec.ts` proving anonymous `/leaderboard` is public, login/register behavior is retained, and unrelated protected routes still redirect with their original destination. (Depends on: T025)

### GREEN Implementation

- [X] T030 [US5] Generalize `workspace/apps/frontend/src/components/leaderboard/leaderboard-table.tsx` with named card/table props and independent state rendering while preserving deterministic columns, financial formatting, keyboard controls, and one per-card horizontal scroller. (Depends on: T026)
- [X] T031 [US3] Make `workspace/apps/frontend/src/components/leaderboard/leaderboard-detail.tsx` accept source scope and reject stale detail commits by current selection/viewer generation through the provider contract, preserving existing detail response/error presentation. (Depends on: T027)
- [X] T032 [US1] Add `/leaderboard` to the public route policy in `workspace/apps/frontend/src/middleware.ts`, leaving all other route and Supabase session behavior unchanged. (Depends on: T029)
- [X] T033 [US5] Refactor `workspace/apps/frontend/src/app/leaderboard/page.tsx` to render one shared criterion control, vertically stacked System and Mine cards in the ranking column, one shared detail column, anonymous sign-in state, authenticated empty Mine CTA, independent states/retries, and mobile System→Mine→Detail order without filtering Combined data. (Depends on: T023, T028, T030, T031, T032)
- [X] T034 [Validation] Run the table/detail/page/middleware tests plus `workspace/apps/frontend/src/components/common/app-shell.spec.tsx`; record unique accessible names, keyboard actions, partial-state independence, desktop composition, mobile order/scroll, anonymous route, and zero listener ownership evidence in `sdd_artifacts/split-leaderboard-boxes/validation.md`. (Depends on: T030, T031, T032, T033)

**Checkpoint**: `/leaderboard` independently renders System and Mine with shared sort/detail; anonymous access, empty/error/stale behavior, accessibility, and responsive layout satisfy the spec without changing Dashboard.

---

## Phase 6: Cross-Stack E2E Matrix

**Purpose**: Prove behavior across actual HTTP, provider, socket invalidation, browser storage, route transitions, and responsive rendering.

- [ ] T035 [US4] Extend `workspace/apps/frontend/e2e/infrastructure-fixture.mjs` with deterministic System/A/B scoped list/detail responses, independent delays/failures/timestamps, scope request logging, identity switches, reconnect control, and misleading safe-event `topK`; add no production room, handshake, namespace, private payload, or client authorization filter. (Depends on: T014, T016, T025)
- [ ] T036 [US4] Extend `workspace/apps/frontend/e2e/leaderboard.spec.ts` for anonymous/A/B symmetric non-disclosure, Mine below Combined cutoff, empty Mine, shared sort, System/Mine detail, foreign/nonexistent anti-enumeration, independent loading/error/stale/retry, invalidation, reconnect ON/OFF, A→B, A→anonymous, delayed old responses, exact cache scope keys, one listener, Dashboard Combined regression, desktop stack, and mobile order/separate scroll. (Depends on: T034, T035)
- [ ] T037 [Validation] Execute the backend `workspace/apps/backend/test/per-user-leaderboard.e2e-spec.ts` and frontend `workspace/apps/frontend/e2e/leaderboard.spec.ts` once as a cross-stack checkpoint, recording failures by scenario and confirming request/listener/loop-command counts in `sdd_artifacts/split-leaderboard-boxes/validation.md`. (Depends on: T007, T014, T036)

**Checkpoint**: Automated E2E covers every required actor, privacy boundary, realtime/reconnect/identity race, UI state, and responsive scenario with unchanged Dashboard/global-loop/socket semantics.

---

## Phase 7: Full Validation and Documentation

**Purpose**: Close quality gates, manual privacy proof, architecture audit, and KB consistency after implementation.

- [ ] T038 [Validation] Run targeted backend Jest suites for `workspace/apps/backend/src/leaderboard/` and `workspace/apps/backend/src/dashboard/` plus the backend scoped E2E, recording commands, counts, and results in `sdd_artifacts/split-leaderboard-boxes/validation.md`. (Depends on: T037)
- [ ] T039 [Validation] Run targeted frontend Vitest suites for API client, provider, hooks, leaderboard components/page, middleware, Dashboard preview, app shell, and infrastructure socket listener regressions; record commands and results in `sdd_artifacts/split-leaderboard-boxes/validation.md`. (Depends on: T038)
- [ ] T040 [Validation] Run TypeScript checks and production builds for `workspace/libs/shared`, `workspace/apps/backend`, and `workspace/apps/frontend` using the exact workspace scripts, appending results to `sdd_artifacts/split-leaderboard-boxes/validation.md`. (Depends on: T039)
- [ ] T041 [Validation] Run configured lint plus non-mutating formatting/diff checks for the exact feature-owned shared/backend/frontend/artifact paths, inspect dirty files before and after, run `git diff --check`, and record repository-wide unrelated debt separately without auto-fixing it in `sdd_artifacts/split-leaderboard-boxes/validation.md`. (Depends on: T040)
- [ ] T042 [Validation] Run the full backend E2E suite and full frontend Playwright suite, including `workspace/apps/backend/test/per-user-leaderboard.e2e-spec.ts` and `workspace/apps/frontend/e2e/leaderboard.spec.ts`, and append deterministic pass/fail evidence to `sdd_artifacts/split-leaderboard-boxes/validation.md`. (Depends on: T041)
- [ ] T043 [Validation] Execute and document all 14 scenarios in `sdd_artifacts/split-leaderboard-boxes/quickstart.md` with manual anonymous/A/B symmetric checks, cache inspection, detail anti-enumeration, Live ON/OFF, reconnect, identity switches, desktop/mobile accessibility, Dashboard Combined preview, and zero Search Loop commands. (Depends on: T042)
- [ ] T044 [Validation] Re-audit `workspace/apps/backend/prisma/schema.prisma`, `workspace/apps/backend/prisma/migrations/`, `kb/contracts/events.yaml`, `workspace/apps/backend/src/dashboard/push.gateway.ts`, and `workspace/apps/backend/src/loop/`, then update approved feature truth in `kb/modules/event-infrastructure.md`, `kb/flows/leaderboard-update.md`, `kb/DESIGN.md`, and `kb/GLOSSARY.md` without documenting any migration/socket/per-user-loop change; record final Constitution PASS in `sdd_artifacts/split-leaderboard-boxes/validation.md`. (Depends on: T043)

**Final checkpoint**: Every task has evidence; scoped list/detail and two-card UI satisfy all stories; Combined/Dashboard compatibility, one-listener realtime, identity isolation, mobile accessibility, schema/socket/global-loop non-interference, and manual A/B symmetry are recorded.

---

## Dependencies and Execution Order

### Phase Dependencies

1. **Phase 1** establishes the baseline and blocks production edits.
2. **Phase 2** depends on Phase 1; all backend RED tests T003-T008 precede GREEN T009-T013 and validation T014.
3. **Phase 3** depends on backend contract validation T014; API RED T015 precedes GREEN T016.
4. **Phase 4** depends on scoped API T016; provider RED tasks T017-T019 are sequential because they edit the same test file, then GREEN T020; consumer RED branches T021/T022 may run in parallel before T023/T024.
5. **Phase 5** depends on provider checkpoint T025; component/page/middleware RED tasks T026-T029 may run in parallel because their files are disjoint, then their corresponding GREEN tasks complete before page integration T033.
6. **Phase 6** depends on backend, provider, and UI checkpoints; fixture T035 precedes Playwright scenarios T036, then cross-stack execution T037.
7. **Phase 7** is a sequential evidence chain because each task appends to the same validation record and later gates depend on earlier results.

### Critical Path

`T001 -> T002 -> (T003-T008) -> T009 -> T010 -> T011 -> T012 -> T014 -> T015 -> T016 -> T017 -> T018 -> T019 -> T020 -> T021 -> T023 -> T025 -> T028 -> T033 -> T034 -> T035 -> T036 -> T037 -> T038 -> T039 -> T040 -> T041 -> T042 -> T043 -> T044`

Dashboard compatibility joins through `T008 -> T013 -> T014` and `T020 -> T022 -> T024 -> T025`.

### Parallel Opportunities

- T003-T008: six backend RED tasks own different test files after T002.
- T021 and T022: Leaderboard consumer tests and Dashboard consumer regression tests own different files after T020.
- T026-T029: table, detail, page, and middleware RED tests own different files after T025.
- No provider RED tasks are marked `[P]` because T017-T019 share `leaderboard-live-context.spec.tsx` and build on one state contract.
- No validation tasks are marked `[P]` because they append evidence to the same `validation.md` and form release gates.

**Parallel task count**: 12.

---

## Story Coverage

| Story | Primary task coverage |
|---|---|
| US1 — separate rankings and compatibility | T003-T014, T015-T017, T020-T026, T028-T030, T032-T036 |
| US2 — list/detail privacy | T004-T007, T010-T12, T15-T16, T27, T31, T35-T38, T43 |
| US3 — shared sort and detail | T005-T006, T11-T12, T19-T20, T21-T23, T27-T28, T31-T36 |
| US4 — realtime and identity | T005, T007, T11, T17-T20, T22, T24-T25, T35-T37, T43-T44 |
| US5 — independent/responsive UI states | T026, T028, T030, T033-T36, T39, T42-T43 |

All FR-001..FR-035 and SC-001..SC-012 are covered by implementation tasks plus Phase 6/7 evidence. No task creates a migration, socket room/handshake/namespace/private payload, client authorization filter, or per-user Search Loop.

---

## Implementation Strategy

### Backend Contract Slice

Complete T001-T014 first. This yields independently testable scoped REST list/detail behavior with Combined backward compatibility, Dashboard regression, and symmetric anonymous/A/B privacy before frontend work begins.

### Provider Slice

Complete T015-T025 next. The API and provider become scope-aware while preserving one listener, Combined SCORE, exact-viewer cache isolation, reconnect behavior, and OFF freeze.

### Two-Card MVP Slice

Complete T026-T034. At this checkpoint the full `/leaderboard` route delivers the requested System/My cards, shared sort/detail, independent states, anonymous access, and responsive accessibility without relying on E2E fixture behavior.

### Release Slice

Complete T035-T044. Release only after automated and manual anonymous/A/B matrices, delayed identity races, listener/request counts, Dashboard compatibility, Playwright/mobile, build/lint/diff, and no-migration/socket/global-loop audits have recorded evidence.
