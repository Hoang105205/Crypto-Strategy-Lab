// QueueModule — in-memory job queue + worker pool (IJobQueue), dead-letter handling
// Owner: Phuong
// See: kb/modules/event-infrastructure.md, kb/contracts/events.yaml, ADR-0006, ADR-0012

import { Module } from '@nestjs/common';
import { IJOB_QUEUE } from '../shared/tokens';
import { InMemoryJobQueue } from './in-memory-job.queue';

@Module({
  providers: [
    InMemoryJobQueue,
    { provide: IJOB_QUEUE, useExisting: InMemoryJobQueue },
    { provide: 'IJobQueue', useExisting: InMemoryJobQueue },
  ],
  exports: [IJOB_QUEUE, 'IJobQueue'],
})
export class QueueModule {}
