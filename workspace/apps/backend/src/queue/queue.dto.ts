import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { JobStatusValue } from '@crypto-strategy-lab/shared';
import { QueueErrorCode } from './queue.errors';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface RetryDeadLetterResponseDto {
  jobId: string;
  status: JobStatusValue.QUEUED;
}

@Injectable()
export class QueueJobIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID_PATTERN.test(value)) {
      throw new BadRequestException({
        error: 'Invalid job ID',
        code: QueueErrorCode.INVALID_JOB_PAYLOAD,
      });
    }
    return value;
  }
}
