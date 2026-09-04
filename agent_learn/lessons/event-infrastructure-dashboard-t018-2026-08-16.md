# Lessons: Event Infrastructure Dashboard T018 — 2026-08-16

## What Worked

- A shared controller execution wrapper converted Queue errors into predictable `{error, code}` bodies without leaking causes.
- Nest's pipe boundary validated the route UUID before either the PostgreSQL DLQ repository or Redis queue was called.
- Supertest against a real Nest application proved decorators, status codes, JSON serialization, validation, and retry callback ordering together.
- Injecting `IJobQueue` kept REST independent from BullMQ classes; the controller only coordinates the queue port and DLQ repository boundary.

## What Didn't Work

- The backend does not declare `class-validator` or `class-transformer`, so decorator DTO validation would add unnecessary dependency scope for one UUID path parameter.

## Deviations from Plan

- `QueueJobIdPipe` performs explicit UUID validation in `queue.dto.ts` instead of introducing validation packages.
- Controller registration in `QueueModule` remains T019 as required.

## KB Updates Needed

- [ ] None; the active queue REST and stable error contracts already match the implementation.
