"use client";

// Shared write-status store for every Supabase-backed data hook
// (useSupabaseSynced, useSchemesSynced, useSavingsGoal). One place for the
// whole app to know "is anything still saving right now, and did anything
// fail" instead of each hook only ever logging to the browser console,
// invisible to the person actually using the app.
//
// Root-caused 2026-08-23: a user added 3 allergy history entries, refreshed
// the page to double-check, and lost all three. The write to Supabase was
// still in flight (fire-and-forget, never awaited by the click handler)
// when the refresh cancelled it — and nothing told the user a save was
// still pending, so refreshing felt perfectly safe. This store powers two
// fixes for that: (1) SaveStatusIndicator shows "Saving…" / "Couldn't
// save" so it's visible, and (2) a beforeunload guard below stops a
// refresh/close from silently cutting off an in-progress write.
//
// Any new data hook MUST call beginWrite()/the returned end function around
// every write, and reportError()/clearError() on failure/success — see
// AGENTS.md's "Data-sync & form standards" section. This is not optional;
// it's how the app avoids ever losing typed-in data silently again.

type Listener = () => void;

let pending = 0;
const errors = new Map<string, string>(); // source key (usually table name) -> friendly message
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type SyncSnapshot = { pending: number; errorCount: number; messages: string[] };

let snapshot: SyncSnapshot = { pending: 0, errorCount: 0, messages: [] };

function recompute() {
  snapshot = { pending, errorCount: errors.size, messages: Array.from(errors.values()) };
}

export function getSnapshot(): SyncSnapshot {
  return snapshot;
}

/** Call at the start of any write; call the returned function when it settles (success OR failure). */
export function beginWrite(): () => void {
  pending += 1;
  recompute();
  notify();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    pending = Math.max(0, pending - 1);
    recompute();
    notify();
  };
}

/** source = a stable key for what failed, usually the table name — keeps errors from different hooks distinct. */
export function reportError(source: string, message: string) {
  errors.set(source, message);
  recompute();
  notify();
}

export function clearError(source: string) {
  if (errors.delete(source)) {
    recompute();
    notify();
  }
}

if (typeof window !== "undefined") {
  // Native dialogs can't show custom text in modern browsers, but
  // preventDefault + returnValue still triggers the browser's own "changes
  // you made may not be saved" prompt — which is exactly what we want here:
  // give the user a chance to NOT refresh away an in-flight save.
  window.addEventListener("beforeunload", (e) => {
    if (pending > 0) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}
