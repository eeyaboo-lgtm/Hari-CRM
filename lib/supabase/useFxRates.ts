"use client";

// Read-only hook for the `fx_rates` lookup table — no owner/visibility
// concept (rates aren't per-person data), so this deliberately does NOT use
// useSupabaseSynced (that hook is for owner-scoped CRUD tables). Fetches
// once on mount, exposes a plain rate map for lib/financeUtils.ts's
// convertAmount()/convertTotalsToCurrency().
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FxRateMap } from "@/lib/financeUtils";

export function useFxRates() {
  const [rates, setRates] = useState<FxRateMap>({});
  const [loaded, setLoaded] = useState(false);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabaseRef.current
        .from("fx_rates")
        .select("base_currency,target_currency,rate");
      if (cancelled) return;
      if (error) {
        console.error("[useFxRates] load failed", error);
      } else if (data) {
        const map: FxRateMap = {};
        for (const row of data as any[]) {
          map[`${row.base_currency}_${row.target_currency}`] = Number(row.rate) || 0;
        }
        setRates(map);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { rates, loaded };
}
