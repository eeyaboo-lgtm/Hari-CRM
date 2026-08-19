"use client";

// Admin-only: every household at a glance (member count, who's the head,
// last time anyone in it signed in) plus a one-click JSON backup per
// household. See app/settings/actions.ts for the server-side queries —
// this component only renders what those return.

import { useEffect, useRef, useState } from "react";
import { Building2, Download, RefreshCw, Upload } from "lucide-react";
import { listHouseholdsOverview, backupHousehold, restoreHousehold, type HouseholdOverviewRow } from "@/app/settings/actions";

function timeAgo(iso: string | null): string {
  if (!iso) return "Never signed in";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function AdminHouseholdOverview() {
  const [rows, setRows] = useState<HouseholdOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [backingUpId, setBackingUpId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; name: string; snapshot: Record<string, unknown> } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<string>("");
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await listHouseholdsOverview();
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load households");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const downloadBackup = async (householdId: string) => {
    setBackingUpId(householdId);
    setError("");
    try {
      const result = await backupHousehold(householdId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setBackingUpId(null);
    }
  };

  const pickRestoreFile = (householdId: string, householdName: string) => {
    const input = fileInputs.current[householdId];
    if (!input) return;
    input.value = "";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const snapshot = JSON.parse(text);
        setRestoreResult("");
        setConfirmText("");
        setRestoreTarget({ id: householdId, name: householdName, snapshot });
      } catch {
        setError("That file isn't valid JSON — pick the exact file downloaded from \"Backup\".");
      }
    };
    input.click();
  };

  const runRestore = async () => {
    if (!restoreTarget || confirmText !== restoreTarget.name) return;
    setRestoring(true);
    setRestoreResult("");
    try {
      const result = await restoreHousehold(restoreTarget.id, restoreTarget.snapshot);
      if (!result.ok) {
        setRestoreResult(`Failed: ${result.error}`);
        return;
      }
      const failed = Object.entries(result.restored).filter(([, n]) => n < 0);
      const totalRows = Object.values(result.restored).reduce((sum, n) => sum + Math.max(n, 0), 0);
      setRestoreResult(
        failed.length > 0
          ? `Restored ${totalRows} rows, but ${failed.length} table(s) failed: ${failed.map(([t]) => t).join(", ")}`
          : `Restored ${totalRows} rows across ${Object.keys(result.restored).length} tables.`
      );
    } catch (err) {
      setRestoreResult(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="glass-card rounded-xl2 p-5">
      <div className="relative z-10 mb-1 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-medium text-white">
          <Building2 size={16} className="text-accent-orange" /> Admin — all households
        </h3>
        <button type="button" onClick={load} className="text-gray-500 hover:text-white">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <p className="relative z-10 mb-4 text-xs text-gray-500">
        Every household on the platform, with a downloadable JSON backup of its data — useful before a reset, or as
        a portable copy if you ever migrate off this host.
      </p>

      {error && <p className="relative z-10 mb-3 text-xs text-red-400">{error}</p>}

      {loading ? (
        <p className="relative z-10 text-xs text-gray-500">Loading households...</p>
      ) : rows.length === 0 ? (
        <p className="relative z-10 text-xs text-gray-500">No households yet.</p>
      ) : (
        <div className="relative z-10 space-y-2">
          {rows.map((h) => (
            <div key={h.householdId} className="rounded-xl bg-white/[0.03] px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{h.householdName}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {h.memberCount} member{h.memberCount !== 1 ? "s" : ""}
                    {h.ownerName ? ` · head: ${h.ownerName}` : ""} · last active {timeAgo(h.lastActiveAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadBackup(h.householdId)}
                    disabled={backingUpId === h.householdId}
                    className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 hover:text-white disabled:opacity-50"
                  >
                    <Download size={13} />
                    {backingUpId === h.householdId ? "Exporting..." : "Backup"}
                  </button>
                  <button
                    type="button"
                    onClick={() => pickRestoreFile(h.householdId, h.householdName)}
                    className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 hover:text-white"
                    title="Restore this household's data from a backup file"
                  >
                    <Upload size={13} />
                    Restore
                  </button>
                  <input
                    ref={(el) => {
                      fileInputs.current[h.householdId] = el;
                    }}
                    type="file"
                    accept="application/json"
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="glass-card w-full max-w-md rounded-xl2 p-5">
            <h4 className="relative z-10 mb-2 font-medium text-white">Restore "{restoreTarget.name}"?</h4>
            <p className="relative z-10 mb-3 text-xs text-gray-400">
              This <span className="text-red-400">deletes and replaces</span> every content row (Health, Finance,
              Business, Vision, Memberships) currently owned by this household's members with what's in the file you
              picked. It does not touch logins, PINs, or the household itself. This can't be undone — take a fresh
              "Backup" first if you're not sure.
            </p>
            <p className="relative z-10 mb-1 text-xs text-gray-500">
              Type <span className="font-mono text-gray-300">{restoreTarget.name}</span> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="relative z-10 mb-3 w-full rounded-lg border border-base-border bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent-orange"
              placeholder={restoreTarget.name}
            />
            {restoreResult && <p className="relative z-10 mb-3 text-xs text-gray-300">{restoreResult}</p>}
            <div className="relative z-10 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRestoreTarget(null);
                  setRestoreResult("");
                }}
                className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                {restoreResult ? "Close" : "Cancel"}
              </button>
              {!restoreResult && (
                <button
                  type="button"
                  onClick={runRestore}
                  disabled={confirmText !== restoreTarget.name || restoring}
                  className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/30 disabled:opacity-40"
                >
                  {restoring ? "Restoring..." : "Restore & overwrite"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
