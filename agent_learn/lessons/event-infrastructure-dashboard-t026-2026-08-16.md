# Lessons: Event Infrastructure Dashboard T026 — 2026-08-16

## What Worked

- Preserving the full detail API through `BacktestResultDetail` keeps the Strategy relation query inside the approved Strategy-owned adapter instead of weakening the public contract.
- Reusing `IBacktestResultPort.getById()` avoids introducing another token and keeps Leaderboard independent of executable Strategy resolution.
- Dedicated pipes provide default/enum sort validation and UUID validation with stable response bodies.
- A ConfigService-backed repository factory makes Top-K configurable without direct environment access or primitive DI ambiguity.

## What Didn't Work

- Backend type-check initially resolved the shared package's stale `dist`; rebuilding shared before backend checks was required after the public type change.
- The first Strategy Version mapper retained Prisma nulls for optional combiner fields; tests exposed and corrected the mapping to shared `undefined` semantics.

## Deviations from Plan

- The approved Strategy result reader contract was widened from `BacktestResult` to `BacktestResultDetail` to satisfy the already-approved full Strategy Version endpoint contract.

## KB Updates Needed

- [ ] None; feature-local contracts and the shared public port were reconciled together.
