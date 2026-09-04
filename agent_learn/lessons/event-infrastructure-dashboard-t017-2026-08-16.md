# Lessons: Event Infrastructure Dashboard T017 — 2026-08-16

## What Worked

- PostgreSQL unique `DeadLetterJob.jobId` made terminal mirroring create-once even under concurrent inserts.
- A conditional `updateMany` on `resolvedAt=null` provided a database claim so only one manual retry request could call Redis requeue.
- Keeping the claim and bounded Redis requeue inside an interactive transaction rolled back `resolvedAt` when Redis rejected the request.
- Canonical payload comparison distinguished an idempotent P2002 replay from conflicting reuse of the same producer job ID.
- Stable Queue errors and last-error sanitization prevented raw dependency details and credentials from escaping the repository boundary.

## What Didn't Work

- The original T013 rollback assertion expected a raw Redis exception, which contradicted T017's stable error-taxonomy requirement; it now asserts `QUEUE_UNAVAILABLE`.
- PostgreSQL and Redis cannot participate in one native atomic transaction. A Redis success followed by database commit failure still requires reconciliation/idempotent requeue behavior in T019/T020.

## Deviations from Plan

- No PostgreSQL-backed test was added because T013 requires mocked Prisma repository isolation and T020 owns persistence-backed integration evidence.

## KB Updates Needed

- [ ] None; the active data model and queue-worker contract already document Redis authority and the PostgreSQL DLQ audit mirror.
