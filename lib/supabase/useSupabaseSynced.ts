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
// Reliability (rewritten 2026-08-23 — see [[project_hari_finance_ux_labels]]
// / HANDOFF.md for the full incident this came out of: 3 allergy entries
// added, page refreshed, all 3 gone):
//  - Writes are now QUEUED per hook instance (queueRef), not fired
//    concurrently. The old version called sync(next) fresh on every
//    setValue with no await, so two quick edits raced on the same
//    lastSynced.current snapshot and could double-insert or drop a write.
//  - Every write is wrapped in the shared syncStatus store's
//    beginWrite()/end() — this both powers the "Saving…" indicator AND
//    arms a beforeunload guard, so a refresh/close mid-save now prompts
//    the browser's native "changes may not be saved" dialog instead of
//    silently cancelling the request.
//  - Failed writes are tracked as "pending" ids in a companion localStorage
//    key. If the save never completes (write genuinely failed, tab closed
//    anyway, offline, etc.), the NEXT time this hook mounts it recovers
//    those items from the local cache — even though the server fetch says
//    they don't exist — merges them back into state, and immediately
//    retries saving them. This turns "silently vanished" into
//    "auto-retries until it actually saves," which is the behavior a
//    personal assistant app should have: the user shouldn't have to notice
//    or intervene for their own data to stick.
//  - Failures now also call reportError() so SaveStatusIndicator can tell
//    the user something didn't save, instead of only the browser console.
//
// Known limitation: if you reference a just-added row's id before the
// insert round-trip completes (e.g. logging a card spend the instant after
// adding the card), the reference may point at the temp id. Not an issue at
// normal human interaction speed; flagged here rather than solved, to keep
// this pass shippable. See HANDOVER.md.

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOwnerMap } from "@/lib/supabase/ownerMap";
import { beginWrite, clearError, reportError } from "@/lib/supabase/syncStatus";

type Mapper<T> = {
  /** Non-id/owner/visibility columns for this row, e.g. { name, currency, current_balance } */
  toRow: (item: T) => Record<string, unknown>;
  /** Reconstruct a UI item from a DB row + the resolved local ownerId ("shenaal"|"shalini"|"shared") */
  fromRow: (row: any, localOwnerId: string) => T;
  /** Pull the local ownerId field off a UI item, e.g. (item) => item.ownerId */
  ownerLocalId: (item: T) => string;
};

function pendingKey(localStorageKey: string) {
  return `${localStorageKey}.__pending`;
}

