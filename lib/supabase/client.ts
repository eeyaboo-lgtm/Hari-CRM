import { createBrowserClient } from "@supabase/ssr";
import { getAdminViewingHouseholdId } from "@/lib/supabase/ownerMap";

// Browser client — uses the public anon key only. RLS (see schema.sql) is what
// actually enforces access control; this key is safe to ship to the client.
//
// 2026-08-26: when the signed-in user is admin, every request must also carry
// the household they are currently "viewing as" (stored client-side only, in
// localStorage) so the database-level RLS policies (admin_household_ok(), see
// migration scope_admin_bypass_to_viewing_household) can scope admin's access
// to that one household instead of bypassing RLS globally. Read the value
// fresh on every request (not once at client-creation time) since the admin
// can switch households at any point without reloading the page.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          const hid = getAdminViewingHouseholdId();
          if (hid) headers.set("x-admin-viewing-household", hid);
          return fetch(input, { ...init, headers });
        },
      },
    }
  );
}
