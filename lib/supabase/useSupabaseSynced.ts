"use client";

// Drop-in replacement for useLocalStorage<T[]> that also persists to a
// Supabase table, keyed by owner_id/visibility via ownerMap.ts. Same
// [value, setValue] signature as useLocalStorage, so pages that already use
// setX((prev) => [...prev, newItem]) style updates need ZERO JSX changes —
// only the hook declaration line changes.
//
// How it works:
//  - On mount: paints instantly from the localStorage cache, then fetches
//    the real rows from Supabase (source of truth) and replaces state.
//  - On every setValue call (once the initial fetch has completed): diffs
//    the new array against the last-known-server snapshot by `id` and fires
//    insert/update/delete calls. New items get a real DB-generated uuid
//    back, which silently replaces their temporary local id in state.
//  - localStorage is kept as an offline-friendly cache, not the source of
//    truth.
//
// Known limitation: if you reference a just-added row's id before the
// insert round-trip completes (e.g. logging a card spend the instant after
// adding the card), the reference may point at the temp id. Not an issue at
// normal human interaction speed; flagged here rather than solved, to keep
// this pass shippable. See HANDOVER.md.

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOwnerMap } from "@/lib/supabase/ownerMap";

type Mapper<T> = {
  /** Non-id/owner/visibility columns for this row, e.g. { name, currency, current_balance } */
  toRow: (item: T) => Record<string, unknown>;
  /** Reconstruct a UI item from a DB row + the resolved local ownerId ("shenaal"|"shalini"|"shared") */
  fromRow: (row: any, localOwnerId: string) => T;
  /** Pull the local ownerId field off a UI item, e.g. (item) => item.ownerId */
  ownerLocalId: (item: T) => string;
};

export function useSupabaseSynced<T extends { id: string }>(
  table: string,
  localStorageKey: string,
  initialValue: T[],
  mapper: Mapper<T>
) {
  const [value, setValueState] = useState<T[]>(initialValue);
  const [ready, setReady] = useState(false);
  const lastSynced = useRef<T[]>([]);
  const supabaseRef = useRef(createClient());
  const mapperRef = useRef(mapper);
  mapperRef.current = mapper;

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
        const { data, error } = await supabase.from(table).select("*");
        if (error) throw error;
        if (cancelled || !data) return;
        const rows = data.map((row: any) =>
          mapperRef.current.fromRow(row, ownerMap.unresolveOwner(row.owner_id, row.visibility))
        );
        lastSynced.current = rows;
        setValueState(rows);
        try {
          window.localStorage.setItem(localStorageKey, JSON.stringify(rows));
        } catch {
          // storage full/unavailable — in-memory state still works
        }
      } catch (err) {
        console.error(`[useSupabaseSynced:${table}] load failed`, err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [table, localStorageKey]);

  const sync = useCallback(
    async (next: T[]) => {
      const supabase = supabaseRef.current;
      const m = mapperRef.current;
      const prev = lastSynced.current;
      const prevMap = new Map(prev.map((x) => [x.id, x]));
      const nextIds = new Set(next.map((x) => x.id));
      const ownerMap = await getOwnerMap(supabase);

      for (const [id] of prevMap) {
        if (!nextIds.has(id)) {
          supabase
            .from(table)
            .delete()
            .eq("id", id)
            .then(({ error }) => {
              if (error) console.error(`[useSupabaseSynced:${table}] delete failed`, error);
            });
        }
      }

      const idPatches: Record<string, string> = {};
      for (const item of next) {
        const prevItem = prevMap.get(item.id);
        const own = ownerMap.resolveOwner(m.ownerLocalId(item));
        const row = { ...m.toRow(item), owner_id: own.owner_id, visibility: own.visibility };
        if (!prevItem) {
          const { data, error } = await supabase.from(table).insert(row).select("id").single();
          if (error) {
            console.error(`[useSupabaseSynced:${table}] insert failed`, error);
            continue;
          }
          if (data?.id && data.id !== item.id) idPatches[item.id] = data.id;
        } else if (
          JSON.stringify(m.toRow(prevItem)) !== JSON.stringify(m.toRow(item)) ||
          m.ownerLocalId(prevItem) !== m.ownerLocalId(item)
        ) {
          const { error } = await supabase.from(table).update(row).eq("id", item.id);
          if (error) console.error(`[useSupabaseSynced:${table}] update failed`, error);
        }
      }

      const resolved = next.map((x) => (idPatches[x.id] ? { ...x, id: idPatches[x.id] } : x));
      lastSynced.current = resolved;
      if (Object.keys(idPatches).length > 0) {
        setValueState((cur) => cur.map((x) => (idPatches[x.id] ? { ...x, id: idPatches[x.id] } : x)));
      }
    },
    [table]
  );

  const setValue = useCallback(
    (updater: T[] | ((prev: T[]) => T[])) => {
      setValueState((prev) => {
        const next = typeof updater === "function" ? (updater as (p: T[]) => T[])(prev) : updater;
        try {
          window.localStorage.setItem(localStorageKey, JSON.stringify(next));
        } catch {
          // storage full/unavailable — in-memory state still works
        }
        if (ready) sync(next);
        return next;
      });
    },
    [localStorageKey, ready, sync]
  );

  return [value, setValue, { ready }] as const;
}
