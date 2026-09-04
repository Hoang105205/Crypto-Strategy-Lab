import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Companion guard — rejects requests where userId is null.
 * Use AFTER SupabaseJwtGuard for routes that require a logged-in user.
 *
 * Usage: @UseGuards(SupabaseJwtGuard, RequireAuth)
 *
 * See: kb/contracts/auth.yaml §guards
 */
@Injectable()
export class RequireAuth implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request.user?.id) {
      throw new UnauthorizedException('Authentication required');
    }
    return true;
  }
}
