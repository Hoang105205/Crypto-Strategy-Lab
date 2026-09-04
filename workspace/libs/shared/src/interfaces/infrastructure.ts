// Event Infrastructure interfaces - sourced from kb/contracts/events.yaml
// Owner: Phuong | Status: Active

import type { BacktestRequestedPayload, EventPayloadMap, EventTypeValue } from '../events';
import type { JobType } from '../types/enums';
import type { EventEnvelope, JobStatus, QueueStats } from '../types/infrastructure';

export type EventSubscription = () => void;

export interface IEventBus {
  publish<TEventType extends EventTypeValue>(
    eventType: TEventType,
    payload: EventPayloadMap[TEventType],
    correlationId?: string,
  ): void;
  subscribe<TEventType extends EventTypeValue>(
    eventType: TEventType,
    handler: (
      envelope: EventEnvelope<EventPayloadMap[TEventType], TEventType>,
    ) => void | Promise<void>,
  ): EventSubscription;
  unsubscribe(subscription: EventSubscription): void;
}

export interface IJobQueue {
  enqueue(
    jobType: JobType,
    payload: BacktestRequestedPayload,
    correlationId?: string,
  ): Promise<{ jobId: string }>;
  getStatus(jobId: string): Promise<JobStatus>;
  retry(jobId: string): Promise<void>;
  deadLetter(jobId: string, reason: string): Promise<void>;
  getStats(): Promise<QueueStats>;
}
