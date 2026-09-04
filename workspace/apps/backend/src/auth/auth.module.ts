import { Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseJwtGuard } from './supabase-jwt.guard';
import { RequireAuth } from './require-auth.guard';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [SupabaseService, SupabaseJwtGuard, RequireAuth],
  exports: [SupabaseService, SupabaseJwtGuard, RequireAuth],
})
export class AuthModule {}
