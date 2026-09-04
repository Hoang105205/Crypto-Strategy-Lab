# Lessons: Per-User Leaderboard Live Toggle Cross-Route Provider — 2026-08-24

## What Worked

- A root client provider below Auth and Infrastructure is the explicit React lifetime boundary needed to survive route replacement without a module singleton.
- Viewer-key render gating plus AbortController, identity generation, per-criterion request generation, and REST snapshot watermarks jointly prevent both stale commits and a prior-viewer render flash.
- Persisting one replaceable, exact-viewer cache envelope preserves OFF across restart without retaining multiple users' private snapshots in browser storage.
- Keeping Dashboard loop/queue state in `useDashboardSummary` while replacing its leaderboard projection with provider SCORE Top-5 preserves global infrastructure behavior and removes private page cache ownership.
- RED source/consumer tests made the listener transfer observable before root wiring and hook refactors.
- Treating ON -> OFF as an abort plus request-generation boundary freezes the exact accepted snapshot even when a Live reconciliation was already in flight.
- Pruning both memory and persistence to SCORE plus the current active criterion makes a later criterion revisit reconcile through REST instead of displaying an abandoned stale snapshot while ON.
- A stateful Socket.IO/HTTP browser fixture can prove current-session off-route reconciliation, reconnect, identity changes, and delayed-response rejection without adding any production socket protocol.
- An E2E Nest application with production controllers/services/repository/event bus/gateway and deterministic external adapters gives process-boundary privacy evidence without requiring Supabase or PostgreSQL test accounts.
- Running the root Turborepo build is a reliable three-package production gate after explicit per-package `tsc --noEmit` checks; it proves shared declarations, Nest output, and Next route generation in dependency order.
- Hashing dirty files before and after a configured write-capable lint command gives concrete evidence that pre-existing worktree changes were not silently rewritten.
- A package with ESLint 9 needs its own discoverable flat config when its workspace script executes from that package directory; a minimal type-checked config fixes configuration discovery without weakening rules.
- Converting async test fakes to explicit `Promise.resolve`, typing HTTP response seams, and representing mocks as function properties can satisfy strict lint while preserving the exercised behavior.

## What Didn't Work

- Removing the cache envelope before reading it prevented valid same-viewer OFF hydration; reading first, then removing only missing/mismatched/malformed envelopes preserves restart behavior and still clears A on A→B/A→anonymous.
- Creating an injected mock function inside a render-hook callback changed effect dependencies on every render and caused a test-only update loop; dependency fakes must have stable identity.
- Vitest/esbuild needed an unsandboxed run in this Windows workspace because config resolution traversed a parent directory denied by the sandbox.
- Removing only the socket handler on OFF was insufficient: a previously-started request could still pass viewer/request checks and commit after the user's freeze boundary.
- Retaining every previously visited ranking criterion allowed stale non-active snapshots to survive and be reused without a new REST reconciliation.
- Browser contexts that remain open with persisted ON are real additional provider owners; restart/OFF measurements must close the original browser before counting invalidation requests.
- Next route prefetch performed while anonymous can cache an auth redirect; E2E login must wait for the Supabase cookie and load a fresh authenticated document before measuring client-side navigation.
- The root lint gate cannot pass while shared has no ESLint 9 flat config; backend/frontend also carry broad lint and formatting debt, so release validation must remain pending instead of auto-fixing hundreds of unrelated files.
- Even after every exact feature path reaches zero lint errors, a root Turborepo lint remains a repository-wide policy gate; unrelated Strategy UI and backend lint debt must not be relabeled as a feature defect or silently baselined.

## Deviations from Plan

- `app/page.tsx` required no production edit because it already consumed the stable `useDashboardSummary` facade; the hook now composes provider SCORE Top-5, so the existing page wiring remains correct.
- The root-order assertion reads `src/app/layout.tsx` as a contract test instead of mounting the Next.js server root layout with font/runtime dependencies.
- Anonymous frontend cache isolation is observable in the root provider on `/login`, but the current production middleware prevents rendering the anonymous `/leaderboard` route; backend E2E remains the rendered-data authority unless Auth routing semantics are separately changed.
- T039 passed without production changes. T040 remains pending because repository-wide lint/format configuration and debt are outside a bounded validation-only correction; no unrelated rewrite was accepted.
- T040 convergence added only the missing shared lint configuration and corrected exact feature files. Root lint still fails outside scope, so T040 correctly remains pending and T041-T042 remain untouched.

## KB Updates Needed

- [ ] None. Implementation follows the 2026-08-24 KB ownership, persistence, identity, and global-loop decisions.
