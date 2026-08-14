import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// SERVER-ONLY. Uses the service_role key, which bypasses RLS entirely.
// Never import this file from a Client Component or anything that ends up in
// the browser bundle. Only use for the specific server-side checks that
// genuinely need to bypass RLS — e.g. checking/logging login_attempts before
// a user has an authenticated session yet (see SECURITY.md section 2).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
