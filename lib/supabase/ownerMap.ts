"use client";

// Bridges the app's local household-member concept (HouseholdContext's
// member ids) to the schema's real model (owner_id uuid + a visibility
// flag), generalized for N walled-off households + an admin overlay role.
//
// Design (2026-08-15, multi-household rewrite):
//   - Every real household member's local id IS their real profiles.id
//     (no more hardcoded "shenaal"/"shalini" string matching — that only
//     ever worked for exactly one hardcoded 2-person household).
//   - local "shared" (or any unrecognized/legacy local id, e.g. old cached
//     "shenaal" strings from before this rewrite, or a custom member added
//     via HouseholdContext.addMember) -> the acting user's id,
//     visibility='mirrored_edit' (any household member can then edit it).
//   - Admin has no household of its own. When admin is "viewing as" a
//     household (see setAdminViewingHousehold), new rows are attributed to
//     that household's own first real member — not admin's uid — so the
//     actual family sees and can edit them too, not just admin.
//
// Reverse (reading a row back into local UI state):
//   visibility === 'mirrored_edit'      -> 'shared'
//   owner_id is one of this household's real member ids -> that id, as-is
//   anything else                       -> 'shared' (safe fallback)

import type { SupabaseClient } from "@supabase/supabase-js";

export type Visibility = "private" | "shared_view" | "mirrored_edit";

export type OwnerMap = {
  currentUserId: string | null;
  isAdmin: boolean;
  householdId: string | null;
  memberIds: string[];
  resolveOwner: (localOwnerId: string) => { owner_id: string; visibility: Visibility };
  unresolveOwner: (owner_id: string, visibility: string) => string;
};

const ADMIN_VIEW_KEY = "admin.viewingHouseholdId";

export function getAdminViewingHouseholdId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ADMIN_VIEW_KEY);
}

// Every localStorage key any useSupabaseSynced()/useSchemesSynced()/plain
// useLocalStorage() hook in the app uses as its offline cache — see
// Dashboard/GlobalSearch/AlertsBanner leak incident, 2026-08-26 session #30.
// None of these keys are namespaced by household: they are the SAME key on
// this device no matter which household's data was last painted into them.
// That is fine for an ordinary signed-in member (their own household_id
// never changes underneath them), but it is a real cross-household data
// leak for admin's "viewing as" mode: switching the viewed household does
// NOT invalidate this cache, so components that read straight from
// localStorage (DashboardLiveWidgets, AlertsBanner, GlobalSearch) keep
// showing the PREVIOUS household's real rows until something else happens
// to overwrite that exact key. Confirmed in production: admin switched from
// viewing "Shenaal & Shalini" to viewing "Shannon" and the Dashboard still
// showed Shenaal's real ENBD Personal Loan. Fix: wipe every one of these
// keys (plus each sync hook's own ".__pending" companion key) on every
// admin household switch, so nothing stale can ever be painted again.
const SYNCED_LOCAL_STORAGE_KEYS = [
  "business.ideas",
  "business.stack",
  "business.projects.v1",
  "business.ideaDraft",
  "calendar.events.v1",
  "finance.accounts.v4",
  "finance.cards.v4",
  "finance.cardSpends.v3",
  "finance.loans.v3",
  "finance.subs.v3",
  "finance.schemes.v1",
  "finance.income.v1",
  "finance.expenses.v1",
  "finance.monthlyBudget",
  "fitness.measurements",
  "fitness.cycleLogs",
  "health.conditions",
  "health.allergies",
  "health.appointments",
  "health.insurance",
  "memberships.items",
  "vision.goals",
  "visionBoardItems",
];

export function clearSyncedLocalCaches() {
  if (typeof window === "undefined") return;
  for (const key of SYNCED_LOCAL_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
    window.localStorage.removeItem(`${key}.__pending`);
  }
}

export function setAdminViewingHousehold(householdId: string | null) {
  if (typeof window === "undefined") return;
  if (householdId) window.localStorage.setItem(ADMIN_VIEW_KEY, householdId);
  else window.localStorage.removeItem(ADMIN_VIEW_KEY);
  clearOwnerMapCache();
  clearSyncedLocalCaches();
}

let cached: Promise<OwnerMap> | null = null;
let cachedKey = "";

export function getOwnerMap(supabase: SupabaseClient): Promise<OwnerMap> {
  const key = getAdminViewingHouseholdId() ?? "";
  if (cached && cachedKey === key) return cached;
  cachedKey = key;
  cached = build(supabase, key || null).catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}

export function clearOwnerMapCache() {
  cached = null;
  cachedKey = "";
}

async function build(supabase: SupabaseClient, adminViewingHouseholdId: string | null): Promise<OwnerMap> {
  const { data: userData } = await supabase.auth.getUser();
  const currentUserId = userData?.user?.id ?? null;

  if (!currentUserId) {
    return {
      currentUserId: null,
      isAdmin: false,
      householdId: null,
      memberIds: [],
      resolveOwner: () => ({ owner_id: "", visibility: "private" }),
      unresolveOwner: () => "shared",
    };
  }

  const { data: me } = await supabase.from("profiles").select("household_id, is_admin").eq("id", currentUserId).single();
  const isAdmin = !!me?.is_admin;
  const householdId = isAdmin ? adminViewingHouseholdId : me?.household_id ?? null;

  let memberIds: string[] = [];
  if (householdId) {
    const { data: members } = await supabase.from("profiles").select("id").eq("household_id", householdId);
    memberIds = (members ?? []).map((m: any) => m.id as string);
  } else if (!isAdmin) {
    memberIds = [currentUserId];
  }

  // Admin acting on behalf of a household with no membership of their own
  // there — attribute new rows to the household's own first real member.
  const actingOwnerId = isAdmin && householdId ? memberIds[0] ?? currentUserId : currentUserId;

  function resolveOwner(localOwnerId: string): { owner_id: string; visibility: Visibility } {
    if (memberIds.includes(localOwnerId)) return { owner_id: localOwnerId, visibility: "shared_view" };
    return { owner_id: actingOwnerId, visibility: "mirrored_edit" };
  }

  function unresolveOwner(owner_id: string, visibility: string): string {
    if (visibility === "mirrored_edit") return "shared";
    if (memberIds.includes(owner_id)) return owner_id;
    return "shared";
  }

  return { currentUserId, isAdmin, householdId, memberIds, resolveOwner, unresolveOwner };
}
