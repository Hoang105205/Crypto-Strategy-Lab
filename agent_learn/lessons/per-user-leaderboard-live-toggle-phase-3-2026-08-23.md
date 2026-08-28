# Lessons: Per-user Leaderboard Live Toggle Phase 3 — 2026-08-23

## What Worked

- Class-level optional auth gives all six Loop routes a consistent request identity boundary without changing their service calls.
- A three-actor HTTP test paired with serialized Prisma call/record inspection proves more than response equality: viewer identity never reaches global loop persistence.
- Interpreting audit matches by role distinguishes the required `SEARCH_LOOP userId: null` producer invariant from a prohibited owner field on loop entities.

## What Didn't Work

- The first RED integration run had a missing Supertest import, so it was discarded as fixture evidence and rerun after repairing the test.
- Existing isolated controller/module harnesses initially attempted to instantiate real Auth dependencies after the class guard and AuthModule import; explicit guard/provider overrides restored their intended isolation.

## Deviations from Plan

- The task text refers to `strategy-loop.repository.ts`, but the real persistence file is `loop.repository.ts`. The existing file was audited and left unchanged; no alias or new repository was introduced.
- `loop.module.spec.ts` was updated in addition to the two T018 test files because the required AuthModule import otherwise broke the full Loop regression gate. This is test-only fixture alignment.

## KB Updates Needed

- [ ] Reconcile `kb/flows/strategy-search-loop.md` with the authoritative 2026-08-18 decision: the system loop is global and frontend users do not own lifecycle commands.
- [ ] Update the Event Infrastructure module documentation after feature approval to note optional-auth context at LoopController without downstream scoping.
- [ ] No new ADR is needed; the implementation follows the existing global-loop decision and auth contract.
