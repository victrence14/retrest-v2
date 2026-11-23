import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseConfig } from "../config.ts";
import { timeoutFetch } from "./fetch.ts";

export interface SupabaseClients {
  auth: SupabaseClient;
  forUser: (token: string) => SupabaseClient;
}

const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

export function createSupabaseClients(config: SupabaseConfig): SupabaseClients {
  return {
    auth: createClient(config.url, config.anonKey, { auth, global: { fetch: timeoutFetch() } }),
    forUser: (token) =>
      createClient(config.url, config.anonKey, { auth, global: { fetch: timeoutFetch(), headers: { Authorization: `Bearer ${token}` } } }),
  };
}

// Reserved for trusted administrative jobs. This key bypasses RLS.
// User-facing routes MUST use forUser(accessToken) instead.
export function createAdminClient(config: SupabaseConfig): SupabaseClient {
  if (!config.serviceRoleKey) throw new Error("This administrative job requires SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(config.url, config.serviceRoleKey, { auth, global: { fetch: timeoutFetch() } });
}
