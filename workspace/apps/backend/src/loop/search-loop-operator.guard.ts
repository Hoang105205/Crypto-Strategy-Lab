import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ValidatedEnvironment } from '../config/environment';

interface AuthenticatedRequest {
  user?: {
    id?: string | null;
  };
}

@Injectable()
export class SearchLoopOperatorGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<ValidatedEnvironment, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const operatorIds = this.config.get<readonly string[]>(
      'SEARCH_LOOP_OPERATOR_USER_IDS',
    );
    if (!operatorIds.includes(userId)) {
      throw new ForbiddenException('Search Loop operator access required');
    }

    return true;
  }
}
