"use client";

// Household member registry + Netflix-style active-profile/PIN gate, now
// generalized for multiple walled-off households + an admin overlay role
// (2026-08-15 multi-household rewrite).
//
// PINs are never stored in plain text: hashed with SHA-256 via the
// browser's SubtleCrypto before touching storage.
//
// Storage split is intentional:
//   household.members            -> localStorage (persists across browser sessions)
//   household.activeMemberId/unlocked -> sessionStorage (re-pick profile each new
//                                        browser session, like Netflix)
//
// Member ids are now real profiles.id uuids (fetched from Supabase),
// reconciled on load against whatever's cached locally so existing PINs
// aren't lost. See lib/supabase/ownerMap.ts for why this matters — it's
// what lets Finance/Health/etc. attribute data to the right real person
// without a household-specific hardcoded mapping.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAdminViewingHouseholdId } from "@/lib/supabase/ownerMap";

export type HouseholdMember = {
  id: string;
  name: string;
  initial: string;
  pinHash: string | null;
};

const MEMBERS_KEY = "household.members";
const ACTIVE_KEY = "household.activeMemberId";
const UNLOCKED_KEY = "household.unlocked";

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Reconciles the locally-cached member list with the real household
// roster: matches by name (case-insensitive) so an existing member's
// pinHash carries over onto their real profile uuid, rather than
// resetting. Anything local that doesn't match a real profile (a custom
// label someone added) is kept, not silently dropped.
function mergeRealMembers(prevLocal: HouseholdMember[], real: { id: string; name: string }[]): HouseholdMember[] {
  const usedPrevIdx = new Set<number>();
  const merged: HouseholdMember[] = real.map((r) => {
    const idx = prevLocal.findIndex(
      (m, i) => !usedPrevIdx.has(i) && m.name.trim().toLowerCase() === r.name.trim().toLowerCase()
    );
    if (idx >= 0) {
      usedPrevIdx.add(idx);
      return { ...prevLocal[idx], id: r.id, name: r.name };
    }
    return { id: r.id, name: r.name, initial: r.name.charAt(0).toUpperCase() || "?", pinHash: null };
  });
  prevLocal.forEach((m, i) => {
    if (!usedPrevIdx.has(i)) merged.push(m);
  });
  return merged;
}

type Ctx = {
  members: HouseholdMember[];
  activeMemberId: string | null;
  activeMember: HouseholdMember | null;
  unlocked: boolean;
  ready: boolean;
  isAdmin: boolean;
  householdId: string | null;
  householdName: string | null;
  needsPinSetup: boolean;
  selectMember: (id: string) => void;
  attemptUnlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  addMember: (name: string) => void;
  removeMember: (id: string) => void;
  renameMember: (id: string, name: string) => void;
  setPin: (id: string, pin: string) => Promise<void>;
  changePin: (id: string, currentPin: string, newPin: string) => Promise<boolean>;
  removePin: (id: string, currentPin: string) => Promise<boolean>;
  refreshHousehold: () => Promise<void>;
  markPinSetupComplete: () => void;
};

