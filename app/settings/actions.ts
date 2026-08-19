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

// ============================================================
// Admin household overview + JSON export (2026-08-19)
// "Backup" here is an app-level, portable JSON snapshot of one household's
// data — deliberately separate from Supabase's own daily/PITR backups
// (check the project's plan in the Supabase dashboard for those; this is
// the host-agnostic half, useful for migration or an accidental-deletion
// recovery without waiting on Supabase support).
// ============================================================

// Every table keyed off owner_id -> profiles(id) — see schema.sql /
// list_tables. fx_rates is global (not household-scoped) and audit_log is a
// log, not user data, so both are deliberately excluded. Keep this in sync
// if a new owner-scoped table is added (same manual-enumeration pattern the
// rest of this codebase already uses, e.g. install_household_rls call
// sites).
const HOUSEHOLD_DATA_TABLES = [
  "health_records",
  "health_appointments",
  "health_log_notes",
  "health_allergies",
  "finance_accounts",
  "finance_transactions",
  "finance_loans",
  "finance_subscriptions",
  "finance_income",
  "finance_debts",
  "finance_cards",
  "finance_card_spends",
  "finance_payment_schemes",
  "finance_payment_scheme_items",
  "finance_expenses",
  "business_projects",
  "business_accounts",
  "business_ideas",
  "business_stack",
  "board_items",
  "memberships",
  "vision_goals",
] as const;

export type HouseholdOverviewRow = {
  householdId: string;
  householdName: string;
  slug: string;
  createdAt: string;
  ownerId: string | null;
  ownerName: string | null;
  memberCount: number;
  lastActiveAt: string | null; // most recent last_sign_in_at across members
};

export async function listHouseholdsOverview(): Promise<HouseholdOverviewRow[]> {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: households }, { data: profiles }] = await Promise.all([
    admin.from("households").select("id, name, slug, owner_id, created_at").order("created_at", { ascending: false }),
    admin.from("profiles").select("id, display_name, household_id").not("household_id", "is", null),
  ]);

  // listUsers() is paginated (default 50/page) — fine at this app's scale;
  // revisit with pagination if the user base grows well past that.
  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 200 });
  const lastSignInById = new Map((usersPage?.users ?? []).map((u) => [u.id, u.last_sign_in_at]));

  const profilesByHousehold = new Map<string, { id: string; display_name: string }[]>();
  for (const p of (profiles ?? []) as any[]) {
    const list = profilesByHousehold.get(p.household_id) ?? [];
    list.push({ id: p.id, display_name: p.display_name });
    profilesByHousehold.set(p.household_id, list);
  }

  return (households ?? []).map((h: any) => {
    const members = profilesByHousehold.get(h.id) ?? [];
    const owner = members.find((m) => m.id === h.owner_id) ?? null;
    const lastActiveAt =
      members
        .map((m) => lastSignInById.get(m.id))
        .filter((d): d is string => !!d)
        .sort()
        .pop() ?? null;
    return {
      householdId: h.id,
      householdName: h.name,
      slug: h.slug,
      createdAt: h.created_at,
      ownerId: h.owner_id,
      ownerName: owner?.display_name ?? null,
      memberCount: members.length,
      lastActiveAt,
    };
  });
}

export async function backupHousehold(
  householdId: string
): Promise<{ ok: true; filename: string; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const { data: household, error: hErr } = await admin
      .from("households")
      .select("id, name, slug, owner_id, created_at")
      .eq("id", householdId)
      .single();
    if (hErr || !household) return { ok: false, error: "Household not found" };

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, avatar_path, is_admin, needs_pin_setup, created_at")
      .eq("household_id", householdId);

    const snapshot: Record<string, unknown> = {
      _meta: {
        exportedAt: new Date().toISOString(),
        schemaVersion: 1,
        householdId,
      },
      household,
      profiles: profiles ?? [],
    };

    const memberIds = (profiles ?? []).map((p: any) => p.id);
    for (const table of HOUSEHOLD_DATA_TABLES) {
      if (memberIds.length === 0) {
        snapshot[table] = [];
        continue;
      }
      const { data, error } = await admin.from(table).select("*").in("owner_id", memberIds);
      if (error) {
        snapshot[table] = { _error: error.message };
        continue;
      }
      snapshot[table] = data ?? [];
    }

    const safeSlug = (household.slug || "household").replace(/[^a-z0-9-]/gi, "-");
    const filename = `${safeSlug}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    return { ok: true, filename, data: snapshot };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Backup failed" };
  }
}

// Restore is intentionally NOT implemented yet — see HANDOVER.md "Next up"
// for the design (validate shape, admin-only, scoped delete+reinsert per
// table keyed by owner_id, typed confirmation before running). Shipping
// export first so real backups exist; the destructive half is next, not
// skipped by accident.
