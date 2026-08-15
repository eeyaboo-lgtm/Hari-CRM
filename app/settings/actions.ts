"use server";

// Admin-only account recovery actions. Uses Supabase's real Admin API
// (auth.admin.updateUserById) rather than touching auth.users columns
// directly — the supported, correct way to reset someone's password
// server-side. Every action re-checks is_admin() itself from the caller's
// own session; never trust a client-supplied "I'm admin" flag.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) throw new Error("Not authorized");
  return user;
}

export async function adminResetPassword(
  targetUserId: string,
  newPassword: string,
  forcePinSetup: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    if (!newPassword || newPassword.length < 6) {
      return { ok: false, error: "Password/PIN must be at least 6 characters" };
    }
    const admin = createAdminClient();
    const { error: pwErr } = await admin.auth.admin.updateUserById(targetUserId, { password: newPassword });
    if (pwErr) return { ok: false, error: pwErr.message };
    if (forcePinSetup) {
      await admin.from("profiles").update({ needs_pin_setup: true }).eq("id", targetUserId);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Reset failed" };
  }
}

export async function listHouseholdLogins(): Promise<
  { householdId: string; householdName: string; userId: string; email: string; displayName: string }[]
> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name, household_id, households(name)")
    .not("household_id", "is", null);
  const rows = profiles ?? [];
  const out: { householdId: string; householdName: string; userId: string; email: string; displayName: string }[] = [];
  for (const p of rows as any[]) {
    const { data: userData } = await admin.auth.admin.getUserById(p.id);
    out.push({
      householdId: p.household_id,
      householdName: p.households?.name ?? "",
      userId: p.id,
      email: userData?.user?.email ?? "",
      displayName: p.display_name,
    });
  }
  return out;
}
