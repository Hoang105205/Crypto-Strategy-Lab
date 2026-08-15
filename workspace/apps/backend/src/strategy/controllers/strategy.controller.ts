import { Controller, Get, Post, Delete, Param, Body, HttpException, HttpStatus, HttpCode, Inject } from '@nestjs/common';
import type { IStrategy, IJobQueue, IEventBus } from '@crypto-strategy-lab/shared';
import { CombinerType } from '@crypto-strategy-lab/shared';
import { StrategyRegistry } from '../registry/strategy.registry';
import { CompositeStrategy } from '../composite/composite.strategy';
import { MajorityVoteCombiner } from '../combiners/majority-vote.combiner';
import { WeightedScoreCombiner } from '../combiners/weighted-score.combiner';
import { StrategyVersioningService } from '../versioning/strategy-versioning.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateCompositeDto } from './dtos/create-composite.dto';
import { RequestBacktestDto } from './dtos/request-backtest.dto';

@Controller('api/strategies')
export class StrategyController {
  constructor(
    private readonly registry: StrategyRegistry,
    private readonly versioning: StrategyVersioningService,
    @Inject('IJobQueue') private readonly jobQueue: IJobQueue,
    @Inject('IEventBus') private readonly eventBus: IEventBus,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getAllStrategies() {
    const strategies = this.registry.getAll();
    return strategies.map((s) => ({
      name: s.getName(),
      type: s.getType(),
      parameters: s.getParameters(),
    }));
  }

  @Delete(':name')
  deleteStrategy(@Param('name') name: string) {
    const deleted = this.registry.unregister(name);
    if (!deleted) {
      throw new HttpException(`Strategy '${name}' not found`, HttpStatus.NOT_FOUND);
    }
    return { message: `Strategy '${name}' deleted successfully` };
  }

  @Post('composite')
  async createComposite(@Body() dto: CreateCompositeDto) {
    if (!dto || !dto.name || !dto.childStrategyNames || dto.childStrategyNames.length === 0) {
      throw new HttpException('Invalid composite configuration payload', HttpStatus.BAD_REQUEST);
    }

    const children: IStrategy[] = [];
    for (const name of dto.childStrategyNames) {
      const child = this.registry.get(name);
      if (!child) {
        throw new HttpException(`Child strategy '${name}' not found in registry`, HttpStatus.NOT_FOUND);
      }
      children.push(child);
    }

    let combiner;
    if (dto.combinerType === CombinerType.WEIGHTED_SCORE) {
      combiner = new WeightedScoreCombiner(dto.combinerWeights || {});
    } else {
      combiner = new MajorityVoteCombiner();
    }

    if (this.registry.has(dto.name)) {
      this.registry.unregister(dto.name);
    }

    const composite = new CompositeStrategy(dto.name, children, combiner, this.registry);

    const version = await this.versioning.createVersion(composite);

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
  @HttpCode(HttpStatus.ACCEPTED)
  async requestBacktest(@Body() dto: RequestBacktestDto) {
    if (!dto || !dto.strategyName || !dto.pair || !dto.timeframe) {
      throw new HttpException('Missing required backtest parameters', HttpStatus.BAD_REQUEST);
    }

    const strategy = this.registry.get(dto.strategyName);
    if (!strategy) {
      throw new HttpException(`Strategy '${dto.strategyName}' not found`, HttpStatus.BAD_REQUEST);
    }

    // Persist immutable snapshot version
    const version = await this.versioning.createVersion(strategy);
    const correlationId = `corr_${Date.now()}`;

    const payload = {
      strategyVersionId: version.id,
      pair: dto.pair,
      timeframe: dto.timeframe,
      startDate: new Date(dto.startDate || Date.now() - 30 * 24 * 3600 * 1000),
      endDate: new Date(dto.endDate || Date.now()),
      initialCapital: dto.initialCapital || 10000,
      positionSizePercent: dto.positionSizePercent || 100,
      executedAt: new Date(),
      source: 'USER',
      loopRunId: null,
    };

    let jobId: string;
    try {
      const result = await this.jobQueue.enqueue('BACKTEST', payload, correlationId);
      jobId = result.jobId;
    } catch (error) {
      throw new HttpException('QUEUE_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE);
    }

    // Emit event for observability
    this.eventBus.publish('BacktestRequested', { jobId, ...payload }, correlationId);

    return {
      jobId,
      strategyVersionId: version.id,
      status: 'QUEUED',
    };
  }

  @Get('backtest/:id')
  async getBacktestResult(@Param('id') id: string) {
    const result = await this.prisma.backtestResult.findUnique({
      where: { id },
    });
    if (!result) {
      throw new HttpException(`BacktestResult '${id}' not found`, HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Get(':id/versions')
  async getStrategyVersions(@Param('id') id: string) {
    const versions = await this.versioning.getVersionsByName(id);
    return versions;
  }

  @Get(':id')
  async getStrategyById(@Param('id') id: string) {
    const version = await this.versioning.getVersion(id);
    if (!version) {
      throw new HttpException(`Strategy version '${id}' not found`, HttpStatus.NOT_FOUND);
    }
    return version;
  }
}
