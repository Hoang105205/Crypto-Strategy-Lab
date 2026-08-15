param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('T001', 'T002', 'T003', 'T004', 'T005', 'T006')]
  [string] $Task
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')

function Read-RepositoryFile {
  param([Parameter(Mandatory = $true)][string] $Path)

  return Get-Content -Raw (Join-Path $repositoryRoot $Path)
}

function Assert-Matches {
  param(
    [Parameter(Mandatory = $true)][string] $Content,
    [Parameter(Mandatory = $true)][string] $Pattern,
    [Parameter(Mandatory = $true)][string] $Message
  )

  if ($Content -notmatch $Pattern) {
    throw $Message
  }
}

function Assert-DoesNotMatch {
  param(
    [Parameter(Mandatory = $true)][string] $Content,
    [Parameter(Mandatory = $true)][string] $Pattern,
    [Parameter(Mandatory = $true)][string] $Message
  )

  if ($Content -match $Pattern) {
    throw $Message
  }
}

switch ($Task) {
  'T001' {
    $events = Read-RepositoryFile 'kb\contracts\events.yaml'
    $adr = Read-RepositoryFile 'kb\ADR\0013-adopt-bullmq-redis-for-backtest-jobs.md'
    $module = Read-RepositoryFile 'kb\modules\event-infrastructure.md'
    $modules = Read-RepositoryFile 'kb\MODULES.md'
    $backtestFlow = Read-RepositoryFile 'kb\flows\strategy-backtest.md'
    $leaderboardFlow = Read-RepositoryFile 'kb\flows\leaderboard-update.md'
    $loopFlow = Read-RepositoryFile 'kb\flows\strategy-search-loop.md'
    $combined = $events + $adr + $module + $modules + $backtestFlow + $leaderboardFlow + $loopFlow

    Assert-Matches $events 'queueName:\s*"backtest"' 'Queue name must be backtest.'
    Assert-Matches $events 'storage:\s*"Redis with AOF persistence"' 'Redis AOF persistence is missing.'
    Assert-Matches $events 'USER:\s*1' 'USER priority must be 1.'
    Assert-Matches $events 'SEARCH_LOOP:\s*10' 'SEARCH_LOOP priority must be 10.'
    Assert-Matches $events 'delaysMs:\s*\[1000,\s*4000\]' 'Retry delays must be 1000ms and 4000ms.'
    Assert-Matches $events 'maxAttempts:\s*3' 'There must be three total attempts.'
    Assert-Matches $events 'producer-supplied payload\.jobId' 'Producer jobId ownership is missing.'
    Assert-Matches $combined 'bounded (age/count|count/age)' 'Bounded retention is missing.'
    Assert-Matches $combined 'stalled-job recovery' 'Stalled-job recovery is missing.'
    Assert-Matches $combined 'terminal' 'Terminal failure semantics are missing.'
    Assert-Matches $backtestFlow 'IStrategyExecutionPort\.resolveVersion' 'Strategy execution port is missing from the backtest flow.'
    Assert-DoesNotMatch $events 'willRetry' 'The obsolete BacktestFailed.willRetry field remains in the active contract.'
  }
  'T002' {
    $events = Read-RepositoryFile 'workspace\libs\shared\src\events\index.ts'
    $interfaces = Read-RepositoryFile 'workspace\libs\shared\src\interfaces\infrastructure.ts'
    $types = Read-RepositoryFile 'workspace\libs\shared\src\types\infrastructure.ts'
    $enums = Read-RepositoryFile 'workspace\libs\shared\src\types\enums.ts'
    $combined = $events + $interfaces + $types + $enums

    Assert-Matches $types 'eventVersion:\s*1;' 'Event envelopes must be version 1.'
    Assert-Matches $interfaces 'payload:\s*BacktestRequestedPayload' 'IJobQueue.enqueue must require the contract payload containing jobId.'
    Assert-Matches $types 'delayed:\s*number;' 'QueueStats.delayed is missing.'
    Assert-Matches $types 'redisConnected:\s*boolean;' 'QueueStats.redisConnected is missing.'
    Assert-Matches $types 'interface DeadLetterJob' 'DeadLetterJob is missing.'
    Assert-Matches $enums 'enum RankingCriterion' 'RankingCriterion is missing.'
    Assert-Matches $types 'interface SearchLoopConfig' 'SearchLoopConfig is missing.'
    Assert-Matches $events 'loopRunId:\s*null;' 'USER source must have a null loopRunId branch.'
    Assert-Matches $events 'loopRunId:\s*string;' 'SEARCH_LOOP source must have a required loopRunId branch.'
    Assert-Matches $combined 'NormalizedRate' 'The normalized [0,1] winRate type is missing.'
    Assert-DoesNotMatch $events 'willRetry' 'BacktestFailed must be terminal-only.'
  }
  'T003' {
    $interfaces = Read-RepositoryFile 'workspace\libs\shared\src\interfaces\strategy.ts'
    $types = Read-RepositoryFile 'workspace\libs\shared\src\types\strategy.ts'
    $tokens = Read-RepositoryFile 'workspace\apps\backend\src\shared\tokens.ts'

    Assert-Matches $interfaces 'interface IStrategyExecutionPort' 'IStrategyExecutionPort is missing.'
    Assert-Matches $interfaces 'interface IBacktestResultPort' 'IBacktestResultPort is missing.'
    Assert-Matches $types 'interface StrategyExecutionResult' 'StrategyExecutionResult is missing.'
    Assert-Matches $types 'type BacktestResultCreateInput' 'BacktestResultCreateInput is missing.'
    Assert-Matches $tokens 'ISTRATEGY_EXECUTION_PORT' 'Strategy execution DI token is missing.'
    Assert-Matches $tokens 'IBACKTEST_RESULT_PORT' 'Backtest result DI token is missing.'
    Assert-Matches $tokens 'IJOB_QUEUE' 'Job queue DI token is missing.'

    $eventInfrastructureFiles = Get-ChildItem (Join-Path $repositoryRoot 'workspace\apps\backend\src') -Recurse -File -Filter '*.ts' |
      Where-Object { $_.FullName -match '\\(events|queue|leaderboard|loop|dashboard)\\' }
    $eventInfrastructureSource = ($eventInfrastructureFiles | ForEach-Object { Get-Content -Raw $_.FullName }) -join "`n"
    Assert-DoesNotMatch $eventInfrastructureSource 'prisma\.(strategyVersion|backtestResult)' 'Event Infrastructure directly accesses a Strategy-owned Prisma model.'
  }
  'T004' {
    $schema = Read-RepositoryFile 'workspace\apps\backend\prisma\schema.prisma'
    $migration = Read-RepositoryFile 'workspace\apps\backend\prisma\migrations\20260811_event_infrastructure_dashboard\migration.sql'

    Assert-Matches $schema 'model LeaderboardEntry[\s\S]*executedAt\s+DateTime' 'LeaderboardEntry.executedAt is missing.'
    Assert-Matches $schema 'model SearchLoopRun[\s\S]*stopOnNoImprovementIterations\s+Int\s+@default\(50\)' 'The Loop safety bound must be non-null with default 50.'
    Assert-Matches $schema 'model SearchLoopCandidate[\s\S]*jobId\s+String\s+@unique' 'SearchLoopCandidate.jobId must be required and unique.'
    Assert-Matches $schema 'model SearchLoopCandidate[\s\S]*updatedAt\s+DateTime\s+@updatedAt' 'SearchLoopCandidate.updatedAt is missing.'
    Assert-Matches $migration 'SET "executedAt" = "createdAt"' 'Leaderboard executedAt safe backfill is missing.'
    Assert-Matches $migration 'IF EXISTS \(SELECT 1 FROM "SearchLoopCandidate" LIMIT 1\)' 'SearchLoopCandidate empty-table guard is missing.'
    Assert-Matches $migration 'SET "stopOnNoImprovementIterations" = 50' 'Loop safety-bound backfill is missing.'
    Assert-DoesNotMatch $migration '(?i)prisma\s+migrate|migrate\s+(dev|deploy)' 'Migration SQL must not apply itself.'
  }
  'T005' {
    $package = Read-RepositoryFile 'workspace\apps\frontend\package.json'
    $config = Read-RepositoryFile 'workspace\apps\frontend\vitest.config.ts'
    $setup = Read-RepositoryFile 'workspace\apps\frontend\src\test\setup.ts'
    $smoke = Read-RepositoryFile 'workspace\apps\frontend\src\test\smoke.spec.tsx'

    Assert-Matches $package '"vitest":\s*"\^2\.' 'Vitest 2 is not configured.'
    Assert-Matches $package '"jsdom"' 'jsdom is not configured.'
    Assert-Matches $package '"@testing-library/react"' 'React Testing Library is not configured.'
    Assert-Matches $config "environment:\s*'jsdom'" 'Vitest must use jsdom.'
    Assert-Matches $setup "@testing-library/jest-dom/vitest" 'jest-dom matchers are not loaded.'
    Assert-Matches $smoke 'render\(<SmokeComponent' 'Smoke component test is missing.'
  }
  'T006' {
    $backendPackage = Read-RepositoryFile 'workspace\apps\backend\package.json'
    $environment = Read-RepositoryFile 'workspace\apps\backend\src\config\environment.ts'
    $appModule = Read-RepositoryFile 'workspace\apps\backend\src\app.module.ts'
    $contractTest = Read-RepositoryFile 'workspace\apps\backend\src\shared\infrastructure-contract.spec.ts'

    Assert-Matches $backendPackage '"bullmq"' 'BullMQ dependency is missing.'
    Assert-Matches $backendPackage '"ioredis"' 'ioredis dependency is missing.'
    Assert-Matches $appModule 'validate:\s*validateEnvironment' 'Nest ConfigModule does not use the environment validator.'
    Assert-Matches $environment 'BACKTEST_QUEUE_NAME[\s\S]*backtest' 'Validated queue name/default is missing.'
    Assert-Matches $environment 'BACKTEST_WORKER_CONCURRENCY[\s\S]*32' 'Worker concurrency validation is missing.'
    Assert-Matches $environment "BACKTEST_MAX_ATTEMPTS[\s\S]*'BACKTEST_MAX_ATTEMPTS',\s*3,\s*3" 'Three-attempt validation is missing.'
    Assert-Matches $environment 'BACKTEST_JOB_RETENTION_AGE_SECONDS' 'Retention-age validation is missing.'
    Assert-Matches $environment 'BACKTEST_JOB_RETENTION_COUNT' 'Retention-count validation is missing.'
    Assert-Matches $contractTest 'RequiredJobId' 'Required jobId contract assertion is missing.'
    Assert-Matches $contractTest 'RedisAwareStats' 'Redis-aware QueueStats assertion is missing.'
    Assert-Matches $contractTest 'TerminalOnly' 'Terminal payload assertion is missing.'
    Assert-Matches $contractTest 'StrategyPortsPresent' 'Strategy port assertion is missing.'
  }
}

Write-Output "$Task verification PASS"
