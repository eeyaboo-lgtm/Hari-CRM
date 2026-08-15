"use client";

// Bespoke sync for Finance's Payment schemes — a nested shape (Scheme with
// an embedded SchemeItem[]) backed by TWO tables (finance_payment_schemes +
// finance_payment_scheme_items). Doesn't fit useSupabaseSynced's flat-array
// contract, so it gets its own small hook rather than forcing the generic
// one to understand nesting. Same [value, setValue] signature as
// useLocalStorage/useSupabaseSynced, so the Finance page's JSX/handlers
// still don't need to change.

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOwnerMap } from "@/lib/supabase/ownerMap";

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
        const [{ data: schemeRows, error: e1 }, { data: itemRows, error: e2 }] = await Promise.all([
          supabase.from(SCHEME_TABLE).select("*"),
          supabase.from(ITEM_TABLE).select("*"),
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
        setValueState(schemes);
        try {
          window.localStorage.setItem(localStorageKey, JSON.stringify(schemes));
        } catch {
          // storage full/unavailable
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

    const prevSchemeMap = new Map(prev.map((s) => [s.id, s]));
    const nextSchemeIds = new Set(next.map((s) => s.id));
    for (const [id] of prevSchemeMap) {
      if (!nextSchemeIds.has(id)) {
        // cascade: delete items first (no FK cascade defined for this pair), then the scheme
        await supabase.from(ITEM_TABLE).delete().eq("scheme_id", id);
        supabase.from(SCHEME_TABLE).delete().eq("id", id).then(({ error }) => {
          if (error) console.error("[useSchemesSynced] scheme delete failed", error);
        });
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
          continue;
        }
        if (data?.id && data.id !== s.id) schemeIdPatches[s.id] = data.id;
      } else if (JSON.stringify(schemeToRow(prevS)) !== JSON.stringify(schemeToRow(s)) || prevS.ownerId !== s.ownerId) {
        const { error } = await supabase.from(SCHEME_TABLE).update(row).eq("id", s.id);
        if (error) console.error("[useSchemesSynced] scheme update failed", error);
      }
    }

    // Items: diff across the whole flattened set, resolved against the (possibly patched) real scheme id.
    const prevItems = prev.flatMap((s) => s.items.map((it) => ({ it, schemeId: s.id, ownerId: s.ownerId })));
    const prevItemMap = new Map(prevItems.map((x) => [x.it.id, x]));
    const nextItemsFlat = next.flatMap((s) => s.items.map((it) => ({ it, schemeId: schemeIdPatches[s.id] ?? s.id, ownerId: s.ownerId })));
    const nextItemIds = new Set(nextItemsFlat.map((x) => x.it.id));

    for (const [id] of prevItemMap) {
      if (!nextItemIds.has(id)) {
        supabase.from(ITEM_TABLE).delete().eq("id", id).then(({ error }) => {
          if (error) console.error("[useSchemesSynced] item delete failed", error);
        });
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
          continue;
        }
        if (data?.id && data.id !== it.id) itemIdPatches[it.id] = data.id;
      } else if (JSON.stringify(itemToRow(prevEntry.it, prevEntry.schemeId)) !== JSON.stringify(itemToRow(it, schemeId))) {
        const { error } = await supabase.from(ITEM_TABLE).update(row).eq("id", it.id);
        if (error) console.error("[useSchemesSynced] item update failed", error);
      }
    }

    const resolved = next.map((s) => ({
      ...s,
      id: schemeIdPatches[s.id] ?? s.id,
      items: s.items.map((it) => (itemIdPatches[it.id] ? { ...it, id: itemIdPatches[it.id] } : it)),
    }));
    lastSynced.current = resolved;
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

  const setValue = useCallback(
    (updater: Scheme[] | ((prev: Scheme[]) => Scheme[])) => {
      setValueState((prev) => {
        const next = typeof updater === "function" ? (updater as (p: Scheme[]) => Scheme[])(prev) : updater;
        try {
          window.localStorage.setItem(localStorageKey, JSON.stringify(next));
        } catch {
          // storage full/unavailable
        }
        if (ready) sync(next);
        return next;
      });
    },
    [localStorageKey, ready, sync]
  );

  return [value, setValue, { ready }] as const;
}
