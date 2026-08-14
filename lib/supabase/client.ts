import { createBrowserClient } from "@supabase/ssr";

// Browser client — uses the public anon key only. RLS (see schema.sql) is what
// actually enforces access control; this key is safe to ship to the client.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
