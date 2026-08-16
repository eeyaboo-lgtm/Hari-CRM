"use client";

// Full-screen Netflix-style "who's using this" + PIN gate. Wraps every route
// via app/layout.tsx. Skips itself on /login. Renders children only once a
// profile is picked and (if it has a PIN) unlocked for this browser session.

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Delete, Lock } from "lucide-react";
import { useHousehold } from "@/lib/HouseholdContext";
import PinSetupGate from "@/components/PinSetupGate";
import { logout } from "@/app/login/actions";

const GRADIENTS = [
  "from-accent-purple to-accent-blue",
  "from-accent-pink to-accent-orange",
  "from-accent-blue to-accent-green",
  "from-accent-orange to-accent-pink",
];

export default function ProfileGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { members, activeMember, unlocked, ready, isAdmin, needsPinSetup, selectMember, attemptUnlock, lock } =
    useHousehold();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (pathname === "/login") return <>{children}</>;
  if (!ready) return <div className="min-h-screen bg-base-bg" />;
  // Admin already proved identity with a real password at /login — skip the
  // local per-profile PIN layer entirely; they pick which household to view
  // from Settings instead.
  if (isAdmin) return <>{children}</>;
  // Shared-login households (e.g. a couple with one account) must set a
  // real PIN — which becomes their actual sign-in password — before doing
  // anything else.
  if (needsPinSetup) return <PinSetupGate />;
  if (activeMember && unlocked) return <>{children}</>;

  const needsPin = !!activeMember && !unlocked;

  // Wrong account on a shared device and no way to log out was a real gap
  // here too — same fix as PinSetupGate (2026-08-16).
  const signOutInstead = async () => {
    try {
      window.localStorage.removeItem("household.members");
      window.sessionStorage.removeItem("household.activeMemberId");
      window.sessionStorage.removeItem("household.unlocked");
      window.localStorage.removeItem("admin.viewingHouseholdId");
    } catch {}
    await logout();
  };

  const submitPin = async (value: string) => {
    setBusy(true);
    const ok = await attemptUnlock(value);
    setBusy(false);
    if (!ok) {
      setError("Wrong PIN, try again");
      setPin("");
    } else {
      setError("");
    }
  };

  const tapDigit = (d: string) => {
    if (busy) return;
    const next = (pin + d).slice(0, 6);
    setPin(next);
    if (next.length === 6) submitPin(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-base-bg px-6">
      {!needsPin ? (
        <>
          <h1 className="mb-8 text-2xl font-semibold text-white">Who&rsquo;s using Hari-CRM?</h1>
          <div className="flex flex-wrap justify-center gap-6">
            {members.map((m, i) => (
              <button
                key={m.id}
                onClick={() => selectMember(m.id)}
                className="group flex flex-col items-center gap-3"
              >
                <div
                  className={`glossy-gradient flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl font-semibold text-white shadow-glow-purple transition-transform group-hover:scale-105 ${GRADIENTS[i % GRADIENTS.length]}`}
                >
                  <span className="relative z-10">{m.initial}</span>
                </div>
                <span className="flex items-center gap-1 text-sm text-gray-300 group-hover:text-white">
                  {m.name}
                  {m.pinHash && <Lock size={11} className="text-gray-500" />}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-10 text-xs text-gray-600">Manage profiles &amp; PINs from Settings once unlocked.</p>
          <button type="button" onClick={signOutInstead} className="mt-3 text-xs text-gray-500 hover:text-white">
            Not your household? Log out
          </button>
        </>
      ) : (
        <>
          <h1 className="mb-2 text-xl font-semibold text-white">Enter PIN for {activeMember?.name}</h1>
          <p className="mb-6 h-4 text-xs text-red-400">{error}</p>
          <div className="mb-6 flex gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`h-3 w-3 rounded-full ${i < pin.length ? "bg-accent-purple" : "bg-white/10"}`} />
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
                  onClick={() => (d === "del" ? setPin((p) => p.slice(0, -1)) : tapDigit(d))}
                  className="glass-card flex h-14 w-14 items-center justify-center rounded-full text-lg text-white hover:bg-white/10"
                >
                  {d === "del" ? <Delete size={18} /> : d}
                </button>
              )
            )}
          </div>
          <button type="button" onClick={lock} className="mt-8 text-xs text-gray-500 hover:text-white">
            &larr; Choose a different profile
          </button>
          <button type="button" onClick={signOutInstead} className="mt-3 text-xs text-gray-500 hover:text-white">
            Log out instead
          </button>
        </>
      )}
    </div>
  );
}
