# Contract: Strategy Search Loop API

## Start Request

```ts
{
  generatorType: 'RANDOM' | 'DOMAIN_GUIDED';
  pair: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  backtestConfig: BacktestConfig;
  maxCandidates?: number;
  maxDurationMs?: number;
  stopOnNoImprovementIterations?: number; // default 50
}
```

At least one effective bound is required; the no-improvement bound defaults to 50 and cannot be disabled when no numeric bound exists.

## Endpoints

### POST `/api/loop/start`

**201**: `{ "loopRunId": "uuid", "status": "RUNNING" }`

**Errors**: `400 INVALID_LOOP_CONFIG`, `409 LOOP_ALREADY_ACTIVE`, `503 STRATEGY_ENGINE_UNAVAILABLE`.

### POST `/api/loop/:loopRunId/pause`

**200**: `{ "loopRunId": "uuid", "status": "PAUSED" }`

**Errors**: `404 LOOP_NOT_FOUND`, `409 INVALID_LOOP_TRANSITION`.

### POST `/api/loop/:loopRunId/resume`

**200**: `{ "loopRunId": "uuid", "status": "RUNNING" }`

**Errors**: `404 LOOP_NOT_FOUND`, `409 INVALID_LOOP_TRANSITION`.

### POST `/api/loop/:loopRunId/stop`

**200**: `{ "loopRunId": "uuid", "status": "STOPPED_BY_USER" }`

**Errors**: `404 LOOP_NOT_FOUND`, `409 INVALID_LOOP_TRANSITION`.

### GET `/api/loop/:loopRunId`

**200**: `SearchLoopRun` plus ordered candidates.

**Errors**: `404 LOOP_NOT_FOUND`.

### GET `/api/loop/current`

**200**: active `SearchLoopRun` or `null`.

## Events

- `SearchLoopStarted`: emitted after the run is persisted as `RUNNING`.
- `SearchLoopProgress`: emitted after a terminal candidate is recorded while the run remains non-terminal.
- `SearchLoopStopped`: emitted once for `COMPLETED`, `STOPPED_BY_USER`, or `FAILED`.
- Search-originated `BacktestRequested`: producer-generated `jobId`, source `SEARCH_LOOP`, non-null `loopRunId`.