function readPendingIds(localStorageKey: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(pendingKey(localStorageKey));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writePendingIds(localStorageKey: string, ids: Set<string>) {
  try {
    if (ids.size === 0) window.localStorage.removeItem(pendingKey(localStorageKey));
    else window.localStorage.setItem(pendingKey(localStorageKey), JSON.stringify(Array.from(ids)));
  } catch {
    // storage full/unavailable
  }
}

function friendlyTableName(table: string) {
  return table.replace(/^(health|finance|business)_/, "").replace(/_/g, " ");
}

export function useSupabaseSynced<T extends { id: string }>(
  table: string,
  localStorageKey: string,
  initialValue: T[],
  mapper: Mapper<T>,
  /**
   * Extra columns that both filter the select (rows must match these) AND
   * get merged into every insert/update row. Use this when several UI
   * sections share one physical table via a discriminator column, e.g.
   * Health's Conditions and Insurance both live in health_records but are
   * told apart by record_type — { record_type: "condition" }.
   */
  staticFields?: Record<string, unknown>
) {
  const [value, setValueState] = useState<T[]>(initialValue);
  const [ready, setReady] = useState(false);
  const lastSynced = useRef<T[]>([]);
  const supabaseRef = useRef(createClient());
  const mapperRef = useRef(mapper);
  mapperRef.current = mapper;
  const staticFieldsRef = useRef(staticFields ?? {});
  staticFieldsRef.current = staticFields ?? {};
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const sync = useCallback(
    async (next: T[]) => {
      const supabase = supabaseRef.current;
      const m = mapperRef.current;
      const prev = lastSynced.current;
      const prevMap = new Map(prev.map((x) => [x.id, x]));
      const nextIds = new Set(next.map((x) => x.id));
      const ownerMap = await getOwnerMap(supabase);
      const failedIds = new Set<string>();

      for (const [id] of prevMap) {
        if (!nextIds.has(id)) {
          const { error } = await supabase.from(table).delete().eq("id", id);
          if (error) {
            console.error(`[useSupabaseSynced:${table}] delete failed`, error);
            failedIds.add(id);
          }
        }
      }

      const idPatches: Record<string, string> = {};
      for (const item of next) {
        const prevItem = prevMap.get(item.id);
        const own = ownerMap.resolveOwner(m.ownerLocalId(item));
        const row = { ...m.toRow(item), ...staticFieldsRef.current, owner_id: own.owner_id, visibility: own.visibility };
        if (!prevItem) {
          const { data, error } = await supabase.from(table).insert(row).select("id").single();
          if (error) {
            console.error(`[useSupabaseSynced:${table}] insert failed`, error);
            failedIds.add(item.id);
            continue;
          }
          if (data?.id && data.id !== item.id) idPatches[item.id] = data.id;
        } else if (
          JSON.stringify(m.toRow(prevItem)) !== JSON.stringify(m.toRow(item)) ||
          m.ownerLocalId(prevItem) !== m.ownerLocalId(item)
        ) {
          const { error } = await supabase.from(table).update(row).eq("id", item.id);
          if (error) {
            console.error(`[useSupabaseSynced:${table}] update failed`, error);
            failedIds.add(item.id);
          }
        }
      }

      const resolved = next.map((x) => (idPatches[x.id] ? { ...x, id: idPatches[x.id] } : x));
      lastSynced.current = resolved;
      writePendingIds(localStorageKey, failedIds);
      if (failedIds.size > 0) {
        reportError(
          table,
          `Couldn't save ${failedIds.size} change${failedIds.size > 1 ? "s" : ""} to ${friendlyTableName(table)} — retrying automatically. Your data is still here, just not on the server yet.`
        );
      } else {
        clearError(table);
      }
      if (Object.keys(idPatches).length > 0) {
        setValueState((cur) => cur.map((x) => (idPatches[x.id] ? { ...x, id: idPatches[x.id] } : x)));
      }
    },
    [table, localStorageKey]
  );

  const queueSync = useCallback(
    (next: T[]) => {
      const endWrite = beginWrite();
      queueRef.current = queueRef.current
        .then(() => sync(next))
        .catch((err) => {
          console.error(`[useSupabaseSynced:${table}] sync failed`, err);
        })
        .finally(() => endWrite());
    },
    [sync, table]
  );

  useEffect(() => {
    let cachedRows: T[] = [];
    try {
      const raw = window.localStorage.getItem(localStorageKey);
      if (raw) {
        cachedRows = JSON.parse(raw);
        setValueState(cachedRows);
      }
    } catch {
      // ignore malformed cache
    }

    let cancelled = false;
    (async () => {
      const supabase = supabaseRef.current;
      try {
        const ownerMap = await getOwnerMap(supabase);
        let query = supabase.from(table).select("*");
        for (const [k, v] of Object.entries(staticFieldsRef.current)) query = query.eq(k, v as any);
        const { data, error } = await query;
        if (error) throw error;
        if (cancelled || !data) return;
        const serverRows = data.map((row: any) =>
          mapperRef.current.fromRow(row, ownerMap.unresolveOwner(row.owner_id, row.visibility))
        );

        // Self-heal: recover any items a previous session failed to save
        // (write interrupted by refresh/close/offline) instead of letting
        // this fetch silently erase them just because the server hasn't
        // seen them yet.
        const pendingIds = readPendingIds(localStorageKey);
        const serverIds = new Set(serverRows.map((r) => r.id));
        const recovered = cachedRows.filter((r) => pendingIds.has(r.id) && !serverIds.has(r.id));
        const rows = recovered.length > 0 ? [...recovered, ...serverRows] : serverRows;

        // lastSynced reflects confirmed server state only — recovered items
        // are treated as brand-new inserts on the retry below, since the
        // server has never actually seen them.
        lastSynced.current = serverRows;
        setValueState(rows);
        try {
          window.localStorage.setItem(localStorageKey, JSON.stringify(rows));
        } catch {
          // storage full/unavailable — in-memory state still works
        }

        if (recovered.length > 0) {
          console.warn(`[useSupabaseSynced:${table}] recovered ${recovered.length} unsaved item(s) from a previous session, retrying save`);
          queueSync(rows);
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
  }, [table, localStorageKey, queueSync]);

  const setValue = useCallback(
    (updater: T[] | ((prev: T[]) => T[])) => {
      setValueState((prev) => {
        const next = typeof updater === "function" ? (updater as (p: T[]) => T[])(prev) : updater;
        try {
          window.localStorage.setItem(localStorageKey, JSON.stringify(next));
        } catch {
          // storage full/unavailable — in-memory state still works
        }
        if (ready) queueSync(next);
        return next;
      });
    },
    [localStorageKey, ready, queueSync]
  );

  return [value, setValue, { ready }] as const;
}
