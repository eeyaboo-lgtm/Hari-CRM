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

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAdminViewingHouseholdId, clearOwnerMapCache } from "@/lib/supabase/ownerMap";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reconciles the locally-cached member list with the real household
// roster: matches by name (case-insensitive) so an existing member's
// pinHash carries over onto their real profile uuid, rather than
// resetting.
//
// IMPORTANT: this browser's localStorage is shared across whichever
// account happens to be signed in on it — it is NOT scoped per Supabase
// session. If this browser was previously used for a *different*
// household (or admin viewing a different household), stale real-profile
// entries from that other household must not leak into this one. Only
// genuine local-only custom labels (ids from addMember, shaped "m-...",
// never backed by a real profile) are preserved as extras; anything that
// looks like a real profile uuid but isn't in the CURRENT household's
// fetched roster is dropped, not carried forward.
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
    if (usedPrevIdx.has(i)) return;
    if (UUID_RE.test(m.id)) return; // stale real member from a different household on this browser — drop it
    merged.push(m);
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

  const fetchInFlightRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 2026-08-16 (session #13) hardening: the 5c73c70 fix stopped a
  // transient fetch error from WIPING an already-good member cache, but
  // it did nothing to RECOVER a cache that was already bad (e.g. a
  // browser tab left open since before that fix shipped, or a genuinely
  // repeated failure this session) -- it just gave up silently for the
  // rest of the session. Since Finance/Health/etc. all derive their owner
  // dropdowns from `members`, "give up silently" looked identical to the
  // original bug: tabs/dropdowns stuck on Household/Shared only, no error
  // visible anywhere. Three layers added so this class of bug can't
  // recur invisibly:
  //   1. Retry with backoff instead of one-shot — a real blip now heals
  //      itself within seconds instead of requiring a manual reload.
  //   2. Self floor — even if the roster query keeps failing, the
  //      currently signed-in person is guaranteed to appear in `members`
  //      (never JUST "Shared"), because we already know who they are
  //      from the `me` row that succeeded.
  //   3. Refetch on tab refocus (see the visibilitychange effect below) —
  //      closes the "stale long-lived tab" hole without requiring the
  //      user to know to hard-refresh after a deploy.
  const loadRealHousehold = useCallback(async (attempt = 0): Promise<void> => {
    if (attempt === 0) {
      if (fetchInFlightRef.current) return;
      fetchInFlightRef.current = true;
    }
    const scheduleRetry = () => {
      if (attempt >= 4) {
        fetchInFlightRef.current = false;
        return;
      }
      const delay = 1000 * Math.pow(2, attempt); // 1s,2s,4s,8s
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => loadRealHousehold(attempt + 1), delay);
    };
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) {
        fetchInFlightRef.current = false;
        return;
      }
      const { data: me, error: meError } = await supabase
        .from("profiles")
        .select("household_id, is_admin, needs_pin_setup, display_name")
        .eq("id", uid)
        .single();
      if (meError || !me) {
        console.error("[HouseholdContext] self profile fetch failed, will retry", meError);
        scheduleRetry();
        return;
      }
      const admin = !!me.is_admin;
      const hid = admin ? getAdminViewingHouseholdId() : me.household_id;
      setIsAdmin(admin);
      setHouseholdId(hid);
      setNeedsPinSetup(!admin && !!me.needs_pin_setup);

      if (!hid) {
        setHouseholdName(null);
        fetchInFlightRef.current = false;
        return;
      }
      const [{ data: household }, { data: rows, error: rowsError }] = await Promise.all([
        supabase.from("households").select("name").eq("id", hid).single(),
        supabase.from("profiles").select("id, display_name").eq("household_id", hid),
      ]);
      setHouseholdName(household?.name ?? null);
      if (!rowsError) {
        const real = (rows ?? []).map((r: any) => ({ id: r.id as string, name: r.display_name as string }));
        // Self floor: guarantee the signed-in user is present even if the
        // household roster query returned a partial/empty result for some
        // other reason (RLS edge case, race on a just-created household).
        if (!admin && me.display_name && !real.some((r) => r.id === uid)) {
          real.push({ id: uid, name: me.display_name as string });
        }
        setMembers((prevLocal) => mergeRealMembers(prevLocal, real));
        fetchInFlightRef.current = false;
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      } else {
        console.error("[HouseholdContext] roster fetch failed, keeping cached members and retrying", rowsError);
        scheduleRetry();
      }
    } catch (err) {
      console.error("[HouseholdContext] loadRealHousehold threw, keeping cached members and retrying", err);
      scheduleRetry();
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

  // Re-fetch whenever the signed-in Supabase user actually changes.
  //
  // The bug this fixes: logging out and back in as a different account
  // (e.g. Shenaal -> admin, or Shenaal -> Shannon on the same browser)
  // happens via a server-action redirect, which Next.js handles as a
  // client-side navigation — the root layout, and therefore this
  // provider, never remounts. The mount-only effect above ran once for
  // the FIRST session of the page load and never again, so every field
  // computed from "who am I" (isAdmin, householdId, householdName,
  // members, needsPinSetup) kept showing the previous account's values
  // even though the browser was now authenticated as someone else —
  // e.g. admin's Settings page silently rendering as if signed in as
  // Shenaal, with none of the admin-only sections appearing.
  //
  // ownerMap.ts's module-level cache has the same "who am I" staleness
  // problem for a different reason (its cache key doesn't vary by
  // signed-in user), so it's cleared here too on every real account
  // switch, not just here.
  useEffect(() => {
    const supabase = createClient();
    let lastUid: string | null | undefined = undefined; // undefined = not yet seen
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      if (lastUid === undefined) {
        // First callback (Supabase's own INITIAL_SESSION) just tells us
        // who's already signed in — the mount effect above is already
        // fetching for them, so record and skip to avoid a duplicate
        // fetch.
        lastUid = uid;
        return;
      }
      if (uid === lastUid) return; // token refresh etc. — same user, nothing to do
      lastUid = uid;
      clearOwnerMapCache();
      // Session-scoped local picks belong to the PREVIOUS account —
      // don't let them carry over into the new one.
      setActiveMemberId(null);
      setUnlocked(false);
      try {
        window.sessionStorage.removeItem(ACTIVE_KEY);
        window.sessionStorage.removeItem(UNLOCKED_KEY);
      } catch {}
      if (!uid) {
        // Signed out — clear everything derived from "who am I" rather
        // than waiting for a sign-in that may not come right away.
        setIsAdmin(false);
        setHouseholdId(null);
        setHouseholdName(null);
        setNeedsPinSetup(false);
        return;
      }
      // Bug fixed 2026-08-16: switching TO a new account (e.g. logging in
      // as Natasha & Arun right after an admin session) is also a
      // server-action redirect, so this component doesn't remount and
      // `ready` was already true from the previous account's session.
      // ProfileGate reads `ready`/`isAdmin`/`needsPinSetup` synchronously
      // on render, so for the ~1-2s this fetch takes, it was rendering
      // the PREVIOUS account's already-unlocked dashboard — a real
      // privacy leak on a shared device, only self-correcting once the
      // user navigated again (by which point the wrong content had
      // already been on screen). Drop `ready` back to false for the
      // duration of the refetch so ProfileGate shows its blank loading
      // state instead of stale/previous-account content.
      setReady(false);
      loadRealHousehold().finally(() => setReady(true));
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch on tab refocus, throttled to at most once/minute. Closes the
  // "long-lived tab left open since before a deploy/fix went live" hole --
  // without this, a browser tab could sit on a stale/wiped member cache
  // for the rest of its session with nothing to trigger a recheck.
  useEffect(() => {
    const lastFetch = { current: 0 };
    const maybeRefetch = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastFetch.current < 60_000) return;
      lastFetch.current = now;
      loadRealHousehold();
    };
    document.addEventListener("visibilitychange", maybeRefetch);
    window.addEventListener("focus", maybeRefetch);
    return () => {
      document.removeEventListener("visibilitychange", maybeRefetch);
      window.removeEventListener("focus", maybeRefetch);
    };
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
