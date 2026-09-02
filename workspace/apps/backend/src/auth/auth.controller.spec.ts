import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth.controller';
import { SupabaseJwtGuard } from './supabase-jwt.guard';
import { RequireAuth } from './require-auth.guard';

const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('AuthController', () => {
  it('is mounted at api/auth so the frontend can call /api/auth/*', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AuthController)).toBe('api/auth');
  });

  it('guards every route with SupabaseJwtGuard + RequireAuth (401 on invalid/expired token)', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AuthController)).toEqual([
      SupabaseJwtGuard,
      RequireAuth,
    ]);
  });

  it('logout returns the contract acknowledgement message for the verified user', async () => {
    const controller = new AuthController();
    await expect(controller.logout(USER_ID)).resolves.toEqual({
      message: 'Logged out successfully',
    });
  });

  it('me returns the current user id (debug endpoint)', async () => {
    const controller = new AuthController();
    await expect(controller.me(USER_ID)).resolves.toEqual({ id: USER_ID });
  });
});
