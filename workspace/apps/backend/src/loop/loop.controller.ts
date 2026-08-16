import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { SearchLoopRun } from '@crypto-strategy-lab/shared';
import type { Response } from 'express';
import {
  LoopApiErrorCode,
  LoopRunIdPipe,
  StartLoopDtoPipe,
  mapLoopHttpError,
  loopHttpException,
  type LoopCommandResponseDto,
} from './loop.dto';
import { LoopStatusService } from './loop-status.service';
import {
  StrategyLoopService,
  type StartLoopInput,
} from './strategy-loop.service';
import type { LoopRunDetail } from './loop.repository';

@Controller('api/loop')
export class LoopController {
  constructor(
    private readonly loop: StrategyLoopService,
    private readonly status: LoopStatusService,
  ) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  async start(
    @Body(StartLoopDtoPipe) input: StartLoopInput,
  ): Promise<LoopCommandResponseDto> {
    const run = await this.execute(() => this.loop.start(input));
    return commandResponse(run);
  }

  @Post(':loopRunId/pause')
  @HttpCode(HttpStatus.OK)
  async pause(
    @Param('loopRunId', LoopRunIdPipe) loopRunId: string,
  ): Promise<LoopCommandResponseDto> {
    const run = await this.execute(() => this.status.pause(loopRunId));
    return commandResponse(run);
  }

  @Post(':loopRunId/resume')
  @HttpCode(HttpStatus.OK)
  async resume(
    @Param('loopRunId', LoopRunIdPipe) loopRunId: string,
  ): Promise<LoopCommandResponseDto> {
    const run = await this.execute(() => this.status.resume(loopRunId));
    return commandResponse(run);
  }

  @Post(':loopRunId/stop')
  @HttpCode(HttpStatus.OK)
  async stop(
    @Param('loopRunId', LoopRunIdPipe) loopRunId: string,
  ): Promise<LoopCommandResponseDto> {
    const run = await this.execute(() => this.status.stop(loopRunId));
    return commandResponse(run);
  }

  // Keep the literal route before the parameter route so "current" is never
  // interpreted as a loopRunId.
  @Get('current')
  async getCurrent(@Res() response: Response): Promise<void> {
    const current = await this.execute(() => this.status.getCurrent());
    response.status(HttpStatus.OK).json(current);
  }

  @Get(':loopRunId')
  async detail(
    @Param('loopRunId', LoopRunIdPipe) loopRunId: string,
  ): Promise<LoopRunDetail> {
    const detail = await this.execute(() => this.status.getDetail(loopRunId));
    if (!detail) {
      throw loopHttpException(LoopApiErrorCode.LOOP_NOT_FOUND);
    }
    return detail;
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      throw mapLoopHttpError(error);
    }
  }
}

function commandResponse(run: SearchLoopRun): LoopCommandResponseDto {
  return { loopRunId: run.id, status: run.status };
}
