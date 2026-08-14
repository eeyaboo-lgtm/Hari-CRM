"use client";

import { useEffect, useState } from "react";

// Simple client-side persistence until Supabase tables are wired up for
// each module. Reads localStorage after mount (avoids SSR/hydration
// mismatch), then keeps localStorage in sync with state on every change.
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      // malformed or inaccessible storage — fall back to initialValue
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full/unavailable — fail silently, in-memory state still works
    }
  }, [key, value, hydrated]);

  return [value, setValue] as const;
}
