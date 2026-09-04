import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from './supabase.service';

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Does NOT block unauthenticated requests — attaches userId (or null) to request.user.
 * Use @UseGuards(SupabaseJwtGuard) for optional auth, or add RequireAuth for required auth.
 *
 * See: kb/contracts/auth.yaml §guards, ADR-0015
 */
@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseJwtGuard.name);

  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;

    if (!authHeader?.startsWith('Bearer ')) {
      request.user = { id: null };
      return true;
    }

    const token = authHeader.slice(7);
    try {
      const userId = await this.supabase.verifyToken(token);
      request.user = { id: userId };
    } catch (err) {
      this.logger.warn(`JWT verification failed: ${err}`);
      request.user = { id: null };
    }

    return true;
  }
}
