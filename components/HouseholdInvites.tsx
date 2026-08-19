"use client";

// Household-head-only card: generate an invite code so a second real person
// (their own Google/email login, not the shared-PIN model) can join THIS
// household instead of getting their own brand-new one. See lib/supabase's
// `redeem_household_invite` Postgres function (2026-08-19 migration
// `household_invites_and_head_role`) for the server-side half — codes are
// validated and redeemed entirely inside that SECURITY DEFINER function, so
// this component only ever needs to create/list/revoke rows here.
//
// Only rendered for the household's owner_id (the "head") — everyone else in
// the household can still see who's been invited (household_invites_select
// RLS allows any member to read), but only the head can create/revoke.

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, RotateCcw, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Invite = {
  id: string;
  code: string;
  uses_count: number;
  max_uses: number;
  revoked: boolean;
  expires_at: string | null;
  created_at: string;
};

export default function HouseholdInvites({ householdId }: { householdId: string }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isHead, setIsHead] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: userData }, { data: household }, { data: inviteRows, error: err }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("households").select("owner_id").eq("id", householdId).single(),
      supabase
        .from("household_invites")
        .select("id, code, uses_count, max_uses, revoked, expires_at, created_at")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false }),
    ]);
    setIsHead(!!userData?.user && household?.owner_id === userData.user.id);
    if (!err) setInvites((inviteRows as Invite[]) ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    const { error: err } = await supabase.from("household_invites").insert({
      household_id: householdId,
      created_by: user.id,
      max_uses: 1,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    load();
  };

  const revoke = async (id: string) => {
    const supabase = createClient();
    await supabase.from("household_invites").update({ revoked: true }).eq("id", id);
    load();
  };

  const copy = async (invite: Invite) => {
    const joinUrl = `${window.location.origin}/join?code=${invite.code}`;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId((c) => (c === invite.id ? null : c)), 2000);
    } catch {
      // clipboard unavailable — code is still shown on screen to copy manually
    }
  };

  const activeInvites = invites.filter((i) => !i.revoked && i.uses_count < i.max_uses);
  const usedOrRevoked = invites.filter((i) => i.revoked || i.uses_count >= i.max_uses);

  return (
    <div className="glass-card rounded-xl2 p-5">
      <h3 className="relative z-10 mb-1 flex items-center gap-2 font-medium text-white">
        <UserPlus size={16} className="text-accent-green" /> Invite someone to your household
      </h3>
      <p className="relative z-10 mb-4 text-xs text-gray-500">
        They sign in with their own Google account or email — no sharing your login — and enter this code once to
        join. Each code works one time; generate a new one per person.
      </p>

      {!isHead ? (
        <p className="relative z-10 text-xs text-gray-500">
          Only the household's original creator can generate invite codes. Ask them from this same screen.
        </p>
      ) : (
        <>
          {error && <p className="relative z-10 mb-3 text-xs text-red-400">{error}</p>}
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="relative z-10 mb-4 rounded-full bg-gradient-to-r from-accent-purple to-accent-blue px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {busy ? "Generating..." : "+ Generate invite code"}
          </button>

          {!loading && activeInvites.length > 0 && (
            <div className="relative z-10 space-y-2">
              {activeInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5"
                >
                  <div>
                    <span className="font-mono text-sm tracking-widest text-white">{inv.code}</span>
                    <p className="mt-0.5 text-[11px] text-gray-500">Not yet used</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copy(inv)}
                      className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 hover:text-white"
                    >
                      {copiedId === inv.id ? <Check size={13} /> : <Copy size={13} />}
                      {copiedId === inv.id ? "Copied" : "Copy link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => revoke(inv.id)}
                      className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-red-300"
                    >
                      <RotateCcw size={13} /> Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && activeInvites.length === 0 && usedOrRevoked.length === 0 && (
            <p className="relative z-10 text-xs text-gray-600">No invite codes yet.</p>
          )}

          {!loading && usedOrRevoked.length > 0 && (
            <details className="relative z-10 mt-4">
              <summary className="cursor-pointer text-[11px] text-gray-600 hover:text-gray-400">
                {usedOrRevoked.length} used / revoked code{usedOrRevoked.length !== 1 ? "s" : ""}
              </summary>
              <div className="mt-2 space-y-1">
                {usedOrRevoked.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between text-[11px] text-gray-600">
                    <span className="font-mono">{inv.code}</span>
                    <span>{inv.revoked ? "Revoked" : "Used"}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
