# Lessons: Event Infrastructure Dashboard T024 — 2026-08-16

## What Worked

- An interactive Prisma transaction keeps the full Leaderboard snapshot and every rank update inside one deterministic rerank operation.
- Reusing the pure `ScoringPolicy` comparator prevents repository ranking from drifting from the four-decimal score and tie-break contract.
- Sorting the complete persisted projection before best-per-version filtering preserves non-Top-K history while keeping reads configurable.
- Explicit Prisma-to-shared mapping keeps persistence timestamps and identifiers from leaking into the public list payload.

## What Didn't Work

- No implementation defect was found by the T022 contract suite; the first implementation passed all repository cases.

## Deviations from Plan

- None. The repository accesses only the Event Infrastructure-owned `LeaderboardEntry` delegate plus Prisma transaction coordination.

## KB Updates Needed

- [ ] Clarify the authoritative `updatedAt` value for an empty Leaderboard snapshot; the repository currently returns the Unix epoch as a deterministic empty-state sentinel.
