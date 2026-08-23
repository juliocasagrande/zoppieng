import { createClient } from "@supabase/supabase-js";
import { env } from "../env.js";

// Service-role client: used by the API for privileged operations (field-token
// flow, job workers, admin actions). Bypasses RLS — always scope queries
// explicitly by company_id/report_id in handlers that act on behalf of a user.
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Per-request client bound to the caller's Supabase Auth access token, so RLS
// policies apply as that user.
export function supabaseAsUser(accessToken: string) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
