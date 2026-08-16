import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import {
  JobStatusValue,
  type DeadLetterJob,
  type IJobQueue,
  type QueueStats,
} from '@crypto-strategy-lab/shared';
import { IJOB_QUEUE } from '../shared/tokens';
import { DeadLetterRepository } from './dead-letter.repository';
import {
  QueueJobIdPipe,
  type RetryDeadLetterResponseDto,
} from './queue.dto';
import { mapQueueError, toQueueErrorResponse } from './queue.errors';

@Controller('api/queue')
export class QueueController {
  constructor(
    @Inject(IJOB_QUEUE) private readonly jobQueue: IJobQueue,
    private readonly deadLetters: DeadLetterRepository,
  ) {}

  @Get('stats')
  getStats(): Promise<QueueStats> {
    return this.execute(() => this.jobQueue.getStats());
  }

  @Get('dead-letter')
  listDeadLetters(): Promise<DeadLetterJob[]> {
    return this.execute(() => this.deadLetters.list());
  }

  @Post('dead-letter/:jobId/retry')
  @HttpCode(HttpStatus.OK)
  async retryDeadLetter(
    @Param('jobId', QueueJobIdPipe) jobId: string,
  ): Promise<RetryDeadLetterResponseDto> {
    await this.execute(() =>
      this.deadLetters.resolveAndRequeue(jobId, () =>
        this.jobQueue.retry(jobId),
      ),
    );
    return { jobId, status: JobStatusValue.QUEUED };
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      const stable = mapQueueError(error);
      throw new HttpException(toQueueErrorResponse(stable), stable.status);
    }
  }
}
