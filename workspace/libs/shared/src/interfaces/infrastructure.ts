// Event Infrastructure interfaces — sourced from kb/contracts/events.yaml
// Owner: Phuong | Status: Active

import { EventEnvelope, JobStatus, QueueStats } from '../types/infrastructure';

export type EventSubscription = () => void;

export interface IEventBus {
  publish<T>(eventType: string, payload: T, correlationId?: string): void;
  subscribe<T>(
    eventType: string,
    handler: (envelope: EventEnvelope<T>) => void | Promise<void>,
  ): EventSubscription;
  unsubscribe(subscription: EventSubscription): void;
}

export interface IJobQueue {
  enqueue(jobType: string, payload: object, correlationId?: string): Promise<{ jobId: string }>;
  getStatus(jobId: string): Promise<JobStatus>;
  retry(jobId: string): Promise<void>;
  deadLetter(jobId: string, reason: string): Promise<void>;
  getStats(): Promise<QueueStats>;
}
