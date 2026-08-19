"use client";

// Admin-only: every household at a glance (member count, who's the head,
// last time anyone in it signed in) plus a one-click JSON backup per
// household. See app/settings/actions.ts for the server-side queries —
// this component only renders what those return.

import { useEffect, useState } from "react";
import { Building2, Download, RefreshCw } from "lucide-react";
import { listHouseholdsOverview, backupHousehold, type HouseholdOverviewRow } from "@/app/settings/actions";

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
                <button
                  type="button"
                  onClick={() => downloadBackup(h.householdId)}
                  disabled={backingUpId === h.householdId}
                  className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 hover:text-white disabled:opacity-50"
                >
                  <Download size={13} />
                  {backingUpId === h.householdId ? "Exporting..." : "Backup"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
