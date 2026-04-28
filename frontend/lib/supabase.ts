/**
 * frontend/lib/supabase.ts
 *
 * Supabase client singleton for frontend auth.
 * Lazily initialized to avoid build-time failures when env vars are unset.
 * Use `getSupabaseClient()` — never import a bare supabase instance.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  client = createClient(supabaseUrl, supabaseAnonKey);
  return client;
}
