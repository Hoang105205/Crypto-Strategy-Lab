import { Controller, Get, Post, Delete, Param, Body, HttpException, HttpStatus, HttpCode, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  IStrategy,
  IJobQueue,
  IEventBus,
  UserBacktestRequestedPayload,
  IStrategyExecutionPort,
} from '@crypto-strategy-lab/shared';
import {
  BacktestSource,
  CombinerType,
  EventType,
  JobStatusValue,
  JobType,
} from '@crypto-strategy-lab/shared';
import { StrategyRegistry } from '../registry/strategy.registry';
import { CompositeStrategy } from '../composite/composite.strategy';
import { MajorityVoteCombiner } from '../combiners/majority-vote.combiner';
import { WeightedScoreCombiner } from '../combiners/weighted-score.combiner';
import { StrategyVersioningService } from '../versioning/strategy-versioning.service';
import { PrismaService } from '../../database/prisma.service';
import { IEVENT_BUS, IJOB_QUEUE, ISTRATEGY_EXECUTION_PORT } from '../../shared/tokens';
import { CreateCompositeDto } from './dtos/create-composite.dto';
import { RequestBacktestDto } from './dtos/request-backtest.dto';
import { UseGuards } from '@nestjs/common';
import { SupabaseJwtGuard } from '../../auth/supabase-jwt.guard';
import { RequireAuth } from '../../auth/require-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@Controller('api/strategies')
@UseGuards(SupabaseJwtGuard)
export class StrategyController {
  constructor(
    private readonly registry: StrategyRegistry,
    private readonly versioning: StrategyVersioningService,
    @Inject(IJOB_QUEUE) private readonly jobQueue: IJobQueue,
    @Inject(IEVENT_BUS) private readonly eventBus: IEventBus,
    @Inject(ISTRATEGY_EXECUTION_PORT) private readonly executionPort: IStrategyExecutionPort,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getAllStrategies(@CurrentUser() userId: string | null) {
    // 1. Get system strategies from global registry
    const registryStrategies = this.registry.getAll().map((s) => ({
      name: s.getName(),
      type: s.getType(),
      parameters: s.getParameters(),
      userId: null as string | null,
      isSystem: true,
      canDelete: false,
    }));

    // 2. Get user strategies from DB (latest version per name)
    const dbVersions = await this.versioning.getAllVersions(userId);
    const latestVersions = new Map<string, any>();
    for (const v of dbVersions) {
      const isSystem = v.userId === null;
      const canDelete = !isSystem && Boolean(userId) && v.userId === userId;
      if (!latestVersions.has(v.name) || latestVersions.get(v.name).version < v.version) {
        latestVersions.set(v.name, {
          name: v.name,
          type: v.strategyType,
          parameters: v.parameters,
          userId: v.userId ?? null,
          isSystem,
          canDelete,
        });
      }
    }

    // 3. Merge them
    const result = new Map<string, any>();
    for (const s of registryStrategies) {
      result.set(s.name, s);
    }
    for (const [name, s] of latestVersions.entries()) {
      result.set(name, s);
    }

    return Array.from(result.values());
  }

  @Delete(':name')
  async deleteStrategy(@Param('name') name: string, @CurrentUser() userId: string | null) {
    if (this.registry.has(name)) {
      throw new HttpException(`Cannot delete system strategy '${name}'`, HttpStatus.FORBIDDEN);
    }

    const dbVersions = await this.versioning.getVersionsByName(name, userId);
    if (dbVersions.length > 0) {
      const isSystem = dbVersions.some((v) => v.userId === null);
      if (isSystem) {
        throw new HttpException(`Cannot delete system strategy '${name}'`, HttpStatus.FORBIDDEN);
      }

      const userOwned = dbVersions.every((v) => v.userId === userId);
      if (!userOwned || !userId) {
        throw new HttpException(`Cannot delete strategy belonging to another user`, HttpStatus.FORBIDDEN);
      }
    }

    // Note: User strategies in DB are immutable snapshots (ADR-0008).
    throw new HttpException(`Strategy deletion is not permitted`, HttpStatus.FORBIDDEN);
  }

  @Post('composite')
  @UseGuards(RequireAuth)
  async createComposite(@Body() dto: CreateCompositeDto, @CurrentUser() userId: string | null) {
    if (!dto || !dto.name || !dto.childStrategyNames || dto.childStrategyNames.length < 2) {
      throw new HttpException('Composite requires at least 2 strategies', HttpStatus.BAD_REQUEST);
    }

    const children: IStrategy[] = [];
    for (const name of dto.childStrategyNames) {
      let child = this.registry.get(name);
      
      // If not in registry, try resolving from DB (e.g. for user composites)
      if (!child) {
        const dbVersions = await this.versioning.getVersionsByName(name, userId);
        if (dbVersions.length > 0) {
          const latestVersion = dbVersions.reduce((latest, current) => 
            current.version > latest.version ? current : latest
          );
          const executionResult = await this.executionPort.resolveVersion(
            latestVersion.id,
            userId,
          );
          if (executionResult) {
            child = executionResult.strategy;
          }
        }
      }

      if (!child) {
        throw new HttpException(`Child strategy '${name}' not found in registry or database`, HttpStatus.NOT_FOUND);
      }
      children.push(child);
    }

    let combiner;
    if (dto.combinerType === CombinerType.WEIGHTED_SCORE) {
      const weights = dto.combinerWeights || {};
      const sum = Object.values(weights).reduce((acc, w) => acc + (typeof w === 'number' ? w : 0), 0);
      if (Math.abs(sum - 1.0) > 0.001) {
        throw new HttpException('Total weights of all strategies must sum to exactly 1.0 (e.g. 0.4 and 0.6)', HttpStatus.BAD_REQUEST);
      }
      combiner = new WeightedScoreCombiner(weights);
    } else {
      combiner = new MajorityVoteCombiner();
    }

    if (this.registry.has(dto.name)) {
      throw new HttpException(`Cannot overwrite system strategy '${dto.name}'`, HttpStatus.FORBIDDEN);
    }

    // Do not pass this.registry to avoid exposing user composite to the global memory registry
    const composite = new CompositeStrategy(dto.name, children, combiner);

    const version = await this.versioning.createVersion(composite, undefined, userId);

    return {
      message: 'Composite strategy registered successfully',
      strategy: {
        name: composite.getName(),
        type: composite.getType(),
        versionId: version.id,
      },
    };
  }

  @Post('backtest')
  @UseGuards(RequireAuth)
  @HttpCode(HttpStatus.ACCEPTED)
  async requestBacktest(@Body() dto: RequestBacktestDto, @CurrentUser() userId: string | null) {
    if (!dto || !dto.strategyName || !dto.pair || !dto.timeframe) {
      throw new HttpException('Missing required backtest parameters', HttpStatus.BAD_REQUEST);
    }

    let version;
    const strategy = this.registry.get(dto.strategyName);
    
    if (strategy) {
      // It's a system strategy in the global registry, create a snapshot of its current state
      version = await this.versioning.createVersion(strategy, undefined, userId);
    } else {
      // Not in global registry, might be a user-created composite in the DB
      const dbVersions = await this.versioning.getVersionsByName(dto.strategyName, userId);
      if (dbVersions.length > 0) {
        // Pick the latest version
        version = dbVersions.reduce((latest, current) => 
          current.version > latest.version ? current : latest
        );
      }
    }

    if (!version) {
      throw new HttpException(`Strategy '${dto.strategyName}' not found`, HttpStatus.BAD_REQUEST);
    }
    const correlationId = randomUUID();
    const jobId = randomUUID();

    const payload: UserBacktestRequestedPayload = {
      jobId,
      strategyVersionId: version.id,
      pair: dto.pair,
      timeframe: dto.timeframe,
      startDate: new Date(dto.startDate || Date.now() - 30 * 24 * 3600 * 1000),
      endDate: new Date(dto.endDate || Date.now()),
      backtestConfig: {
        initialCapital: dto.initialCapital ?? 10000,
        positionSizePercent: dto.positionSizePercent ?? 100,
        commission: dto.commission,
        slippage: dto.slippage,
      },
      source: BacktestSource.USER,
      loopRunId: null,
      userId,
    };

    try {
      await this.jobQueue.enqueue(JobType.BACKTEST, payload, correlationId);
    } catch {
      throw new HttpException(
        {
          error: 'Queue service is unavailable',
          code: 'QUEUE_UNAVAILABLE',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Emit event for observability
    this.eventBus.publish(EventType.BacktestRequested, payload, correlationId);

    return {
      jobId,
      strategyVersionId: version.id,
      status: JobStatusValue.QUEUED,
    };
  }

  @Get('backtest/:id')
  @UseGuards(RequireAuth)
  async getBacktestResult(@Param('id') id: string, @CurrentUser() userId: string | null) {
    const result = await this.prisma.backtestResult.findFirst({
      where: {
        jobId: id,
        userId,
      },
    });
    if (!result) {
      throw new HttpException(`BacktestResult '${id}' not found`, HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Get(':id/versions')
  async getStrategyVersions(@Param('id') id: string, @CurrentUser() userId: string | null) {
    const versions = await this.versioning.getVersionsByName(id, userId);
    return versions;
  }

  @Get(':id')
  async getStrategyById(@Param('id') id: string, @CurrentUser() userId: string | null) {
    const version = await this.versioning.getVersion(id, userId);
    if (!version) {
      throw new HttpException(`Strategy version '${id}' not found`, HttpStatus.NOT_FOUND);
    }
    return version;
  }
}
