import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import { SupabaseJwtGuard } from './supabase-jwt.guard';
import { RequireAuth } from './require-auth.guard';

/**
 * Debug endpoint for checking auth status.
 * Register/login/logout are handled by Supabase Auth directly from the frontend.
 *
 * See: kb/contracts/auth.yaml §endpoints
 */
@Controller('auth')
@UseGuards(SupabaseJwtGuard, RequireAuth)
export class AuthController {
  @Get('me')
  async me(@CurrentUser() userId: string) {
    return { id: userId };
  }
}
