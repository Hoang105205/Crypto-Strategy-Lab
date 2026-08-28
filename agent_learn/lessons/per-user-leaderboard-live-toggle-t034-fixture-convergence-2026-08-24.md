# Lessons: Per-user Leaderboard Live Toggle T034 Fixture Convergence — 2026-08-24

## What Worked

- Typed fixture reconciliation kept required ownership explicit: USER payloads use a UUID and SEARCH_LOOP/completion fixtures use `null`.
- Splitting the discriminated USER/SEARCH_LOOP fixture branches removed the unsafe broad cast without weakening the shared contract.
- Running the exact backend and frontend task suites proved both fixture compatibility and zero page-level leaderboard listeners.

## What Didn't Work

- The first Redis-backed test run waited for the unavailable Redis prerequisite; starting the existing Docker Compose Redis service was required before rerunning the gate.
- Repository-wide backend TypeScript remains red because of pre-existing fixture drift in files outside the exact T034 file list.

## Deviations from Plan

- No production behavior changed. Only three backend fixture files, the T034 checkbox, and this required learning record changed.
- T035–T042 were not executed.

## KB Updates Needed

- [ ] None for T034; wire fields, auth semantics, module boundaries, and E2E flows were unchanged.
