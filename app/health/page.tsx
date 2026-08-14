"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { Plus, X } from "lucide-react";

type Entry = { id: string; text: string; when?: string };

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function EntryList({
  title,
  storageKey,
  placeholder,
  withDate,
}: {
  title: string;
  storageKey: string;
  placeholder: string;
  withDate?: boolean;
}) {
  const [entries, setEntries] = useLocalStorage<Entry[]>(storageKey, []);
  const [text, setText] = useState("");
  const [when, setWhen] = useState("");

  const add = () => {
    if (!text.trim()) return;
    setEntries((prev) => [...prev, { id: uid(), text: text.trim(), when: when || undefined }]);
    setText("");
    setWhen("");
  };
  const remove = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));

  return (
    <div className="glass-card rounded-xl2 p-5">
      <h2 className="relative z-10 mb-3 font-medium text-white">{title}</h2>
      <div className="relative z-10 mb-3 flex flex-wrap gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        {withDate && (
          <input
            type="date"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
          />
        )}
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white"
        >
          <Plus size={14} /> Add
        </button>
      </div>
      <div className="relative z-10 space-y-2">
        {entries.length === 0 && <p className="text-xs text-gray-500">Nothing logged yet.</p>}
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-xl bg-base-card/60 px-3 py-2 text-sm">
            <div>
              <p className="text-gray-200">{e.text}</p>
              {e.when && <p className="text-xs text-gray-500">{e.when}</p>}
            </div>
            <button type="button" onClick={() => remove(e.id)} className="text-gray-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HealthPage() {
  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Health & Insurance</h1>
          <p className="mt-1 text-sm text-gray-400">
            Records, appointments, and log notes — saved on this device for now, will move to Supabase
            (health_records, health_appointments, health_log_notes) once wired up. Documents will upload to a
            private storage bucket with signed-URL access only (SECURITY.md §4).
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <EntryList title="Conditions & history" storageKey="health.conditions" placeholder="e.g. Seasonal allergies" />
          <EntryList title="Appointments" storageKey="health.appointments" placeholder="e.g. Dentist checkup" withDate />
          <EntryList title="Log notes" storageKey="health.notes" placeholder="e.g. Refilled prescription" withDate />
        </div>
      </main>
    </div>
  );
}
