# Lessons: Split Leaderboard Boxes Phase 3 — 2026-08-25

## What Worked

- A typed options union preserved the existing positional `getLeaderboard(sortBy, signal)` call while enabling scoped list requests without touching the provider early.
- Keeping `apiRequest` unchanged preserved current-session token resolution and confined scope to query construction.
- Dead-code type assertions plus a full frontend `tsc --noEmit` proved ownership and Authorization override fields are absent from the public options surface.
- Testing exact URLs made omitted-scope backward compatibility and `URLSearchParams` ordering explicit.

## What Didn't Work

- The first sandboxed Vitest run failed before discovery because esbuild could not read the config; an approved rerun was required for valid RED evidence.
- Prettier moved one multiline type assertion, causing an unused `@ts-expect-error`; attaching the directive directly to the forbidden property restored a meaningful type gate.

## Deviations from Plan

- No functional deviation. The list API supports both typed options and the existing positional signature so Phase 3 does not require unauthorized provider changes.

## KB Updates Needed

- [ ] No KB update is needed until the provider and two-card route are implemented and validated.
- [ ] No new ADR is needed; REST scope remains an ADR-0016 application-level authorization refinement.
