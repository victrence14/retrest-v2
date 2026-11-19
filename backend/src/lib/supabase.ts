import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config } from '../config.js';

export interface SupabaseClients {
  auth: SupabaseClient;
  forUser: (token: string) => SupabaseClient;
}

export function createSupabaseClients(config: Config): SupabaseClients {
  const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
  return {
    auth: createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, { auth }),
    forUser: (token) => createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth, global: { headers: { Authorization: `Bearer ${token}` } },
    }),
  };
}

// Reserved for trusted administrative jobs. This key bypasses RLS.
// User-facing routes MUST use forUser(accessToken) instead.
export function createAdminClient(config: Config): SupabaseClient {
  if (!config.SUPABASE_SERVICE_ROLE_KEY) throw new Error('This administrative job requires SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
