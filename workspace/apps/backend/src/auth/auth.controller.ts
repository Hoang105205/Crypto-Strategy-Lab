import { Controller, Get, Logger, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import { SupabaseJwtGuard } from './supabase-jwt.guard';
import { RequireAuth } from './require-auth.guard';

/**
 * Auth endpoints.
 * Register/login are handled by Supabase Auth directly from the frontend.
 * `me` is a debug endpoint; `logout` is a JWT-guarded acknowledgement (audit hook).
 * Authoritative session invalidation is supabase.auth.signOut() on the frontend.
 *
 * See: kb/contracts/auth.yaml §endpoints, ADR-0015
 */
@Controller('api/auth')
@UseGuards(SupabaseJwtGuard, RequireAuth)
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  @Get('me')
  async me(@CurrentUser() userId: string) {
    return { id: userId };
  }

  /**
   * Logout acknowledgement. The guards verify the JWT; we log the userId for audit.
   * Does NOT revoke the stateless Supabase JWT (no server session store) — the frontend
   * clears the session via supabase.auth.signOut(). Kept as an extension point for a
   * future token denylist (Constitution IV — intentionally not built now).
   */
  @Post('logout')
  async logout(@CurrentUser() userId: string) {
    this.logger.log(`Logout acknowledgement for user ${userId}`);
    return { message: 'Logged out successfully' };
  }
}
