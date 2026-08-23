"use client";

// One global "did my data actually save" indicator, mounted once in the
// root layout. Every data hook (useSupabaseSynced, useSchemesSynced,
// useSavingsGoal) reports into lib/supabase/syncStatus.ts, so this shows
// up no matter which page/section triggered the write — the user should
// never have to guess whether something saved or dig into devtools to
// find out. See useSupabaseSynced.ts's header for the incident this was
// built to prevent (allergy entries lost on refresh, 2026-08-23).

import { useSyncExternalStore } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { getSnapshot, subscribe } from "@/lib/supabase/syncStatus";

const emptySnapshot = { pending: 0, errorCount: 0, messages: [] as string[] };

export default function SaveStatusIndicator() {
  const { pending, errorCount, messages } = useSyncExternalStore(subscribe, getSnapshot, () => emptySnapshot);

  if (errorCount > 0) {
    return (
      <div
        className="fixed bottom-4 right-4 z-[100] max-w-xs rounded-xl2 border border-red-500/40 bg-red-950/95 px-3.5 py-2.5 text-xs text-red-100 shadow-lg backdrop-blur"
        role="status"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <AlertTriangle size={13} className="shrink-0" />
          Couldn&rsquo;t save {errorCount} change{errorCount > 1 ? "s" : ""}
        </span>
        <p className="mt-1 text-red-200/80">{messages[0]}</p>
        <p className="mt-1 text-red-200/60">Keep this tab open — it will keep retrying automatically.</p>
      </div>
    );
  }

  if (pending > 0) {
    return (
      <div
        className="fixed bottom-4 right-4 z-[100] flex items-center gap-1.5 rounded-full border border-base-border bg-base-card/95 px-3 py-1.5 text-xs text-gray-300 shadow-lg backdrop-blur"
        role="status"
      >
        <Loader2 size={12} className="animate-spin text-accent-blue" />
        Saving…
      </div>
    );
  }

  return null;
}
