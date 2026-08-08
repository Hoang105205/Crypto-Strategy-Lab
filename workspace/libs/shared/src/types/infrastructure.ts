// Event Infrastructure types — sourced from kb/contracts/events.yaml
// Owner: Phuong | Status: Active

export interface EventEnvelope<T = unknown> {
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: Date;
  correlationId: string;
  payload: T;
}

export interface JobRequest {
  jobId: string;
  jobType: string;
  payload: Record<string, unknown>;
  attempt: number;
  maxAttempts: number;
  correlationId: string;
  createdAt: Date;
  availableAt: Date;
}

export interface JobStatus {
  jobId: string;
  status: string; // JobStatusValue
  attempt: number;
  lastError?: string;
  updatedAt: Date;
}

export interface QueueStats {
  queued: number;
  processing: number;
  completedLast24h: number;
  deadLettered: number;
}

export interface LeaderboardEntryPayload {
  rank: number;
  strategyVersionId: string;
  strategyName: string;
  strategyType: string;
  isComposite: boolean;
  backtestResultId: string;
  score: number;
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
}
