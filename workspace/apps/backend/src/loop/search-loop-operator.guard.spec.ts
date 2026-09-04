import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ValidatedEnvironment } from '../config/environment';
import { SearchLoopOperatorGuard } from './search-loop-operator.guard';

describe('SearchLoopOperatorGuard', () => {
  const operatorId = '1d3f9f46-5f13-4c8f-9ae2-6c386fbf4b13';

  it('rejects anonymous requests', () => {
    const guard = createGuard([operatorId]);

    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects authenticated users outside the operator allowlist', () => {
    const guard = createGuard([operatorId]);

    expect(() =>
      guard.canActivate(contextFor('c6c0ff8d-d034-49a6-84d1-bcd43516c306')),
    ).toThrow(ForbiddenException);
  });

  it('denies mutations when the operator allowlist is empty', () => {
    const guard = createGuard([]);

    expect(() => guard.canActivate(contextFor(operatorId))).toThrow(
      ForbiddenException,
    );
  });

  it('allows an authenticated operator', () => {
    const guard = createGuard([operatorId]);

    expect(guard.canActivate(contextFor(operatorId))).toBe(true);
  });
});

function createGuard(operatorIds: readonly string[]): SearchLoopOperatorGuard {
  const config = {
    get: jest.fn().mockReturnValue(operatorIds),
  } as unknown as ConfigService<ValidatedEnvironment, true>;

  return new SearchLoopOperatorGuard(config);
}

function contextFor(userId: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => (userId ? { user: { id: userId } } : {}),
    }),
  } as ExecutionContext;
}
