import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the authenticated userId from the verified Supabase JWT.
 * Returns string (UUID) if authenticated, null if unauthenticated.
 * MUST be used with @UseGuards(SupabaseJwtGuard).
 *
 * Usage:
 *   @Get()
 *   @UseGuards(SupabaseJwtGuard)
 *   async list(@CurrentUser() userId: string | null) {
 *     return this.service.findAll({ OR: [{ userId: null }, { userId }] });
 *   }
 *
 * See: kb/contracts/auth.yaml §decorators
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.id ?? null;
  },
);
