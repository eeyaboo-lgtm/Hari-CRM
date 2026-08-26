"use client";

// Admin "God-mode" banner — 2026-08-26, per Coco's explicit request: admin
// account should be able to dive into any household's real data as if
// signed in as them, with an unmissable reminder that this is happening.
//
// The underlying capability already existed (AdminHouseholdSwitcher in
// Settings sets `admin.viewingHouseholdId` in localStorage; every page's
// household-scoped queries already key off that via HouseholdContext /
// ownerMap.ts) — it just had no visible indicator and was buried in
// Settings, which is why it didn't "feel" like admin mode. This surfaces
// the same switch mechanism globally, with a persistent banner.
//
// Mounted once in app/layout.tsx, inside ProfileGate, above {children} —
// renders nothing for non-admin accounts.

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/HouseholdContext";
import { getAdminViewingHouseholdId, setAdminViewingHousehold } from "@/lib/supabase/ownerMap";

type HouseholdRow = { id: string; name: string };

export default function AdminModeBanner() {
  const { isAdmin, householdName, refreshHousehold } = useHousehold();
  const [households, setHouseholds] = useState<HouseholdRow[]>([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("households").select("id, name").order("name");
      if (!error && data) setHouseholds(data as HouseholdRow[]);
    })();
  }, [isAdmin]);

  if (!isAdmin) return null;

  const pick = async (id: string) => {
    setSwitching(true);
    setOpen(false);
    setAdminViewingHousehold(id || null);
    await refreshHousehold();
    setSwitching(false);
  };

  const currentId = getAdminViewingHouseholdId();

  return (
    <div className="sticky top-0 z-[70] flex flex-wrap items-center justify-between gap-2 border-b border-red-900/40 bg-red-600 px-4 py-2 text-white shadow-lg">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <AlertTriangle size={14} className="shrink-0" />
        Admin Super-Access Mode &mdash; Viewing: {householdName ?? "no household selected"}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-medium hover:bg-white/25"
        >
          {switching ? "Switching..." : "Switch household"} <ChevronDown size={12} />
        </button>
        {open && (
          <div className="absolute right-0 top-full z-10 mt-1 max-h-64 w-56 overflow-y-auto rounded-xl bg-base-card p-1 text-gray-200 shadow-2xl">
            {households.length === 0 && (
              <p className="px-3 py-1.5 text-xs text-gray-500">Loading...</p>
            )}
            {households.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => pick(h.id)}
                className={`block w-full rounded-lg px-3 py-1.5 text-left text-xs hover:bg-white/10 ${
                  h.id === currentId ? "text-accent-purple" : ""
                }`}
              >
                {h.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
