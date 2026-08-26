"use client";

// Bespoke sync for Finance's Payment schemes — a nested shape (Scheme with
// an embedded SchemeItem[]) backed by TWO tables (finance_payment_schemes +
// finance_payment_scheme_items). Doesn't fit useSupabaseSynced's flat-array
// contract, so it gets its own small hook rather than forcing the generic
// one to understand nesting. Same [value, setValue] signature as
// useLocalStorage/useSupabaseSynced, so the Finance page's JSX/handlers
// still don't need to change.
//
// Reliability (2026-08-23, same pass as useSupabaseSynced — see that file's
// header for the full incident this came out of): writes are now queued
// per hook instance instead of fired concurrently, and every write reports
// into the shared syncStatus store so a refresh mid-save is guarded by a
// beforeunload prompt and failures show up in the UI, not just the
// console. Doesn't yet have useSupabaseSynced's reload-time recovery of
// items an interrupted write dropped (the nested scheme+items shape makes
// that merge meaningfully more code) — the queueing + beforeunload guard
// already close most of the actual data-loss window, since the far more
// common failure mode is "the tab closed while a request was still in
// flight," not "the request permanently failed." Revisit if Payment
// Schemes ever shows the same symptom Allergies did.
//
// 2026-08-26: Allergies DID show a second symptom of the same root cause —
// `setValue` was silently dropping any edit made before the initial
// Supabase fetch resolved (`ready` still false), with no tracking at all,
// so there was nothing for the queueing/recovery above to retry. Applied
// the same pendingWriteRef fix here as in useSupabaseSynced.ts: an edit
// made in that window is recorded and synced against the real server
// baseline the moment the initial load finishes, instead of being lost.

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOwnerMap } from "@/lib/supabase/ownerMap";
import { beginWrite, clearError, reportError } from "@/lib/supabase/syncStatus";

type SchemeCadence = "onetime" | "monthly" | "termly" | "yearly";
type SchemeItem = { id: string; label: string; amount: number; cadence: SchemeCadence; dueDate: string; billingDay: number; paid: boolean };
type Scheme = { id: string; ownerId: string; name: string; institution: string; currency: "AED" | "LKR" | "USD"; items: SchemeItem[] };

const SCHEME_TABLE = "finance_payment_schemes";
const ITEM_TABLE = "finance_payment_scheme_items";

function schemeToRow(s: Scheme) {
  return { name: s.name, institution: s.institution || null, currency: s.currency };
}
function itemToRow(it: SchemeItem, schemeId: string) {
  return { scheme_id: schemeId, label: it.label, amount: it.amount, cadence: it.cadence, due_date: it.dueDate || null, billing_day: it.billingDay, paid: it.paid };
}

