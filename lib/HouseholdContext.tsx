"use client";

// Household member registry + Netflix-style active-profile/PIN gate.
// Client-only (localStorage + sessionStorage) until Supabase auth is wired up —
// see PROJECT-STATUS.md. PINs are never stored in plain text: hashed with
// SHA-256 via the browser's SubtleCrypto before touching storage.
//
// Storage split is intentional:
//   household.members            -> localStorage (persists across browser sessions)
//   household.activeMemberId/unlocked -> sessionStorage (re-pick profile each new
//                                        browser session, like Netflix)

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type HouseholdMember = {
  id: string;
  name: string;
  initial: string;
  pinHash: string | null;
};

const MEMBERS_KEY = "household.members";
const ACTIVE_KEY = "household.activeMemberId";
const UNLOCKED_KEY = "household.unlocked";

const DEFAULT_MEMBERS: HouseholdMember[] = [
  { id: "shenaal", name: "Shenaal", initial: "S", pinHash: null },
  { id: "shalini", name: "Shalini", initial: "S", pinHash: null },
];

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Ctx = {
  members: HouseholdMember[];
  activeMemberId: string | null;
  activeMember: HouseholdMember | null;
  unlocked: boolean;
  ready: boolean;
  selectMember: (id: string) => void;
  attemptUnlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  addMember: (name: string) => void;
  removeMember: (id: string) => void;
  renameMember: (id: string, name: string) => void;
  setPin: (id: string, pin: string) => Promise<void>;
  changePin: (id: string, currentPin: string, newPin: string) => Promise<boolean>;
  removePin: (id: string, currentPin: string) => Promise<boolean>;
};

const HouseholdCtx = createContext<Ctx | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = useState<HouseholdMember[]>(DEFAULT_MEMBERS);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);

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
    setReady(true);
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

  return (
    <HouseholdCtx.Provider
      value={{
        members,
        activeMemberId,
        activeMember,
        unlocked,
        ready,
        selectMember,
        attemptUnlock,
        lock,
        addMember,
        removeMember,
        renameMember,
        setPin,
        changePin,
        removePin,
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
