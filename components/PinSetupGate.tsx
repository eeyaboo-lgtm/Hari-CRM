"use client";

// Forced first-launch screen for a household whose login is a shared
// account (e.g. Natasha & Arun) — profiles.needs_pin_setup = true until
// this runs once. Unlike the existing per-profile "quick unlock" PIN in
// Settings (a local SHA-256 gate, never touches the server), THIS PIN
// becomes the household's real Supabase Auth sign-in password — it's the
// only credential this login has, so it has to be the real one, not a
// local-only convenience layer.

import { useState } from "react";
import { Delete } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/HouseholdContext";
import { logout } from "@/app/login/actions";

export default function PinSetupGate() {
  const { members, selectMember, refreshHousehold, markPinSetupComplete } = useHousehold();
  const [stage, setStage] = useState<"enter" | "confirm">("enter");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const activePin = stage === "enter" ? pin : confirmPin;
  const setActivePin = stage === "enter" ? setPin : setConfirmPin;

  const finish = async (finalPin: string) => {
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: pwErr } = await supabase.auth.updateUser({ password: finalPin });
      if (pwErr) throw pwErr;
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (uid) {
        await supabase.from("profiles").update({ needs_pin_setup: false }).eq("id", uid);
      }
      markPinSetupComplete();
      await refreshHousehold();
      if (uid) selectMember(uid);
    } catch (err) {
      console.error("[PinSetupGate] failed to set PIN", err);
      setError("Couldn't save that PIN — check your connection and try again.");
      setStage("enter");
      setPin("");
      setConfirmPin("");
    } finally {
      setBusy(false);
    }
  };

  const tapDigit = (d: string) => {
    if (busy) return;
    const next = (activePin + d).slice(0, 6);
    setActivePin(next);
    if (next.length === 6) {
      if (stage === "enter") {
        setStage("confirm");
      } else if (next === pin) {
        finish(next);
      } else {
        setError("PINs didn't match — try again");
        setStage("enter");
        setPin("");
        setConfirmPin("");
      }
    }
  };

  const householdLabel = members[0]?.name ?? "your household";

  // This screen is a hard block with nothing else rendered underneath it,
  // and (until this fix, 2026-08-16) had no way out at all if you landed
  // here by mistake or on the wrong shared device — no back button, no
  // logout, nothing. Every full-screen gate in this app should always
  // leave an escape hatch back to /login.
  const signOutInstead = async () => {
    if (busy) return;
    try {
      window.localStorage.removeItem("household.members");
      window.sessionStorage.removeItem("household.activeMemberId");
      window.sessionStorage.removeItem("household.unlocked");
      window.localStorage.removeItem("admin.viewingHouseholdId");
    } catch {}
    await logout();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-base-bg px-6">
      <h1 className="mb-2 text-xl font-semibold text-white">
        {stage === "enter" ? `Set a 6-digit PIN for ${householdLabel}` : "Confirm your PIN"}
      </h1>
      <p className="mb-6 max-w-sm text-center text-xs text-gray-500">
        {stage === "enter"
          ? "This becomes your sign-in password — use it (with your email) to log back in from any device."
          : "Enter it once more to confirm."}
      </p>
      <p className="mb-4 h-4 text-xs text-red-400">{error}</p>
      <div className="mb-6 flex gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`h-3 w-3 rounded-full ${i < activePin.length ? "bg-accent-purple" : "bg-white/10"}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((d, i) =>
          d === "" ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={busy}
              onClick={() => (d === "del" ? setActivePin((p) => p.slice(0, -1)) : tapDigit(d))}
              className="glass-card flex h-14 w-14 items-center justify-center rounded-full text-lg text-white hover:bg-white/10 disabled:opacity-50"
            >
              {d === "del" ? <Delete size={18} /> : d}
            </button>
          )
        )}
      </div>
      <button type="button" onClick={signOutInstead} className="mt-8 text-xs text-gray-500 hover:text-white">
        Not you? Log out
      </button>
    </div>
  );
}