export function useSchemesSynced(localStorageKey: string, initialValue: Scheme[]) {
  const [value, setValueState] = useState<Scheme[]>(initialValue);
  const [ready, setReady] = useState(false);
  const lastSynced = useRef<Scheme[]>([]);
  const supabaseRef = useRef(createClient());
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingWriteRef = useRef<Scheme[] | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(localStorageKey);
      if (raw) setValueState(JSON.parse(raw));
    } catch {
      // ignore malformed cache
    }

    let cancelled = false;
    (async () => {
      const supabase = supabaseRef.current;
      try {
        const ownerMap = await getOwnerMap(supabase);
        // Same admin-scoping fix as useSupabaseSynced.ts (2026-08-26) — see
        // that file's comment for the full explanation. is_admin() bypasses
        // RLS globally, not per-viewed-household, so filter explicitly here.
        const adminIds = ownerMap.isAdmin
          ? (ownerMap.memberIds.length > 0 ? ownerMap.memberIds : ["00000000-0000-0000-0000-000000000000"])
          : null;
        let schemeQuery = supabase.from(SCHEME_TABLE).select("*");
        let itemQuery = supabase.from(ITEM_TABLE).select("*");
        if (adminIds) {
          schemeQuery = schemeQuery.in("owner_id", adminIds);
          itemQuery = itemQuery.in("owner_id", adminIds);
        }
        const [{ data: schemeRows, error: e1 }, { data: itemRows, error: e2 }] = await Promise.all([
          schemeQuery,
          itemQuery,
        ]);
        if (e1) throw e1;
        if (e2) throw e2;
        if (cancelled) return;
        const schemes: Scheme[] = (schemeRows ?? []).map((row: any) => ({
          id: row.id,
          ownerId: ownerMap.unresolveOwner(row.owner_id, row.visibility),
          name: row.name,
          institution: row.institution ?? "",
          currency: row.currency,
          items: (itemRows ?? [])
            .filter((it: any) => it.scheme_id === row.id)
            .map((it: any): SchemeItem => ({
              id: it.id, label: it.label, amount: Number(it.amount) || 0, cadence: it.cadence,
              dueDate: it.due_date ?? "", billingDay: Number(it.billing_day) || 1, paid: !!it.paid,
            })),
        }));
        lastSynced.current = schemes;

        // An edit made before this fetch resolved already carries `schemes`'
        // contents in its own history (setValue always builds `next` off
        // current state), so it supersedes `schemes` rather than needing a
        // merge — see the 2026-08-26 note above.
        const pendingWrite = pendingWriteRef.current;
        pendingWriteRef.current = null;
        const finalSchemes = pendingWrite ?? schemes;

        setValueState(finalSchemes);
        try {
          window.localStorage.setItem(localStorageKey, JSON.stringify(finalSchemes));
        } catch {
          // storage full/unavailable
        }
        if (pendingWrite) {
          console.warn("[useSchemesSynced] syncing edit(s) made before initial load finished");
          queueSync(pendingWrite);
        }
      } catch (err) {
        console.error("[useSchemesSynced] load failed", err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [localStorageKey]);

  const sync = useCallback(async (next: Scheme[]) => {
    const supabase = supabaseRef.current;
    const prev = lastSynced.current;
    const ownerMap = await getOwnerMap(supabase);
    let hadFailure = false;

    const prevSchemeMap = new Map(prev.map((s) => [s.id, s]));
    const nextSchemeIds = new Set(next.map((s) => s.id));
    for (const [id] of prevSchemeMap) {
      if (!nextSchemeIds.has(id)) {
        // cascade: delete items first (no FK cascade defined for this pair), then the scheme
        const { error: itemDelErr } = await supabase.from(ITEM_TABLE).delete().eq("scheme_id", id);
        if (itemDelErr) { console.error("[useSchemesSynced] item cascade delete failed", itemDelErr); hadFailure = true; }
        const { error: schemeDelErr } = await supabase.from(SCHEME_TABLE).delete().eq("id", id);
        if (schemeDelErr) { console.error("[useSchemesSynced] scheme delete failed", schemeDelErr); hadFailure = true; }
      }
    }

    const schemeIdPatches: Record<string, string> = {};
    for (const s of next) {
      const prevS = prevSchemeMap.get(s.id);
      const own = ownerMap.resolveOwner(s.ownerId);
      const row = { ...schemeToRow(s), owner_id: own.owner_id, visibility: own.visibility };
      if (!prevS) {
        const { data, error } = await supabase.from(SCHEME_TABLE).insert(row).select("id").single();
        if (error) {
          console.error("[useSchemesSynced] scheme insert failed", error);
          hadFailure = true;
          continue;
        }
        if (data?.id && data.id !== s.id) schemeIdPatches[s.id] = data.id;
      } else if (JSON.stringify(schemeToRow(prevS)) !== JSON.stringify(schemeToRow(s)) || prevS.ownerId !== s.ownerId) {
        const { error } = await supabase.from(SCHEME_TABLE).update(row).eq("id", s.id);
        if (error) { console.error("[useSchemesSynced] scheme update failed", error); hadFailure = true; }
      }
    }

    // Items: diff across the whole flattened set, resolved against the (possibly patched) real scheme id.
    const prevItems = prev.flatMap((s) => s.items.map((it) => ({ it, schemeId: s.id, ownerId: s.ownerId })));
    const prevItemMap = new Map(prevItems.map((x) => [x.it.id, x]));
    const nextItemsFlat = next.flatMap((s) => s.items.map((it) => ({ it, schemeId: schemeIdPatches[s.id] ?? s.id, ownerId: s.ownerId })));
    const nextItemIds = new Set(nextItemsFlat.map((x) => x.it.id));

    for (const [id] of prevItemMap) {
      if (!nextItemIds.has(id)) {
        const { error } = await supabase.from(ITEM_TABLE).delete().eq("id", id);
        if (error) { console.error("[useSchemesSynced] item delete failed", error); hadFailure = true; }
      }
    }

    const itemIdPatches: Record<string, string> = {};
    for (const { it, schemeId, ownerId } of nextItemsFlat) {
      const prevEntry = prevItemMap.get(it.id);
      const own = ownerMap.resolveOwner(ownerId);
      const row = { ...itemToRow(it, schemeId), owner_id: own.owner_id, visibility: own.visibility };
      if (!prevEntry) {
        const { data, error } = await supabase.from(ITEM_TABLE).insert(row).select("id").single();
        if (error) {
          console.error("[useSchemesSynced] item insert failed", error);
          hadFailure = true;
          continue;
        }
        if (data?.id && data.id !== it.id) itemIdPatches[it.id] = data.id;
      } else if (JSON.stringify(itemToRow(prevEntry.it, prevEntry.schemeId)) !== JSON.stringify(itemToRow(it, schemeId))) {
        const { error } = await supabase.from(ITEM_TABLE).update(row).eq("id", it.id);
        if (error) { console.error("[useSchemesSynced] item update failed", error); hadFailure = true; }
      }
    }

    const resolved = next.map((s) => ({
      ...s,
      id: schemeIdPatches[s.id] ?? s.id,
      items: s.items.map((it) => (itemIdPatches[it.id] ? { ...it, id: itemIdPatches[it.id] } : it)),
    }));
    lastSynced.current = resolved;
    if (hadFailure) {
      reportError("finance_payment_schemes", "Couldn't save some changes to Payment schemes — check your connection and try the edit again.");
    } else {
      clearError("finance_payment_schemes");
    }
    if (Object.keys(schemeIdPatches).length > 0 || Object.keys(itemIdPatches).length > 0) {
      setValueState((cur) =>
        cur.map((s) => ({
          ...s,
          id: schemeIdPatches[s.id] ?? s.id,
          items: s.items.map((it) => (itemIdPatches[it.id] ? { ...it, id: itemIdPatches[it.id] } : it)),
        }))
      );
    }
  }, []);

  const queueSync = useCallback(
    (next: Scheme[]) => {
      const endWrite = beginWrite();
      queueRef.current = queueRef.current
        .then(() => sync(next))
        .catch((err) => {
          console.error("[useSchemesSynced] sync failed", err);
        })
        .finally(() => endWrite());
    },
    [sync]
  );

  const setValue = useCallback(
    (updater: Scheme[] | ((prev: Scheme[]) => Scheme[])) => {
      setValueState((prev) => {
        const next = typeof updater === "function" ? (updater as (p: Scheme[]) => Scheme[])(prev) : updater;
        try {
          window.localStorage.setItem(localStorageKey, JSON.stringify(next));
        } catch {
          // storage full/unavailable
        }
        if (ready) {
          queueSync(next);
        } else {
          // Initial fetch hasn't resolved yet — record it instead of
          // silently dropping it, see the 2026-08-26 note above.
          pendingWriteRef.current = next;
        }
        return next;
      });
    },
    [localStorageKey, ready, queueSync]
  );

  return [value, setValue, { ready }] as const;
}
