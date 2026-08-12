import { Controller, Get, Post, Body, HttpException, HttpStatus, HttpCode } from '@nestjs/common';
import type { IStrategy } from '@crypto-strategy-lab/shared';
import { CombinerType } from '@crypto-strategy-lab/shared';
import { StrategyRegistry } from '../registry/strategy.registry';
import { CompositeStrategy } from '../composite/composite.strategy';
import { MajorityVoteCombiner } from '../combiners/majority-vote.combiner';
import { WeightedScoreCombiner } from '../combiners/weighted-score.combiner';
import { StrategyVersioningService } from '../versioning/strategy-versioning.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateCompositeDto } from './dtos/create-composite.dto';
import { RequestBacktestDto } from './dtos/request-backtest.dto';

@Controller('api/strategies')
export class StrategyController {
  constructor(
    private readonly registry: StrategyRegistry,
    private readonly versioning: StrategyVersioningService,
    private readonly eventBus: EventBusService,
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

  @Post('composite')
  createComposite(@Body() dto: CreateCompositeDto) {
    if (!dto || !dto.name || !dto.childStrategyNames || dto.childStrategyNames.length === 0) {
      throw new HttpException('Invalid composite configuration payload', HttpStatus.BAD_REQUEST);
    }

    const children: IStrategy[] = [];
    for (const name of dto.childStrategyNames) {
      const child = this.registry.get(name);
      if (!child) {
        throw new HttpException(`Child strategy '${name}' not found in registry`, HttpStatus.BAD_REQUEST);
      }
      children.push(child);
    }

    let combiner;
    if (dto.combinerType === CombinerType.WEIGHTED_SCORE) {
      combiner = new WeightedScoreCombiner(dto.combinerWeights || {});
    } else {
      combiner = new MajorityVoteCombiner();
    }

    const composite = new CompositeStrategy(dto.name, children, combiner, this.registry);
    this.registry.register(composite);

    const version = this.versioning.createVersion(composite);

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
  requestBacktest(@Body() dto: RequestBacktestDto) {
    if (!dto || !dto.strategyName || !dto.pair || !dto.timeframe) {
      throw new HttpException('Missing required backtest parameters', HttpStatus.BAD_REQUEST);
    }

    const strategy = this.registry.get(dto.strategyName);
    if (!strategy) {
      throw new HttpException(`Strategy '${dto.strategyName}' not found`, HttpStatus.BAD_REQUEST);
    }

    // Persist immutable snapshot version
    const version = this.versioning.createVersion(strategy);
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // Emit event for queue worker
    this.eventBus.emitBacktestRequested({
      jobId,
      strategyVersionId: version.id,
      pair: dto.pair,
      timeframe: dto.timeframe,
      startDate: new Date(dto.startDate || Date.now() - 30 * 24 * 3600 * 1000),
      endDate: new Date(dto.endDate || Date.now()),
      initialCapital: dto.initialCapital || 10000,
      positionSizePercent: dto.positionSizePercent || 100,
      executedAt: new Date(),
    });

    return {
      jobId,
      strategyVersionId: version.id,
      status: 'QUEUED',
    };
  }
}
