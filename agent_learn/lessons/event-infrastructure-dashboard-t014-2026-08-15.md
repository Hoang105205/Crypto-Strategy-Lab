# Lessons: Event Infrastructure Dashboard T014 — 2026-08-15

## What Worked

- Kept BullMQ policy pure and unit-testable before adding the T015 adapter.
- Used separate producer and worker Redis options because acknowledged HTTP commands and long-lived workers have different outage semantics.
- Wrapped externally supplied Redis clients in an idempotent owner so BullMQ resources can close before their shared client.
- Converted unknown dependency failures to stable queue errors without serializing raw connection details or credentials.

## What Didn't Work

- A computed priority lookup triggered the strict ESLint unsafe-member-access rule; an explicit switch is clearer and detects future unsupported sources.

## Deviations from Plan

- None. No T015+ production behavior was implemented.

## KB Updates Needed

- [ ] None; ADR-0013 and the queue contract already describe the implemented policies.
