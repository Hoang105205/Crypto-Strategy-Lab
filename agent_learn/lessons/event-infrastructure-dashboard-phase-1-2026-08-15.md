# Event Infrastructure Dashboard — Phase 1

## Lessons

- Bind a concrete Nest adapter to its public symbol with `useExisting`; exporting only the symbol prevents duplicate adapter instances and keeps consumers replaceable.
- Test the swap boundary by overriding `IEVENT_BUS`, not by exposing or mocking the adapter's private EventEmitter2 instance.
- A fire-and-forget bus must isolate both synchronous throws and Promise rejections inside each subscription wrapper. Per-wrapper cleanup keeps unsubscribe idempotent without removing siblings.
- When repository-wide `tsc --noEmit` includes stale tests, run and report it honestly, then use the production `tsconfig.build.json`, Nest build, and targeted suites as separate evidence to locate whether the new source introduced the failure.
