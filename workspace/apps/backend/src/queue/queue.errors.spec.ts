import { describe, expect, it } from '@jest/globals';
import {
  QueueError,
  QueueErrorCode,
  mapQueueError,
  toQueueErrorResponse,
} from './queue.errors';

describe('stable queue errors', () => {
  it.each([
    [QueueErrorCode.INVALID_JOB_PAYLOAD, 400],
    [QueueErrorCode.DUPLICATE_JOB_ID, 409],
    [QueueErrorCode.JOB_CONFLICT, 409],
    [QueueErrorCode.JOB_NOT_FOUND, 404],
    [QueueErrorCode.JOB_ALREADY_RESOLVED, 409],
    [QueueErrorCode.QUEUE_UNAVAILABLE, 503],
    [QueueErrorCode.STRATEGY_ENGINE_UNAVAILABLE, 503],
  ] as const)('maps %s to HTTP %i', (code, status) => {
    expect(new QueueError(code)).toMatchObject({ code, status });
  });

  it('preserves an existing stable error', () => {
    const stable = new QueueError(QueueErrorCode.JOB_NOT_FOUND);
    expect(mapQueueError(stable)).toBe(stable);
  });

  it('maps dependency failures without exposing raw Redis details or credentials', () => {
    const raw = new Error(
      'ECONNREFUSED redis://queue-user:private-password@redis.internal:6380',
    );
    const mapped = mapQueueError(raw);
    const response = toQueueErrorResponse(mapped);

    expect(mapped).toMatchObject({
      code: QueueErrorCode.QUEUE_UNAVAILABLE,
      status: 503,
    });
    expect(response).toEqual({
      error: 'Queue service is unavailable',
      code: QueueErrorCode.QUEUE_UNAVAILABLE,
    });
    expect(JSON.stringify(response)).not.toContain('private-password');
    expect(JSON.stringify(response)).not.toContain('redis.internal');
  });
});
