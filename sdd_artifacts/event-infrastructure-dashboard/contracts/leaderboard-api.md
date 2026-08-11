# Contract: Leaderboard API

## Ranking Criteria

`score | totalReturn | winRate | maxDrawdown | sharpeRatio`

Default score:

```text
normalizedReturn = clamp(totalReturn / 100, -1, 1)
riskScore = 1 - min(abs(maxDrawdown) / 50, 1)
score = 0.5 * normalizedReturn + 0.2 * winRate + 0.3 * riskScore
```

`winRate` is `[0,1]`. Tie-break at four score decimals: higher Sharpe Ratio, less severe Max Drawdown, earlier `executedAt`.

## Endpoints

### GET `/api/leaderboard`

Query: `sortBy` optional ranking criterion, default `score`.

**200**:

```ts
{
  rankingCriterion: RankingCriterion;
  updatedAt: string;
  entries: LeaderboardEntryPayload[];
}
```

Default response contains at most the best entry per Strategy Version and at most configured K entries.

**Errors**: `400 INVALID_SORT_CRITERION`.

### GET `/api/leaderboard/:strategyVersionId`

**200**:

```ts
LeaderboardEntryPayload & {
  strategyVersion: StrategyVersion;
  trades: Trade[];
  executedAt: string;
}
```

Detail is composed through the Strategy result reader port.

**Errors**: `404 LEADERBOARD_ENTRY_NOT_FOUND`, `503 STRATEGY_ENGINE_UNAVAILABLE`.

## Event

### `LeaderboardUpdated`

Publisher: Leaderboard. Subscriber: Push Gateway. Payload is the exact active event-contract payload. It is emitted only after persistence/ranking succeeds and never for a duplicate completion.

