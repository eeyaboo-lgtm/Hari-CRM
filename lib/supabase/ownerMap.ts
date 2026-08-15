"use client";

// Bridges the app's local household-member concept ("shenaal" | "shalini" |
// "shared", from HouseholdContext) to the schema's real model (owner_id uuid
// + a visibility flag). There is no "shared" row type in the DB — only a
// real person's uuid plus a visibility level.
//
// Locked design (see memory "Hari-CRM Project Info", 2026-08-15):
//   local "shenaal" -> Shenaal's real profiles.id, visibility='shared_view'
//   local "shalini" -> Shalini's real profiles.id, visibility='shared_view'
//   local "shared"  -> current signed-in user's id, visibility='mirrored_edit'
//     (either household member can then edit it, via RLS)
//
// Reverse (reading a row back into the local shape):
//   visibility === 'mirrored_edit'                -> 'shared'
//   owner_id matches Shenaal's profile id          -> 'shenaal'
//   owner_id matches Shalini's profile id          -> 'shalini'
//
// This is the ONLY place that should know about this mapping — pages should
// call resolveOwner/unresolveOwner rather than touching profiles directly.

import type { SupabaseClient } from "@supabase/supabase-js";

export type Visibility = "private" | "shared_view" | "mirrored_edit";

export type OwnerMap = {
  shenaalId: string | null;
  shaliniId: string | null;
  currentUserId: string | null;
  /** local ownerId ("shenaal" | "shalini" | "shared" | anything else) -> DB row fields */
  resolveOwner: (localOwnerId: string) => { owner_id: string; visibility: Visibility };
  /** DB row fields -> local ownerId, for reading rows back into UI state */
  unresolveOwner: (owner_id: string, visibility: string) => string;
};

let cached: Promise<OwnerMap> | null = null;

export function getOwnerMap(supabase: SupabaseClient): Promise<OwnerMap> {
  if (cached) return cached;
  cached = build(supabase).catch((err) => {
    cached = null; // allow retry on next call if this failed (e.g. not signed in yet)
    throw err;
  });
  return cached;
}

async function build(supabase: SupabaseClient): Promise<OwnerMap> {
  const [{ data: profiles }, { data: userData }] = await Promise.all([
    supabase.from("profiles").select("id, role"),
    supabase.auth.getUser(),
  ]);

  const shenaalId = profiles?.find((p) => p.role === "Shenaal")?.id ?? null;
  const shaliniId = profiles?.find((p) => p.role === "Shalini")?.id ?? null;
  const currentUserId = userData?.user?.id ?? null;

  function resolveOwner(localOwnerId: string): { owner_id: string; visibility: Visibility } {
    const id = (localOwnerId || "").toLowerCase();
    if (id === "shenaal" && shenaalId) return { owner_id: shenaalId, visibility: "shared_view" };
    if (id === "shalini" && shaliniId) return { owner_id: shaliniId, visibility: "shared_view" };
    // "shared" or any unrecognized/custom member id — fall back to the
    // current user as owner with joint edit rights.
    return { owner_id: currentUserId ?? shenaalId ?? shaliniId ?? "", visibility: "mirrored_edit" };
  }

  function unresolveOwner(owner_id: string, visibility: string): string {
    if (visibility === "mirrored_edit") return "shared";
    if (owner_id === shenaalId) return "shenaal";
    if (owner_id === shaliniId) return "shalini";
    return "shared";
  }

  return { shenaalId, shaliniId, currentUserId, resolveOwner, unresolveOwner };
}

/** Call after sign-out or when switching test users, so the next getOwnerMap() rebuilds. */
export function clearOwnerMapCache() {
  cached = null;
}
