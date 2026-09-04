# Lessons: Event Infrastructure Dashboard T028 — 2026-08-16

## What Worked

- Dynamic target loading plus explicit existence assertions produced an intentional RED state without TypeScript import-path failures; the complete behavior matrix still compiles and becomes active when T030 adds the production targets.
- A stateful Prisma Proxy exposes only `searchLoopRun`, `searchLoopCandidate`, and `$transaction`, making Event Infrastructure ownership executable while rejecting accidental Strategy-owned delegate access.
- The fake active-run read captures state before yielding. Concurrent `createRun()` calls therefore expose a check-then-create race unless T030 supplies the required application mutex around its transactional re-check.
- Separate `JOB_NOT_FOUND` and `QUEUE_UNAVAILABLE` restart fixtures prevent a temporary Redis outage from being misclassified as an unrecoverable orphan.

## What Didn't Work

- The first formatting check reported both new test files because the initial patch had not been normalized by the repository Prettier configuration. Formatting only those two files resolved the issue without changing behavior.

## Deviations from Plan

- T028 coverage was expanded beyond the task summary to include concurrent candidate insertion, terminal-run late completion, explicit absence of an in-flight candidate, dependency-unavailable restart behavior, and a Prisma ownership tripwire. These cases implement the user's requested race, late-result, and error-discrimination detail without changing production scope.
- The RED suites use local contract interfaces for the future T030 exports. This allows the test files to compile before `loop.repository.ts` and `loop-status.service.ts` exist and makes the expected public behavior explicit.

## KB Updates Needed

- [ ] None identified; T028 encodes the active Search Loop flow, data-model invariants, and queue error semantics without changing them.
