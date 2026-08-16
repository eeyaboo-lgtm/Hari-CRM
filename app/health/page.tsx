"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useSupabaseSynced } from "@/lib/supabase/useSupabaseSynced";
import { useHousehold } from "@/lib/HouseholdContext";
import { Check, Download, ExternalLink, FileUp, Pencil, Plus, Trash2, X } from "lucide-react";

type AllergyStatus = "confirmed" | "suspected" | "safe";

const ALLERGY_STATUS_META: Record<AllergyStatus, { label: string; color: string }> = {
  confirmed: { label: "Confirmed reaction", color: "bg-red-500/15 text-red-300 border-red-500/30" },
  suspected: { label: "Suspected / likely", color: "bg-accent-orange/15 text-accent-orange border-accent-orange/30" },
  safe: { label: "Tested — safe", color: "bg-accent-green/15 text-accent-green border-accent-green/30" },
};
// Bug fixed 2026-08-16: a stray row in the live DB had a non-enum status
// value ("archived_orphan_test_row", from an earlier session's attempt to
// flag an orphaned test row without a working notes-column write). Looking
// up an unrecognized status in ALLERGY_STATUS_META returned undefined, and
// reading .color/.label off that crashed the ENTIRE Health page render for
// every user -- not just that one row. This is exactly what looked like
// "add/save buttons not working" from the outside: the whole page went
// blank, so nothing on it was interactive. Fallback so an unexpected value
// degrades to a neutral badge instead of taking the page down.
const UNKNOWN_ALLERGY_STATUS_META = { label: "Unknown status", color: "bg-white/10 text-gray-400 border-white/10" };
function allergyStatusMeta(status: AllergyStatus) {
  return ALLERGY_STATUS_META[status] ?? UNKNOWN_ALLERGY_STATUS_META;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
const todayIso = () => new Date().toISOString().slice(0, 10);

type FileDoc = { name: string; mime: string; dataUrl: string };

function readFileAsDataUrl(file: File): Promise<FileDoc> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, mime: file.type, dataUrl: reader.result as string });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Member quick-selector used on every "add" form across Health — dropdown of
// the real household members from Settings, defaulting to whoever's active.
function MemberSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { members } = useHousehold();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
    >
      {withShared(members).map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

// Matches Finance's "Shared" convention: a selectable option, not a real
// profile, for anything jointly owned by the household rather than one
// member. Without this, forms could only submit a real member id or "",
// and unresolveOwner's "shared" fallback (visibility=mirrored_edit) had
// no matching <option> — the browser then silently rendered whichever
// member happened to be first in the list instead of the true owner.
const SHARED = { id: "shared", name: "Household (shared)" };

function withShared(members: { id: string; name: string }[]) {
  return [...members, SHARED];
}

function memberName(members: { id: string; name: string }[], id: string) {
  if (id === "shared") return SHARED.name;
  return members.find((m) => m.id === id)?.name ?? "Unassigned";
}

/* ---------------------------------------------------------------------- */
/* Conditions & History                                                    */
/* ---------------------------------------------------------------------- */

type Condition = { id: string; memberId: string; text: string; date?: string };

function ConditionRow({
  entry,
  members,
  onUpdate,
  onRemove,
}: {
  entry: Condition;
  members: { id: string; name: string }[];
  onUpdate: (c: Condition) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent-purple/40 bg-base-card/60 px-3 py-2 text-sm">
        <MemberSelect value={entry.memberId} onChange={(id) => onUpdate({ ...entry, memberId: id })} />
        <input
          value={entry.text}
          onChange={(e) => onUpdate({ ...entry, text: e.target.value })}
          className="min-w-0 flex-1 rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        <input
          type="date"
          value={entry.date ?? ""}
          onChange={(e) => onUpdate({ ...entry, date: e.target.value || undefined })}
          className="rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        <button type="button" onClick={() => setEditing(false)} className="text-accent-green hover:text-white" title="Done">
          <Check size={16} />
        </button>
        <button type="button" onClick={onRemove} className="text-gray-500 hover:text-red-400" title="Remove">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-xl bg-base-card/60 px-3 py-2 text-sm">
      <div>
        <p className="text-gray-200">{entry.text}</p>
        <p className="text-xs text-gray-500">
          {memberName(members, entry.memberId)}
          {entry.date ? ` · ${entry.date}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setEditing(true)} className="text-gray-500 hover:text-white" title="Edit">
          <Pencil size={13} />
        </button>
        <button type="button" onClick={onRemove} className="text-gray-500 hover:text-white" title="Remove">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function ConditionsSection() {
  const { members, activeMemberId } = useHousehold();
  const [entries, setEntries] = useSupabaseSynced<Condition>(
    "health_records",
    "health.conditions",
    [],
    {
      ownerLocalId: (c) => c.memberId,
      toRow: (c) => ({ title: c.text, record_date: c.date || null }),
      fromRow: (row, ownerId) => ({ id: row.id, memberId: ownerId, text: row.title, date: row.record_date ?? undefined }),
    },
    { record_type: "condition" }
  );
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [memberId, setMemberId] = useState(activeMemberId ?? members[0]?.id ?? "");

  const add = () => {
    if (!text.trim()) return;
    setEntries((prev) => [...prev, { id: uid(), memberId: memberId || members[0]?.id, text: text.trim(), date: date || undefined }]);
    setText("");
    setDate("");
  };
  const remove = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));

  return (
    <section className="glass-card rounded-xl2 p-5">
      <h2 className="relative z-10 mb-3 font-medium text-white">Conditions &amp; history</h2>
      <div className="relative z-10 mb-3 flex flex-wrap gap-2">
        <MemberSelect value={memberId} onChange={setMemberId} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="e.g. Seasonal allergies, past surgery, ongoing condition"
          className="min-w-0 flex-1 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        <button type="button" onClick={add} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
          <Plus size={14} /> Add
        </button>
      </div>
      <div className="relative z-10 space-y-2">
        {entries.length === 0 && <p className="text-xs text-gray-500">Nothing logged yet.</p>}
        {entries.map((e) => (
          <ConditionRow key={e.id} entry={e} members={members} onUpdate={(v) => setEntries((prev) => prev.map((x) => (x.id === e.id ? v : x)))} onRemove={() => remove(e.id)} />
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Allergies — trial-and-error reaction history                            */
/* ---------------------------------------------------------------------- */

type AllergyEntry = {
  id: string;
  memberId: string;
  trigger: string;
  status: AllergyStatus;
  reaction: string;
  date: string;
  notes: string;
};

function AllergyCard({
  entry,
  onUpdate,
  onRemove,
}: {
  entry: AllergyEntry;
  onUpdate: (e: AllergyEntry) => void;
  onRemove: () => void;
}) {
  const { members } = useHousehold();
  const meta = allergyStatusMeta(entry.status);
  // See the matching comment on MembershipCard: collapses to a compact
  // summary card once it has a trigger name; fields auto-save on every
  // keystroke already, so "Done" just collapses the card.
  const [editing, setEditing] = useState(!entry.trigger);

  if (!editing) {
    return (
      <div className="rounded-xl2 border border-base-border bg-base-card/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{entry.trigger || "Untitled allergy"}</p>
            <p className="text-xs text-gray-500">
              {withShared(members).find((m) => m.id === entry.memberId)?.name ?? entry.memberId}
              {entry.date ? ` · ${entry.date}` : ""}
              {entry.reaction ? ` · ${entry.reaction}` : ""}
            </p>
            <span className={`relative z-10 mt-2 inline-block rounded-full border px-2.5 py-0.5 text-xs ${meta.color}`}>{meta.label}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setEditing(true)} className="text-gray-500 hover:text-white" title="Edit">
              <Pencil size={14} />
            </button>
            <button type="button" onClick={onRemove} className="text-gray-500 hover:text-red-400" title="Remove">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl2 border border-accent-purple/40 bg-base-card/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Household member</label>
            <select
              value={entry.memberId}
              onChange={(e) => onUpdate({ ...entry, memberId: e.target.value })}
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            >
              {withShared(members).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Trigger / substance</label>
            <input
              value={entry.trigger}
              onChange={(e) => onUpdate({ ...entry, trigger: e.target.value })}
              placeholder="e.g. Penicillin, peanuts, shellfish"
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Status</label>
            <select
              value={entry.status}
              onChange={(e) => onUpdate({ ...entry, status: e.target.value as AllergyStatus })}
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            >
              {(Object.keys(ALLERGY_STATUS_META) as AllergyStatus[]).map((s) => (
                <option key={s} value={s}>
                  {ALLERGY_STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Date noted</label>
            <input
              type="date"
              value={entry.date}
              onChange={(e) => onUpdate({ ...entry, date: e.target.value })}
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
        </div>
        <div className="mt-1 flex shrink-0 flex-col items-center gap-2">
          <button type="button" onClick={() => setEditing(false)} className="text-accent-green hover:text-white" title="Done">
            <Check size={16} />
          </button>
          <button type="button" onClick={onRemove} className="text-gray-500 hover:text-red-400" title="Remove">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-xs text-gray-500">Reaction / symptoms observed</label>
        <input
          value={entry.reaction}
          onChange={(e) => onUpdate({ ...entry, reaction: e.target.value })}
          placeholder="e.g. Hives, swelling, no reaction after trial dose"
          className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-xs text-gray-500">Notes</label>
        <textarea
          value={entry.notes}
          onChange={(e) => onUpdate({ ...entry, notes: e.target.value })}
          placeholder="Context — how it was tried, dosage, what triggered the trial, doctor advice..."
          rows={2}
          className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
      </div>
      <span className={`relative z-10 inline-block rounded-full border px-2.5 py-0.5 text-xs ${meta.color}`}>{meta.label}</span>
    </div>
  );
}

function AllergiesSection() {
  const { members, activeMemberId } = useHousehold();
  const [entries, setEntries] = useSupabaseSynced<AllergyEntry>("health_allergies", "health.allergies", [], {
    ownerLocalId: (a) => a.memberId,
    toRow: (a) => ({ trigger_name: a.trigger, status: a.status, reaction: a.reaction || null, entry_date: a.date || null, notes: a.notes || null }),
    fromRow: (row, ownerId) => ({ id: row.id, memberId: ownerId, trigger: row.trigger_name, status: row.status, reaction: row.reaction ?? "", date: row.entry_date ?? "", notes: row.notes ?? "" }),
  });

  // Draft form for a brand-new entry — nothing is saved to the household
  // database until "Add allergy" is clicked with a trigger name filled in.
  // (Previously "Add" immediately inserted a blank row that then lived in
  // Supabase from the first keystroke, with no clear save moment — that's
  // what made it feel like entries just piled up with nothing confirming
  // they'd saved. This now matches how Conditions/Appointments work.)
  const blankDraft = (): AllergyEntry => ({
    id: "",
    memberId: activeMemberId ?? members[0]?.id ?? "shared",
    trigger: "",
    status: "suspected",
    reaction: "",
    date: "",
    notes: "",
  });
  const [draft, setDraft] = useState<AllergyEntry>(blankDraft());

  const addEntry = () => {
    if (!draft.trigger.trim()) return;
    setEntries((prev) => [{ ...draft, id: uid(), trigger: draft.trigger.trim() }, ...prev]);
    setDraft(blankDraft());
  };
  const updateEntry = (id: string, e: AllergyEntry) => setEntries((prev) => prev.map((x) => (x.id === id ? e : x)));
  const removeEntry = (id: string) => setEntries((prev) => prev.filter((x) => x.id !== id));

  const confirmedCount = entries.filter((e) => e.status === "confirmed").length;

  return (
    <section className="glass-card rounded-xl2 p-5">
      <div className="relative z-10 mb-4">
        <h2 className="font-medium text-white">Allergy history</h2>
        <p className="mt-1 text-sm text-gray-400">
          Trial-and-error log — what's caused a reaction, what's only suspected, and what's been tested and
          found safe.
          {entries.length > 0 ? ` ${confirmedCount} confirmed of ${entries.length} logged.` : ""}
        </p>
      </div>

      <div className="relative z-10 mb-4 rounded-xl2 border border-dashed border-base-border bg-base-card/30 p-4">
        <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Household member</label>
            <select
              value={draft.memberId}
              onChange={(e) => setDraft({ ...draft, memberId: e.target.value })}
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            >
              {withShared(members).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Trigger / substance</label>
            <input
              value={draft.trigger}
              onChange={(e) => setDraft({ ...draft, trigger: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && addEntry()}
              placeholder="e.g. Penicillin, peanuts, shellfish"
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={addEntry}
          disabled={!draft.trigger.trim()}
          className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white disabled:opacity-40"
        >
          <Plus size={14} /> Add allergy
        </button>
        <p className="mt-2 text-xs text-gray-600">Saved once you click Add — set status, reaction and notes on the card below afterward.</p>
      </div>

      <div className="relative z-10 space-y-3">
        {entries.length === 0 && <p className="text-xs text-gray-500">Nothing logged yet.</p>}
        {entries.map((e) => (
          <AllergyCard key={e.id} entry={e} onUpdate={(v) => updateEntry(e.id, v)} onRemove={() => removeEntry(e.id)} />
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Appointments                                                            */
/* ---------------------------------------------------------------------- */

type Appointment = { id: string; memberId: string; text: string; date?: string; provider?: string };

function AppointmentRow({
  entry,
  members,
  onUpdate,
  onRemove,
}: {
  entry: Appointment;
  members: { id: string; name: string }[];
  onUpdate: (a: Appointment) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent-purple/40 bg-base-card/60 px-3 py-2 text-sm">
        <MemberSelect value={entry.memberId} onChange={(id) => onUpdate({ ...entry, memberId: id })} />
        <input
          value={entry.text}
          onChange={(e) => onUpdate({ ...entry, text: e.target.value })}
          className="min-w-0 flex-1 rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        <input
          value={entry.provider ?? ""}
          onChange={(e) => onUpdate({ ...entry, provider: e.target.value || undefined })}
          placeholder="Clinic/doctor"
          className="w-36 rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        <input
          type="date"
          value={entry.date ?? ""}
          onChange={(e) => onUpdate({ ...entry, date: e.target.value || undefined })}
          className="rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        <button type="button" onClick={() => setEditing(false)} className="text-accent-green hover:text-white" title="Done">
          <Check size={16} />
        </button>
        <button type="button" onClick={onRemove} className="text-gray-500 hover:text-red-400" title="Remove">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-xl bg-base-card/60 px-3 py-2 text-sm">
      <div>
        <p className="text-gray-200">{entry.text}</p>
        <p className="text-xs text-gray-500">
          {memberName(members, entry.memberId)}
          {entry.provider ? ` · ${entry.provider}` : ""}
          {entry.date ? ` · ${entry.date}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setEditing(true)} className="text-gray-500 hover:text-white" title="Edit">
          <Pencil size={13} />
        </button>
        <button type="button" onClick={onRemove} className="text-gray-500 hover:text-white" title="Remove">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function AppointmentsSection() {
  const { members, activeMemberId } = useHousehold();
  const [entries, setEntries] = useSupabaseSynced<Appointment>("health_appointments", "health.appointments", [], {
    ownerLocalId: (a) => a.memberId,
    toRow: (a) => ({ title: a.text, doctor: a.provider || null, appointment_at: `${a.date || todayIso()}T00:00:00Z` }),
    fromRow: (row, ownerId) => ({ id: row.id, memberId: ownerId, text: row.title, date: row.appointment_at ? String(row.appointment_at).slice(0, 10) : undefined, provider: row.doctor ?? undefined }),
  });
  const [text, setText] = useState("");
  const [provider, setProvider] = useState("");
  const [date, setDate] = useState("");
  const [memberId, setMemberId] = useState(activeMemberId ?? members[0]?.id ?? "");

  const add = () => {
    if (!text.trim()) return;
    setEntries((prev) => [
      ...prev,
      { id: uid(), memberId: memberId || members[0]?.id, text: text.trim(), date: date || undefined, provider: provider || undefined },
    ]);
    setText("");
    setProvider("");
    setDate("");
  };
  const remove = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const sorted = [...entries].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

  return (
    <section className="glass-card rounded-xl2 p-5">
      <h2 className="relative z-10 mb-3 font-medium text-white">Appointment history</h2>
      <div className="relative z-10 mb-3 flex flex-wrap gap-2">
        <MemberSelect value={memberId} onChange={setMemberId} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="e.g. Dentist checkup"
          className="min-w-0 flex-1 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        <input
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          placeholder="Clinic/doctor (optional)"
          className="w-40 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        <button type="button" onClick={add} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
          <Plus size={14} /> Add
        </button>
      </div>
      <div className="relative z-10 space-y-2">
        {sorted.length === 0 && <p className="text-xs text-gray-500">No appointments logged yet.</p>}
        {sorted.map((e) => (
          <AppointmentRow key={e.id} entry={e} members={members} onUpdate={(v) => setEntries((prev) => prev.map((x) => (x.id === e.id ? v : x)))} onRemove={() => remove(e.id)} />
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Insurance                                                                */
/* ---------------------------------------------------------------------- */

type InsurancePolicy = {
  id: string;
  memberId: string;
  provider: string;
  policyholderName: string;
  expiryDate: string;
  renewalDate: string;
  copays: string;
  allowances: string;
  coverageNotes: string;
  cardFront?: FileDoc;
  cardBack?: FileDoc;
  networkFile?: FileDoc;
  benefitsFile?: FileDoc;
};

function FileSlot({
  label,
  doc,
  onUpload,
  onRemove,
}: {
  label: string;
  doc?: FileDoc;
  onUpload: (f: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl bg-base-card/60 p-3">
      <p className="mb-1.5 text-xs font-medium text-gray-300">{label}</p>
      {!doc ? (
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-accent-blue hover:text-accent-purple">
          <FileUp size={13} />
          Upload
          <input
            type="file"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
            }}
          />
        </label>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-gray-400" title={doc.name}>
            {doc.name}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <a href={doc.dataUrl} target="_blank" rel="noopener noreferrer" title="Open in new tab" className="text-gray-400 hover:text-white">
              <ExternalLink size={13} />
            </a>
            <a href={doc.dataUrl} download={doc.name} title="Download" className="text-gray-400 hover:text-white">
              <Download size={13} />
            </a>
            <button type="button" onClick={onRemove} title="Remove" className="text-gray-500 hover:text-red-400">
              <X size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InsuranceCard({
  policy,
  onUpdate,
  onRemove,
}: {
  policy: InsurancePolicy;
  onUpdate: (p: InsurancePolicy) => void;
  onRemove: () => void;
}) {
  const { members } = useHousehold();
  // See the matching comment on MembershipCard: collapses once a provider
  // is set; fields auto-save on every keystroke, "Done" just collapses it.
  const [editing, setEditing] = useState(!policy.provider);

  const uploadTo = async (field: keyof InsurancePolicy, file: File) => {
    const doc = await readFileAsDataUrl(file);
    onUpdate({ ...policy, [field]: doc });
  };

  if (!editing) {
    const fileCount = [policy.cardFront, policy.cardBack, policy.networkFile, policy.benefitsFile].filter(Boolean).length;
    return (
      <div className="rounded-xl2 border border-base-border bg-base-card/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{policy.provider || "Untitled policy"}</p>
            <p className="text-xs text-gray-500">
              {withShared(members).find((m) => m.id === policy.memberId)?.name ?? policy.memberId}
              {policy.policyholderName ? ` · ${policy.policyholderName}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {policy.expiryDate && <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-gray-300">Expires {policy.expiryDate}</span>}
              {policy.renewalDate && <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-gray-300">Renews {policy.renewalDate}</span>}
              {fileCount > 0 && <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-gray-300">{fileCount} file{fileCount === 1 ? "" : "s"}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setEditing(true)} className="text-gray-500 hover:text-white" title="Edit">
              <Pencil size={14} />
            </button>
            <button type="button" onClick={onRemove} className="text-gray-500 hover:text-red-400" title="Remove policy">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl2 border border-accent-purple/40 bg-base-card/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Household member</label>
            <select
              value={policy.memberId}
              onChange={(e) => onUpdate({ ...policy, memberId: e.target.value })}
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            >
              {withShared(members).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Provider</label>
            <input
              value={policy.provider}
              onChange={(e) => onUpdate({ ...policy, provider: e.target.value })}
              placeholder="e.g. Daman, Bupa, AXA"
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Key policyholder</label>
            <input
              value={policy.policyholderName}
              onChange={(e) => onUpdate({ ...policy, policyholderName: e.target.value })}
              placeholder="e.g. Under spouse's employer plan"
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Expiry date</label>
              <input
                type="date"
                value={policy.expiryDate}
                onChange={(e) => onUpdate({ ...policy, expiryDate: e.target.value })}
                className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Renewal date</label>
              <input
                type="date"
                value={policy.renewalDate}
                onChange={(e) => onUpdate({ ...policy, renewalDate: e.target.value })}
                className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
              />
            </div>
          </div>
        </div>
        <div className="mt-1 flex shrink-0 flex-col items-center gap-2">
          <button type="button" onClick={() => setEditing(false)} className="text-accent-green hover:text-white" title="Done">
            <Check size={16} />
          </button>
          <button type="button" onClick={onRemove} className="text-gray-500 hover:text-red-400" title="Remove policy">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Co-payments</label>
          <textarea
            value={policy.copays}
            onChange={(e) => onUpdate({ ...policy, copays: e.target.value })}
            placeholder="e.g. 20% outpatient, AED 50 GP visit"
            rows={2}
            className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Allowances</label>
          <textarea
            value={policy.allowances}
            onChange={(e) => onUpdate({ ...policy, allowances: e.target.value })}
            placeholder="e.g. Annual dental AED 2,000"
            rows={2}
            className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Coverage notes</label>
          <textarea
            value={policy.coverageNotes}
            onChange={(e) => onUpdate({ ...policy, coverageNotes: e.target.value })}
            placeholder="Anything else worth remembering"
            rows={2}
            className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <FileSlot label="Card — front" doc={policy.cardFront} onUpload={(f) => uploadTo("cardFront", f)} onRemove={() => onUpdate({ ...policy, cardFront: undefined })} />
        <FileSlot label="Card — back" doc={policy.cardBack} onUpload={(f) => uploadTo("cardBack", f)} onRemove={() => onUpdate({ ...policy, cardBack: undefined })} />
        <FileSlot label="Coverage network" doc={policy.networkFile} onUpload={(f) => uploadTo("networkFile", f)} onRemove={() => onUpdate({ ...policy, networkFile: undefined })} />
        <FileSlot label="Benefits table" doc={policy.benefitsFile} onUpload={(f) => uploadTo("benefitsFile", f)} onRemove={() => onUpdate({ ...policy, benefitsFile: undefined })} />
      </div>
    </div>
  );
}

function InsuranceSection() {
  const { members, activeMemberId } = useHousehold();
  const [policies, setPolicies] = useLocalStorage<InsurancePolicy[]>("health.insurance", []);

  const addPolicy = () => {
    setPolicies((prev) => [
      ...prev,
      {
        id: uid(),
        memberId: activeMemberId ?? members[0]?.id ?? "",
        provider: "",
        policyholderName: "",
        expiryDate: "",
        renewalDate: "",
        copays: "",
        allowances: "",
        coverageNotes: "",
      },
    ]);
  };
  const updatePolicy = (id: string, p: InsurancePolicy) => setPolicies((prev) => prev.map((x) => (x.id === id ? p : x)));
  const removePolicy = (id: string) => setPolicies((prev) => prev.filter((x) => x.id !== id));

  return (
    <section className="glass-card rounded-xl2 p-5">
      <div className="relative z-10 mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-medium text-white">Insurance details</h2>
          <p className="mt-1 text-sm text-gray-400">
            Provider, policyholder, key dates, co-pays/allowances, and documents — cards, network file, and
            benefits table can be uploaded, then opened or downloaded any time.
          </p>
        </div>
        <button type="button" onClick={addPolicy} className="flex shrink-0 items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
          <Plus size={14} /> Add policy
        </button>
      </div>
      <div className="relative z-10 space-y-4">
        {policies.length === 0 && <p className="text-xs text-gray-500">No insurance policies added yet.</p>}
        {policies.map((p) => (
          <InsuranceCard key={p.id} policy={p} onUpdate={(v) => updatePolicy(p.id, v)} onRemove={() => removePolicy(p.id)} />
        ))}
      </div>
      <p className="relative z-10 mt-3 text-xs text-gray-600">
        Files are stored on this device for now (data URLs) — large files will move to the private
        health-documents Supabase bucket once that's wired up, same as the vision board photo cap.
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------------- */

export default function HealthPage() {
  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Health &amp; Insurance</h1>
          <p className="mt-1 text-sm text-gray-400">
            Conditions &amp; history, allergies, appointments, and insurance — each entry is tagged to a household
            member. Conditions, allergies and appointments sync live to your household database; insurance
            (including its file uploads) is still local pending a dedicated table.
          </p>
        </div>
        <ConditionsSection />
        <AllergiesSection />
        <AppointmentsSection />
        <InsuranceSection />
      </main>
    </div>
  );
}
