"use client";

// Ledger rows (finance_transactions) — one per paid/received occurrence.
// Not on useSupabaseSynced: writes are idempotent upserts keyed by
// (source_kind, source_id, period), so two devices auto-logging the same
// bill can never create duplicates. Unticking keeps the row as
// status='skipped' so auto-log does not re-create it.
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOwnerMap, type OwnerMap } from "@/lib/supabase/ownerMap";
import { beginWrite, clearError, reportError } from "@/lib/supabase/syncStatus";
import type { Occurrence } from "@/lib/ledger";

export type LedgerRow = {
  id: string;
  key: string; // `${source_kind}:${source_id}:${period}`, "" for manual rows
  ownerId: string;
  direction: "in" | "out";
  amount: number;
  currency: string;
  category: string;
  label: string;
  date: string;
  status: "paid" | "skipped";
  auto: boolean;
};

const TABLE = "finance_transactions";

export function useLedger() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [ready, setReady] = useState(false);
  const mapRef = useRef<OwnerMap | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const map = await getOwnerMap(supabase);
    mapRef.current = map;
    const { data, error } = await supabase.from(TABLE).select("*").order("txn_date", { ascending: true });
    if (error) {
      console.error("[useLedger] load failed", error);
      reportError(TABLE, error.message);
      return;
    }
    setRows(
      (data ?? []).map((r: any) => ({
        id: r.id,
        key: r.source_kind && r.source_id && r.period ? `${r.source_kind}:${r.source_id}:${r.period}` : "",
        ownerId: map.unresolveOwner(r.owner_id, r.visibility),
        direction: r.txn_type === "income" ? "in" : "out",
        amount: Number(r.amount) || 0,
        currency: r.currency,
        category: r.category ?? "",
        label: r.description ?? "",
        date: r.txn_date,
        status: r.status === "skipped" ? "skipped" : "paid",
        auto: !!r.auto_logged,
      }))
    );
    setReady(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Upsert occurrences with a status. ignoreExisting=true never overwrites a row the user already set (auto-log). */
  const write = useCallback(
    async (occs: Occurrence[], status: "paid" | "skipped", auto: boolean, ignoreExisting: boolean) => {
      const map = mapRef.current;
      if (!map || occs.length === 0) return;
      const payload = occs.map((o) => {
        const own = map.resolveOwner(o.ownerId);
        return {
          owner_id: own.owner_id,
          visibility: own.visibility,
          txn_type: o.direction === "in" ? "income" : "expense",
          amount: Math.round(o.amount * 100) / 100,
          currency: o.currency,
          category: o.category,
          description: o.label,
          txn_date: o.date,
          source_kind: o.sourceKind,
          source_id: o.sourceId,
          period: o.date,
          status,
          auto_logged: auto,
        };
      });
      // Optimistic local update.
      setRows((prev) => {
        const byKey = new Map(prev.map((r) => [r.key, r]));
        for (const o of occs) {
          const existing = byKey.get(o.key);
          if (existing && ignoreExisting) continue;
          byKey.set(o.key, {
            id: existing?.id ?? `pending-${o.key}`,
            key: o.key, ownerId: o.ownerId, direction: o.direction, amount: o.amount, currency: o.currency,
            category: o.category, label: o.label, date: o.date, status, auto,
          });
        }
        return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date));
      });
      const done = beginWrite();
      const supabase = createClient();
      const { error } = await supabase
        .from(TABLE)
        .upsert(payload, { onConflict: "source_kind,source_id,period", ignoreDuplicates: ignoreExisting });
      done();
      if (error) {
        console.error("[useLedger] upsert failed", error);
        reportError(TABLE, error.message);
        load(); // resync with the server's truth
      } else {
        clearError(TABLE);
      }
    },
    [load]
  );

  const markPaid = useCallback((o: Occurrence) => write([o], "paid", false, false), [write]);
  const unmark = useCallback((o: Occurrence) => write([o], "skipped", false, false), [write]);
  const autoLog = useCallback((occs: Occurrence[]) => write(occs, "paid", true, true), [write]);

  return { rows, ready, markPaid, unmark, autoLog };
}
