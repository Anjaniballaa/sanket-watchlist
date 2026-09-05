import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let service: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS — only call after NextAuth session checks. */
export function getServiceSupabase(): SupabaseClient {
  if (!service) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase env missing");
    service = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return service;
}
