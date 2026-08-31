import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { SearchLoopRun } from '@crypto-strategy-lab/shared';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';
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
import { SearchLoopAutomationConfigPipe } from './search-loop-control.dto';
import { SearchLoopControlService } from './search-loop-control.service';
import { SearchLoopOperatorGuard } from './search-loop-operator.guard';
import type {
  SearchLoopAutomationConfig,
  SearchLoopControlState,
} from './search-loop-control.repository';

@Controller('api/loop')
@UseGuards(SupabaseJwtGuard)
export class LoopController {
  constructor(
    private readonly loop: StrategyLoopService,
    private readonly status: LoopStatusService,
    private readonly control: SearchLoopControlService,
  ) {}

  @Get('control')
  getControl(): Promise<SearchLoopControlState> {
    return this.control.get();
  }

  @Post('control/enable')
  @UseGuards(SearchLoopOperatorGuard)
  @HttpCode(HttpStatus.OK)
  enableControl(
    @Body(SearchLoopAutomationConfigPipe) config: SearchLoopAutomationConfig,
  ): Promise<SearchLoopControlState> {
    return this.control.enable(config);
  }

  @Post('control/disable')
  @UseGuards(SearchLoopOperatorGuard)
  @HttpCode(HttpStatus.OK)
  disableControl(): Promise<SearchLoopControlState> {
    return this.control.disable();
  }

  @Put('control/config')
  @UseGuards(SearchLoopOperatorGuard)
  configureControl(
    @Body(SearchLoopAutomationConfigPipe) config: SearchLoopAutomationConfig,
  ): Promise<SearchLoopControlState> {
    return this.control.configure(config);
  }

  @Post('start')
  @UseGuards(SearchLoopOperatorGuard)
  @HttpCode(HttpStatus.CREATED)
  async start(
    @Body(StartLoopDtoPipe) input: StartLoopInput,
    @CurrentUser() currentUserId: string | null,
  ): Promise<LoopCommandResponseDto> {
    void currentUserId;
    const run = await this.execute(() => this.loop.start(input));
    return commandResponse(run);
  }

  @Post(':loopRunId/pause')
  @UseGuards(SearchLoopOperatorGuard)
  @HttpCode(HttpStatus.OK)
  async pause(
    @Param('loopRunId', LoopRunIdPipe) loopRunId: string,
    @CurrentUser() currentUserId: string | null,
  ): Promise<LoopCommandResponseDto> {
    void currentUserId;
    const run = await this.execute(() => this.loop.pause(loopRunId));
    return commandResponse(run);
  }

  @Post(':loopRunId/resume')
  @UseGuards(SearchLoopOperatorGuard)
  @HttpCode(HttpStatus.OK)
  async resume(
    @Param('loopRunId', LoopRunIdPipe) loopRunId: string,
    @CurrentUser() currentUserId: string | null,
  ): Promise<LoopCommandResponseDto> {
    void currentUserId;
    const run = await this.execute(() => this.loop.resume(loopRunId));
    return commandResponse(run);
  }

  @Post(':loopRunId/stop')
  @UseGuards(SearchLoopOperatorGuard)
  @HttpCode(HttpStatus.OK)
  async stop(
    @Param('loopRunId', LoopRunIdPipe) loopRunId: string,
    @CurrentUser() currentUserId: string | null,
  ): Promise<LoopCommandResponseDto> {
    void currentUserId;
    const run = await this.execute(() => this.loop.stop(loopRunId));
    return commandResponse(run);
  }

  // Keep the literal route before the parameter route so "current" is never
  // interpreted as a loopRunId.
  @Get('current')
  async getCurrent(
    @Res() response: Response,
    @CurrentUser() currentUserId: string | null,
  ): Promise<void> {
    void currentUserId;
    const current = await this.execute(() => this.status.getCurrent());
    response.status(HttpStatus.OK).json(current);
  }

  @Get(':loopRunId')
  async detail(
    @Param('loopRunId', LoopRunIdPipe) loopRunId: string,
    @CurrentUser() currentUserId: string | null,
  ): Promise<LoopRunDetail> {
    void currentUserId;
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
