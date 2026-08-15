# Lessons: Event Infrastructure Dashboard Phase 0 — 2026-08-12

## What Worked

- A feature-local executable contract audit made checkbox completion evidence-based without coupling verification to unfinished BullMQ or Prisma work.
- Discriminated `BacktestRequestedPayload` branches encode the USER/null and SEARCH_LOOP/required Loop ID invariant at compile time.
- Strategy-owned persistence and execution remain replaceable by exposing ports and centralized DI tokens from shared boundaries.
- A review-only migration can safely encode ownership uncertainty: deterministic fields may be backfilled, while producer identities require an empty-table guard instead of fabricated values.
- Small executable env and type-contract suites provide a fast Phase 0 gate before BullMQ adapter implementation begins.

## What Didn't Work

- Shared lint cannot run until the workspace provides an ESLint 9 flat configuration.
- The whole backend build is currently blocked by pre-existing implicit-`any` errors in the News module, so the strict shared build is the clean compilation evidence for this phase.
- Vitest/esbuild config loading required execution outside the filesystem sandbox on Windows because it resolves ancestor directories; the unchanged smoke test passed there.

## Deviations from Plan

- T001 required no KB edits because its referenced contract, ADR, module, and flows were already reconciled; an executable audit records that evidence instead.
- Phase 0 resumed on 2026-08-13 for T004-T006 and stopped at the requested Phase 0 checkpoint.
- The Prisma migration was authored for schema-owner review but deliberately not applied.

## KB Updates Needed

- [ ] None identified for T001-T006; the active KB and feature contracts agree.
- [ ] New ADR needed: No.
