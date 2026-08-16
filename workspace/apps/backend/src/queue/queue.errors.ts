export const QueueErrorCode = {
  INVALID_JOB_PAYLOAD: 'INVALID_JOB_PAYLOAD',
  QUEUE_UNAVAILABLE: 'QUEUE_UNAVAILABLE',
  DUPLICATE_JOB_ID: 'DUPLICATE_JOB_ID',
  JOB_CONFLICT: 'JOB_CONFLICT',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  JOB_ALREADY_RESOLVED: 'JOB_ALREADY_RESOLVED',
  STRATEGY_ENGINE_UNAVAILABLE: 'STRATEGY_ENGINE_UNAVAILABLE',
} as const;

export type QueueErrorCodeValue =
  (typeof QueueErrorCode)[keyof typeof QueueErrorCode];

const ERROR_DEFINITIONS: Readonly<
  Record<QueueErrorCodeValue, { status: number; message: string }>
> = {
  INVALID_JOB_PAYLOAD: { status: 400, message: 'Invalid backtest job payload' },
  DUPLICATE_JOB_ID: { status: 409, message: 'Job ID already exists' },
  JOB_CONFLICT: { status: 409, message: 'Job conflicts with existing state' },
  JOB_NOT_FOUND: { status: 404, message: 'Job not found' },
  JOB_ALREADY_RESOLVED: { status: 409, message: 'Job is already resolved' },
  QUEUE_UNAVAILABLE: { status: 503, message: 'Queue service is unavailable' },
  STRATEGY_ENGINE_UNAVAILABLE: {
    status: 503,
    message: 'Strategy Engine is unavailable',
  },
};

export class QueueError extends Error {
  readonly status: number;

  constructor(
    readonly code: QueueErrorCodeValue,
    options?: ErrorOptions,
  ) {
    const definition = ERROR_DEFINITIONS[code];
    super(definition.message, options);
    this.name = 'QueueError';
    this.status = definition.status;
  }
}

export interface QueueErrorResponse {
  error: string;
  code: QueueErrorCodeValue;
}

export function mapQueueError(error: unknown): QueueError {
  if (error instanceof QueueError) {
    return error;
  }

  return new QueueError(QueueErrorCode.QUEUE_UNAVAILABLE, { cause: error });
}

export function toQueueErrorResponse(error: unknown): QueueErrorResponse {
  const stable = mapQueueError(error);
  return { error: stable.message, code: stable.code };
}
