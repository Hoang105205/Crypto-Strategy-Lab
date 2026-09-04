# Lessons: Current User Display and Logout — 2026-09-03

Feature: `current-user-display-logout` — far-right top-nav identity section + `POST /api/auth/logout` + secure client logout/redirect.

## What Worked
- **Contract-first rename caught a latent bug.** `AuthController` was `@Controller('auth')` while every other controller embeds `api/` (no NestJS global prefix). Renaming to `@Controller('api/auth')` aligned `GET /api/auth/me` with `kb/contracts/auth.yaml` and enabled `/api/auth/logout`. A grep for `auth/me|auth/logout|api/auth` (0 hits) proved the rename was safe before touching it.
- **Resolved "token revocation" vs stateless-JWT honestly.** Supabase JWTs are verified via JWKS and the backend holds no session store, so `POST /api/auth/logout` is a JWT-guarded *acknowledgement/audit* hook; `supabase.auth.signOut()` remains the authoritative revocation. A Redis denylist would violate Constitution IV (YAGNI). Documented in spec Assumptions, research D3, the contract, and KB.
- **Mock the module graph to keep env-dependent singletons out of tests.** `user-nav-section.spec.tsx` mocks both `../../services/api-client` and `../../contexts/auth-context` so the real `supabase-client` (which reads `process.env` at module load) never enters the graph. In `app-shell.spec.tsx`, mocking the whole `../auth/user-nav-section` module avoided needing an `AuthProvider` and a `useRouter` mock.
- **Kept pending state testable.** Removing `setIsOpen(false)` from `handleLogout` keeps the Log Out button mounted so the disabled/"Logging out..." state is assertable.
- **Order assertion via `invocationCallOrder`.** Proved logout → signOut → `router.replace('/login')` sequencing deterministically.

## What Didn't Work
- **`tsc --noEmit` red herring.** Both apps initially failed tsc with `Module '"@crypto-strategy-lab/shared"' has no exported member 'LeaderboardScope' / 'IStrategyAnalysisSession'`. Root cause was a **stale `libs/shared/dist`** — the symbols existed in `src/` but not the built `.d.ts`. `npm run build` in `libs/shared` cleared the frontend entirely (exit 0) and removed those errors from the backend. Lesson: when a monorepo reports "no exported member" for a local lib, rebuild the lib before suspecting feature code.
- **Remaining backend tsc errors are genuinely out of scope** — stale Prisma client (`SearchLoopControl` not generated) + `userId` payload drift in `event-bus.spec.ts`, `dashboard.service.spec.ts`, `leaderboard/*`, `loop/*`, `queue/*`. `git status` confirmed none are in this feature's 9-file changeset.

## Deviations from Plan
- Endpoint path is `/api/auth/logout` (KB-namespaced), not the prompt's literal `/api/logout` — Constitution V (KB as truth).
- Dropdown "chip" variant chosen over an inline button (spec allowed either); uses only existing `@theme` tokens (`surface-card`, `surface-elevated`, `hairline-dark`, `body`, `muted`, `info` focus ring). Avoided non-existent tokens (`body-secondary`, `border`, `info-ring`).

## KB Updates Needed
- [x] Update `kb/contracts/auth.yaml`: `POST /api/auth/logout` marked IMPLEMENTED; `GET /api/auth/me` response corrected to `{ id }` with controller path `api/auth`.
- [x] Update `kb/modules/auth.md`: AuthController row, new `UserNavSection` frontend row, §6 API Surface logout semantics.
- [ ] No `kb/ARCHITECTURE.md` / `kb/MODULES.md` change (no new module, no boundary shift).
- [ ] No new ADR (reuses ADR-0015 Supabase Auth; deliberately no revocation-store ADR per Constitution IV).
- [ ] **Repo hygiene (not this feature):** rebuild `libs/shared` and run `prisma generate` in CI/dev bootstrap so stale-dist and stale-client tsc errors stop masking feature work; fix `userId` drift in the events/dashboard/leaderboard specs.
