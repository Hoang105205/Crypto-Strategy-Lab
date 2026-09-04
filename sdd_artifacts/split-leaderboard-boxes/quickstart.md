# Quickstart Validation: Split Leaderboard Boxes

**Feature**: `split-leaderboard-boxes` | **Purpose**: implementation and release verification

This document defines the expected validation sequence after `/hoang-sdd-implement`. It does not authorize changing schemas, socket protocols, or Search Loop ownership.

## Preconditions

1. Install workspace dependencies from `workspace/`.
2. Start PostgreSQL and Redis using the existing project compose/configuration.
3. Use deterministic fixtures containing System entries, user A entries, user B entries, duplicate backtests for one strategy version, and enough rows to place at least one Mine entry below the Combined Top-K cutoff.
4. Use the existing optional-auth test fakes or configured Supabase sessions for anonymous, A, and B.
5. Record baseline status of `per-user-leaderboard-live-toggle` T041 and T042; these must be completed or incorporated into the final validation record.

## Contract Inspection

Confirm before running tests:

- `LeaderboardScope` contains only `system`, `mine`, `combined`.
- List and detail use the same scope pipe.
- Omitted scope defaults to combined.
- Repository list/timestamp/detail call one shared scope-plus-viewer visibility resolver.
- `LeaderboardSnapshot` response shape is unchanged.
- `leaderboard:update` event schema and PushGateway relay are unchanged.
- Prisma schema/migrations and global Search Loop entities are unchanged.
- Dashboard preview still consumes Combined SCORE.

## Targeted Automated Commands

Run from `workspace/`.

### Shared and Backend

```powershell
npm.cmd run build -w @crypto-strategy-lab/shared
npm.cmd run test -w @crypto-strategy-lab/backend -- --runInBand leaderboard.dto leaderboard.controller leaderboard.repository leaderboard.service leaderboard.integration dashboard
npm.cmd run test:e2e -w @crypto-strategy-lab/backend -- --runInBand per-user-leaderboard.e2e-spec.ts
```

### Frontend

```powershell
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/contexts/leaderboard-live-context.spec.tsx src/hooks/use-leaderboard.spec.tsx src/components/leaderboard/leaderboard-table.spec.tsx src/components/leaderboard/leaderboard-detail.spec.tsx src/app/leaderboard/page.spec.tsx src/middleware.spec.ts
npm.cmd run test -w @crypto-strategy-lab/frontend -- src/hooks/use-dashboard-summary.spec.tsx src/components/dashboard/leaderboard-preview.spec.tsx src/components/common/app-shell.spec.tsx
npm.cmd run test:e2e -w @crypto-strategy-lab/frontend -- e2e/leaderboard.spec.ts
```

If a listed new test file is not yet present, that is expected before task generation/implementation and is a failing contract gate, not a reason to skip its coverage.

### Build and Diff Gates

```powershell
npm.cmd run build
git diff --check
```

Run repository lint as a diagnostic under the existing feature-scoped policy. Do not auto-fix unrelated dirty files.

## Acceptance Scenario 1: Anonymous

1. Open `/leaderboard` without a session.
2. Confirm middleware does not redirect.
3. Confirm System Leaderboard contains only `userId=null` fixtures.
4. Confirm My Strategies shows a named sign-in state and keyboard-reachable sign-in action.
5. Confirm no Mine HTTP response/cache contains A or B data.
6. Directly call list with omitted scope and confirm legacy anonymous System-only behavior.

**Pass**: no private row, identifier, count, rank effect, or timestamp is visible.

## Acceptance Scenario 2: User A

1. Authenticate as A and open `/leaderboard`.
2. Confirm System contains only null-owned rows.
3. Confirm Mine contains only A-owned rows, including an A row intentionally below Combined Top-K.
4. Confirm each card independently has at most Top-K rows and ranks exactly `1..N`.
5. Confirm omitted-scope REST and Dashboard preview contain legacy System + A combined behavior.

**Pass**: B rows and B metadata never appear.

## Acceptance Scenario 3: User B

Repeat the A scenario as B and assert exact symmetry: Mine contains only B; no A row/metadata/detail/cache appears; System remains identical for the same criterion and fixture time.

## Acceptance Scenario 4: Empty Mine

1. Authenticate a user with no leaderboard entry.
2. Confirm System remains populated and usable.
3. Confirm My Strategies shows its explanation and one primary `/strategy` CTA.
4. Confirm Mine timestamp is neutral and does not copy System or another user.

