import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Singleton Supabase client for JWT verification.
 * Uses the anon key (not service role) — the token verification
 * calls supabase.auth.getUser(accessToken) which works with anon key.
 */
@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL') ?? '';
    const key = this.config.get<string>('SUPABASE_ANON_KEY') ?? '';
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** Verify a Supabase access token and return the user ID, or null. */
  async verifyToken(accessToken: string): Promise<string | null> {
    const {
      data: { user },
      error,
    } = await this.client.auth.getUser(accessToken);
    if (error || !user) return null;
    return user.id;
  }
}
