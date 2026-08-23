# Contract: Backtest-to-Leaderboard User Identity Propagation

## Invariant

The nullable user ID assigned by the backtest request producer is copied unchanged through queue persistence, backtest-result persistence, completion publication, and leaderboard-entry creation.

## USER Path

```ts
BacktestRequested {
  source: 'USER';
  loopRunId: null;
  userId: UUID | null; // authenticated UUID; null only for an anonymous allowed request
}

BacktestResult {
  userId: same value;
}

BacktestCompleted {
  userId: same value;
}

LeaderboardEntry {
  userId: same value;
}
```

## SEARCH_LOOP Path

```ts
BacktestRequested {
  source: 'SEARCH_LOOP';
  loopRunId: UUID;
  userId: null;
}

BacktestResult.userId === null
BacktestCompleted.userId === null
LeaderboardEntry.userId === null
```

## Required Shared Types

### BacktestRequestedPayload

Already declares:

```ts
userId: string | null;
```

### BacktestCompletedPayload

Must declare:

```ts
userId: string | null;
```

This field already exists in `kb/contracts/events.yaml`; adding it to TypeScript corrects contract drift.

### LeaderboardEntryPayload

Must declare:

```ts
userId: string | null;
```

This field already exists in `kb/contracts/events.yaml`; adding it to TypeScript corrects contract drift.

## Ownership Rules

- Do not derive result/entry ownership from `strategyVersionId`.
- Do not derive ownership from `loopRunId` when the explicit `userId` is available.
- Do not query an Auth user table from the worker or leaderboard.
- Do not add user identity to `SearchLoopRun` or `SearchLoopCandidate`.
- Idempotent duplicate processing must compare/preserve the same ownership along with immutable request identity.