## Acceptance Scenario 5: Shared Sort

1. Change criterion through every existing `RankingCriterion`.
2. Confirm both cards show the same active criterion.
3. Confirm each scope independently selects best-per-version, sorts, truncates, and reranks.
4. Confirm a still-visible selected strategy remains selected; one absent from its source projection clears.
5. Confirm no backtest or loop command is sent.

## Acceptance Scenario 6: Independent Loading/Error/Stale

1. Delay Mine while System succeeds; then reverse.
2. Fail one projection with no snapshot and confirm only that card shows retryable initial error.
3. Accept a projection, fail its refresh, and confirm same-identity stale data plus its own timestamp remains.
4. Retry the failed projection and confirm the other card is not cleared or refetched unnecessarily.

## Acceptance Scenario 7: Realtime Refresh

1. Turn Live ON and confirm provider listener count is exactly one.
2. Emit `leaderboard:update` containing misleading `topK` fixture rows.
3. Confirm event rows are never rendered or cached.
4. Confirm one authoritative REST call occurs per distinct maintained projection: Combined SCORE plus System/Mine active criterion as applicable.
5. Confirm two cards add no listener.
6. Turn Live OFF and confirm listener count is zero and accepted snapshots freeze.

## Acceptance Scenario 8: Reconnect

1. With Live ON, disconnect/reconnect Infrastructure.
2. Confirm maintained current-viewer scoped REST projections reconcile.
3. With Live OFF, repeat reconnect.
4. Confirm no automatic leaderboard read and no implicit preference change.
5. Confirm shared socket remains connected/owned by Infrastructure; no card calls disconnect.

## Acceptance Scenario 9: Identity Switch

1. Load A System/Mine and select an A Mine strategy.
2. Delay an A Mine list response and A detail response.
3. Switch A -> B before both resolve.
4. Inspect every rendered frame and localStorage envelope.
5. Resolve delayed A responses successfully.
6. Repeat A -> anonymous.

**Pass**: no A row, rank, timestamp, stale label, cache, selection, or detail renders or commits after the boundary; Live preference is unchanged.

## Acceptance Scenario 10: Detail Anti-Enumeration

For anonymous, A, and B, request:

- a visible System detail using `scope=system`;
- own Mine detail using `scope=mine`;
- foreign existing private ID;
- nonexistent UUID;
- system ID under Mine;
- own private ID under System.

**Pass**: valid visible cases succeed; all unauthorized/nonexistent cases have the same stable 404 body, and unauthorized cases never call the Strategy result port.

## Acceptance Scenario 11: Dashboard Compatibility

1. Open Dashboard as A and B.
2. Confirm preview remains one Combined SCORE Top-5 view.
3. Confirm navigation to `/leaderboard` does not split or mutate Dashboard UI.
4. Return to Dashboard after scoped invalidation and confirm combined cache remains authoritative.

## Acceptance Scenario 12: Mobile and Accessibility

1. Use the project Playwright mobile viewport.
2. Confirm DOM/visual order: System Leaderboard, My Strategies, Strategy Detail.
3. Confirm each populated leaderboard table has its own horizontal scrolling region.
4. Confirm every financial column remains present.
5. Confirm unique region headings and table accessible names.
6. Keyboard-test sort, row selection, retry, sign-in, and `/strategy` CTA.
7. Confirm stale/error/selection state is not conveyed by color alone.

## Acceptance Scenario 13: Desktop Composition

1. Use a desktop viewport.
2. Confirm System and Mine tables are stacked vertically in the ranking column, never side by side.
3. Confirm the shared detail panel is visibly associated with the workspace and both tables retain usable width.

## Acceptance Scenario 14: Non-Interference Audit

During sort, selection, retry, route navigation, Live toggle, invalidation, reconnect, and identity switch:

- assert zero Search Loop start/pause/resume/stop commands;
- assert no Prisma migration or ownership field change;
- assert no socket room, auth handshake, namespace, or private payload change;
- assert `leaderboard:update` remains system-only safe invalidation;
- assert no client filtering is used as an authorization boundary.

## Release Result

Release passes only when all targeted/full tests, builds, Playwright scenarios, T041/T042 carried-forward evidence, schema/wire audits, and the 14 scenarios above are recorded without cross-user leakage or listener duplication.

