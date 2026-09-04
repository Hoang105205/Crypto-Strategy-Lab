# Lessons: Event Infrastructure Dashboard T022 — 2026-08-16

## What Worked

- The existing DeadLetterRepository RED convention cleanly distinguishes a missing T024 production target from a broken test import or fixture.
- A Proxy-backed Prisma mock turns the module boundary into an executable assertion: only `leaderboardEntry` and `$transaction` are available, while direct Strategy Version or Backtest Result access fails immediately.
- Keeping repository rows separate from public payloads made persistence timestamps available for deterministic ranking without leaking them into the current list payload contract.

## What Didn't Work

- No implementation failures were investigated because T022 intentionally ends before production repository creation.

## Deviations from Plan

- Coverage was expanded beyond the terse T022 wording to include sequential and concurrent duplicate races, persistence outside Top-K, every shared `RankingCriterion`, and explicit cross-module Prisma boundary protection as requested.

## KB Updates Needed

- [ ] None identified; T022 tests encode the current Leaderboard contract and module ownership rules.
