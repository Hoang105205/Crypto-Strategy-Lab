# Lessons: Split Leaderboard Boxes Phase 2 — 2026-08-25

## What Worked

- A single discriminated visibility resolver kept System, Mine, Combined, and anonymous-Mine behavior identical across list, timestamp, and detail reads.
- Keeping scope as the third optional argument preserved old service/repository call shapes while allowing event and Dashboard callers to state System/Combined intent explicitly.
- Seeding Mine entries below the Combined cutoff made filter-before-Top-K executable rather than relying on ownership-only assertions.
- Hashing schema, event, gateway, and Loop files before and after implementation made the non-interference boundary objective in a dirty worktree.

## What Didn't Work

- The first service GREEN run retained two pre-scope mock expectations. They correctly failed when production began passing explicit System/Combined and had to be reconciled before claiming T011.
- A whole-file Prettier write was unsafe because Phase 2 files already contained user-owned dirty changes. The check was recorded without mutating unrelated hunks.

## Deviations from Plan

- No functional deviation. The E2E scoped scenario was strengthened after the first GREEN run to compare System across anonymous/A/B and assert scope-local timestamps explicitly.
- Formatting convergence is deferred to the later feature-scoped validation gate instead of using a mutating whole-file command during Phase 2.

## KB Updates Needed

- [ ] Update `kb/modules/event-infrastructure.md` after the full feature is accepted so it documents explicit System/Mine/Combined REST projections.
- [ ] Update `kb/flows/leaderboard-update.md` after frontend scoped reconciliation is implemented and validated.
- [ ] Update `kb/GLOSSARY.md` after the two-card feature is complete.
- [ ] No new ADR is needed; ADR-0011 and ADR-0016 remain authoritative.