const HouseholdCtx = createContext<Ctx | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState<string | null>(null);
  const [needsPinSetup, setNeedsPinSetup] = useState(false);

  const loadRealHousehold = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) return;
      const { data: me } = await supabase
        .from("profiles")
        .select("household_id, is_admin, needs_pin_setup")
        .eq("id", uid)
        .single();
      if (!me) return;
      const admin = !!me.is_admin;
      const hid = admin ? getAdminViewingHouseholdId() : me.household_id;
      setIsAdmin(admin);
      setHouseholdId(hid);
      setNeedsPinSetup(!admin && !!me.needs_pin_setup);

      if (!hid) {
        setHouseholdName(null);
        return;
      }
      const [{ data: household }, { data: rows }] = await Promise.all([
        supabase.from("households").select("name").eq("id", hid).single(),
        supabase.from("profiles").select("id, display_name").eq("household_id", hid),
      ]);
      setHouseholdName(household?.name ?? null);
      const real = (rows ?? []).map((r: any) => ({ id: r.id as string, name: r.display_name as string }));
      setMembers((prevLocal) => mergeRealMembers(prevLocal, real));
    } catch {
      // offline/unavailable — local cache (already loaded below) still works
    }
  }, []);

  useEffect(() => {
    try {
      const rawM = window.localStorage.getItem(MEMBERS_KEY);
      if (rawM) setMembers(JSON.parse(rawM));
      const rawA = window.sessionStorage.getItem(ACTIVE_KEY);
      if (rawA) setActiveMemberId(rawA);
      const rawU = window.sessionStorage.getItem(UNLOCKED_KEY);
      if (rawU === "1") setUnlocked(true);
    } catch {
      // storage unavailable — fall back to defaults, gate still works in-memory
    }
    loadRealHousehold().finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
    } catch {}
  }, [members, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      if (activeMemberId) window.sessionStorage.setItem(ACTIVE_KEY, activeMemberId);
      else window.sessionStorage.removeItem(ACTIVE_KEY);
    } catch {}
  }, [activeMemberId, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.sessionStorage.setItem(UNLOCKED_KEY, unlocked ? "1" : "0");
    } catch {}
  }, [unlocked, ready]);

  const activeMember = members.find((m) => m.id === activeMemberId) ?? null;

  const selectMember = useCallback(
    (id: string) => {
      setActiveMemberId(id);
      const m = members.find((x) => x.id === id);
      setUnlocked(!m?.pinHash);
    },
    [members]
  );

  const attemptUnlock = useCallback(
    async (pin: string) => {
      if (!activeMember?.pinHash) {
        setUnlocked(true);
        return true;
      }
      const hash = await sha256Hex(pin);
      const ok = hash === activeMember.pinHash;
      if (ok) setUnlocked(true);
      return ok;
    },
    [activeMember]
  );

  const lock = useCallback(() => {
    setActiveMemberId(null);
    setUnlocked(false);
  }, []);

  const addMember = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setMembers((prev) => [
      ...prev,
      { id: `m-${Date.now()}`, name: trimmed, initial: trimmed.charAt(0).toUpperCase(), pinHash: null },
    ]);
  }, []);

  const removeMember = useCallback(
    (id: string) => {
      setMembers((prev) => (prev.length <= 1 ? prev : prev.filter((m) => m.id !== id)));
      if (activeMemberId === id) {
        setActiveMemberId(null);
        setUnlocked(false);
      }
    },
    [activeMemberId]
  );

  const renameMember = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, name: trimmed, initial: trimmed.charAt(0).toUpperCase() } : m))
    );
  }, []);

  const setPin = useCallback(async (id: string, pin: string) => {
    const hash = await sha256Hex(pin);
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, pinHash: hash } : m)));
  }, []);

  const changePin = useCallback(
    async (id: string, currentPin: string, newPin: string) => {
      const m = members.find((x) => x.id === id);
      if (!m) return false;
      if (m.pinHash) {
        const hash = await sha256Hex(currentPin);
        if (hash !== m.pinHash) return false;
      }
      const newHash = await sha256Hex(newPin);
      setMembers((prev) => prev.map((x) => (x.id === id ? { ...x, pinHash: newHash } : x)));
      return true;
    },
    [members]
  );

  const removePin = useCallback(
    async (id: string, currentPin: string) => {
      const m = members.find((x) => x.id === id);
      if (!m || !m.pinHash) return true;
      const hash = await sha256Hex(currentPin);
      if (hash !== m.pinHash) return false;
      setMembers((prev) => prev.map((x) => (x.id === id ? { ...x, pinHash: null } : x)));
      return true;
    },
    [members]
  );

  const markPinSetupComplete = useCallback(() => setNeedsPinSetup(false), []);

  return (
    <HouseholdCtx.Provider
      value={{
        members,
        activeMemberId,
        activeMember,
        unlocked,
        ready,
        isAdmin,
        householdId,
        householdName,
        needsPinSetup,
        selectMember,
        attemptUnlock,
        lock,
        addMember,
        removeMember,
        renameMember,
        setPin,
        changePin,
        removePin,
        refreshHousehold: loadRealHousehold,
        markPinSetupComplete,
      }}
    >
      {children}
    </HouseholdCtx.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdCtx);
  if (!ctx) throw new Error("useHousehold must be used inside HouseholdProvider");
  return ctx;
}
