"use client";

// Fitness section (2026-08-19) — the app's Health page covered problems
// (conditions, allergies) but had zero fitness/wellness tracking, flagged
// as the single biggest content gap in the 2026-08-19 UI review. Three
// pieces, same household-sync pattern as every other module:
//   1. A BMI calculator (quick, standalone, defaults from your latest log)
//   2. Body measurements history log (weight/height/body fat/waist/chest/
//      hips/arm/thigh/resting HR) — new `health_body_metrics` table
//   3. A Flo-style cycle tracker with calendar-based predictions — new
//      `health_cycle_logs` table. Available to any household member who
//      wants to use it, not gated by anything on the profile.

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useSupabaseSynced } from "@/lib/supabase/useSupabaseSynced";
import { useHousehold } from "@/lib/HouseholdContext";
import { calcBMI, bmiCategory, BMI_CATEGORY_COLOR, predictCycle, type CycleFlow } from "@/lib/fitnessUtils";
import { Check, Pencil, Plus, X, Activity, Calendar as CalendarIcon } from "lucide-react";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
const todayIso = () => new Date().toISOString().slice(0, 10);

const SHARED = { id: "shared", name: "Household (shared)" };
function withShared(members: { id: string; name: string }[]) {
  return [...members, SHARED];
}
function memberName(members: { id: string; name: string }[], id: string) {
  if (id === "shared") return SHARED.name;
  return members.find((m) => m.id === id)?.name ?? "Unassigned";
}

function MemberSelect({
  members,
  value,
  onChange,
}: {
  members: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
    >
      {withShared(members).map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

const numOrUndef = (v: string): number | undefined => (v.trim() === "" ? undefined : Number(v));

/* ---------------------------------------------------------------------- */
/* BMI Calculator                                                          */
/* ---------------------------------------------------------------------- */

function BmiCalculator({ latestForMember }: { latestForMember?: { weightKg?: number; heightCm?: number } }) {
  const [weight, setWeight] = useState(latestForMember?.weightKg ? String(latestForMember.weightKg) : "");
  const [height, setHeight] = useState(latestForMember?.heightCm ? String(latestForMember.heightCm) : "");
  const bmi = calcBMI(Number(weight), Number(height));
  const category = bmi ? bmiCategory(bmi) : null;

  return (
    <section className="glass-card rounded-xl2 p-5">
      <div className="relative z-10 mb-3 flex items-center gap-2">
        <Activity size={16} className="text-accent-blue" />
        <h2 className="font-medium text-white">BMI calculator</h2>
      </div>
      <div className="relative z-10 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Weight (kg)</label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="e.g. 72"
            className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Height (cm)</label>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="e.g. 175"
            className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
          />
        </div>
        <div className="rounded-xl bg-white/[0.03] px-3 py-2.5">
          {bmi && category ? (
            <>
              <p className="text-2xl font-semibold text-white">{bmi.toFixed(1)}</p>
              <p className={`text-xs font-medium ${BMI_CATEGORY_COLOR[category]}`}>{category}</p>
            </>
          ) : (
            <p className="text-xs text-gray-500">Enter weight + height</p>
          )}
        </div>
      </div>
      <p className="relative z-10 mt-3 text-xs text-gray-600">
        BMI is a general screening measure, not a diagnosis — it doesn't distinguish muscle from fat. Logged
        automatically from your latest measurement below when available.
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Body measurements history                                               */
/* ---------------------------------------------------------------------- */

type Measurement = {
  id: string;
  memberId: string;
  entryDate: string;
  weightKg?: number;
  heightCm?: number;
  bodyFatPct?: number;
  waistCm?: number;
  chestCm?: number;
  hipsCm?: number;
  armCm?: number;
  thighCm?: number;
  restingHr?: number;
  notes: string;
};

const MEASUREMENT_FIELDS: { key: keyof Measurement; label: string; unit: string }[] = [
  { key: "weightKg", label: "Weight", unit: "kg" },
  { key: "heightCm", label: "Height", unit: "cm" },
  { key: "bodyFatPct", label: "Body fat", unit: "%" },
  { key: "waistCm", label: "Waist", unit: "cm" },
  { key: "chestCm", label: "Chest", unit: "cm" },
  { key: "hipsCm", label: "Hips", unit: "cm" },
  { key: "armCm", label: "Arm", unit: "cm" },
  { key: "thighCm", label: "Thigh", unit: "cm" },
  { key: "restingHr", label: "Resting HR", unit: "bpm" },
];

function MeasurementCard({
  entry,
  members,
  onUpdate,
  onRemove,
}: {
  entry: Measurement;
  members: { id: string; name: string }[];
  onUpdate: (m: Measurement) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const bmi = calcBMI(entry.weightKg ?? 0, entry.heightCm ?? 0);

  if (editing) {
    return (
      <div className="rounded-xl border border-accent-purple/40 bg-base-card/60 p-3 text-sm">
        <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MemberSelect members={members} value={entry.memberId} onChange={(id) => onUpdate({ ...entry, memberId: id })} />
          <input
            type="date"
            value={entry.entryDate}
            onChange={(e) => onUpdate({ ...entry, entryDate: e.target.value })}
            className="rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
          />
          {MEASUREMENT_FIELDS.map((f) => (
            <div key={String(f.key)}>
              <label className="mb-1 block text-[11px] text-gray-500">{f.label} ({f.unit})</label>
              <input
                type="number"
                value={(entry[f.key] as number | undefined) ?? ""}
                onChange={(e) => onUpdate({ ...entry, [f.key]: numOrUndef(e.target.value) })}
                className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
              />
            </div>
          ))}
          <input
            value={entry.notes}
            onChange={(e) => onUpdate({ ...entry, notes: e.target.value })}
            placeholder="Notes"
            className="col-span-2 rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple sm:col-span-3"
          />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setEditing(false)} className="text-accent-green hover:text-white" title="Done">
            <Check size={16} />
          </button>
          <button type="button" onClick={onRemove} className="text-gray-500 hover:text-red-400" title="Remove">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  const summary = MEASUREMENT_FIELDS.filter((f) => entry[f.key] !== undefined)
    .map((f) => `${f.label} ${entry[f.key]}${f.unit}`)
    .join(" · ");

  return (
    <div className="flex items-center justify-between rounded-xl bg-base-card/60 px-3 py-2 text-sm">
      <div>
        <p className="text-gray-200">
          {entry.entryDate} — {memberName(members, entry.memberId)}
          {bmi ? <span className="ml-2 text-xs text-accent-blue">BMI {bmi.toFixed(1)}</span> : null}
        </p>
        <p className="text-xs text-gray-500">{summary || "No measurements recorded"}{entry.notes ? ` · ${entry.notes}` : ""}</p>
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

function MeasurementsSection({ onLatestForActive }: { onLatestForActive: (m: { weightKg?: number; heightCm?: number } | undefined) => void }) {
  const { members, activeMemberId } = useHousehold();
  const [entries, setEntries] = useSupabaseSynced<Measurement>("health_body_metrics", "fitness.measurements", [], {
    ownerLocalId: (m) => m.memberId,
    toRow: (m) => ({
      entry_date: m.entryDate,
      weight_kg: m.weightKg ?? null,
      height_cm: m.heightCm ?? null,
      body_fat_pct: m.bodyFatPct ?? null,
      waist_cm: m.waistCm ?? null,
      chest_cm: m.chestCm ?? null,
      hips_cm: m.hipsCm ?? null,
      arm_cm: m.armCm ?? null,
      thigh_cm: m.thighCm ?? null,
      resting_hr: m.restingHr ?? null,
      notes: m.notes || null,
    }),
    fromRow: (row, ownerId) => ({
      id: row.id,
      memberId: ownerId,
      entryDate: row.entry_date,
      weightKg: row.weight_kg ?? undefined,
      heightCm: row.height_cm ?? undefined,
      bodyFatPct: row.body_fat_pct ?? undefined,
      waistCm: row.waist_cm ?? undefined,
      chestCm: row.chest_cm ?? undefined,
      hipsCm: row.hips_cm ?? undefined,
      armCm: row.arm_cm ?? undefined,
      thighCm: row.thigh_cm ?? undefined,
      restingHr: row.resting_hr ?? undefined,
      notes: row.notes ?? "",
    }),
  });

  const sorted = useMemo(() => [...entries].sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1)), [entries]);

  useEffect(() => {
    const mine = sorted.find((e) => e.memberId === (activeMemberId ?? "shared"));
    onLatestForActive(mine ? { weightKg: mine.weightKg, heightCm: mine.heightCm } : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, activeMemberId]);

  const blankDraft = (): Measurement => ({
    id: "",
    memberId: activeMemberId ?? members[0]?.id ?? "shared",
    entryDate: todayIso(),
    notes: "",
  });
  const [draft, setDraft] = useState<Measurement>(blankDraft());

  const addEntry = () => {
    const hasAnyValue = MEASUREMENT_FIELDS.some((f) => draft[f.key] !== undefined);
    if (!hasAnyValue) return;
    setEntries((prev) => [{ ...draft, id: uid() }, ...prev]);
    setDraft(blankDraft());
  };
  const updateEntry = (id: string, m: Measurement) => setEntries((prev) => prev.map((x) => (x.id === id ? m : x)));
  const removeEntry = (id: string) => setEntries((prev) => prev.filter((x) => x.id !== id));

  return (
    <section className="glass-card rounded-xl2 p-5">
      <div className="relative z-10 mb-4">
        <h2 className="font-medium text-white">Body measurements history</h2>
        <p className="mt-1 text-sm text-gray-400">
          Weight, body fat, and circumference measurements over time — log as often as you actually measure, no
          need to fill every field every time.
        </p>
      </div>

      <div className="relative z-10 mb-4 rounded-xl2 border border-dashed border-base-border bg-base-card/30 p-4">
        <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MemberSelect members={members} value={draft.memberId} onChange={(id) => setDraft({ ...draft, memberId: id })} />
          <input
            type="date"
            value={draft.entryDate}
            onChange={(e) => setDraft({ ...draft, entryDate: e.target.value })}
            className="rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
          />
          <div />
          {MEASUREMENT_FIELDS.map((f) => (
            <div key={String(f.key)}>
              <label className="mb-1 block text-[11px] text-gray-500">{f.label} ({f.unit})</label>
              <input
                type="number"
                value={(draft[f.key] as number | undefined) ?? ""}
                onChange={(e) => setDraft({ ...draft, [f.key]: numOrUndef(e.target.value) })}
                className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
              />
            </div>
          ))}
          <input
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="Notes"
            className="col-span-2 rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple sm:col-span-3"
          />
        </div>
        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white"
        >
          <Plus size={14} /> Log measurement
        </button>
      </div>

      <div className="relative z-10 space-y-2">
        {sorted.length === 0 && <p className="text-xs text-gray-500">Nothing logged yet.</p>}
        {sorted.map((m) => (
          <MeasurementCard key={m.id} entry={m} members={members} onUpdate={(v) => updateEntry(m.id, v)} onRemove={() => removeEntry(m.id)} />
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Cycle tracker                                                           */
/* ---------------------------------------------------------------------- */

type CycleLog = {
  id: string;
  memberId: string;
  entryDate: string;
  flow: CycleFlow;
  symptoms: string[];
  mood: string;
  notes: string;
};

const FLOW_OPTIONS: { value: CycleFlow; label: string }[] = [
  { value: "none", label: "No flow" },
  { value: "spotting", label: "Spotting" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
];

const SYMPTOM_OPTIONS = ["Cramps", "Headache", "Bloating", "Fatigue", "Mood swings", "Acne", "Tender breasts", "Backache"];

function CycleLogRow({
  entry,
  members,
  onUpdate,
  onRemove,
}: {
  entry: CycleLog;
  members: { id: string; name: string }[];
  onUpdate: (c: CycleLog) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const toggleSymptom = (s: string) =>
    onUpdate({ ...entry, symptoms: entry.symptoms.includes(s) ? entry.symptoms.filter((x) => x !== s) : [...entry.symptoms, s] });

  if (editing) {
    return (
      <div className="rounded-xl border border-accent-purple/40 bg-base-card/60 p-3 text-sm">
        <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MemberSelect members={members} value={entry.memberId} onChange={(id) => onUpdate({ ...entry, memberId: id })} />
          <input
            type="date"
            value={entry.entryDate}
            onChange={(e) => onUpdate({ ...entry, entryDate: e.target.value })}
            className="rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
          />
          <select
            value={entry.flow}
            onChange={(e) => onUpdate({ ...entry, flow: e.target.value as CycleFlow })}
            className="rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
          >
            {FLOW_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <input
            value={entry.mood}
            onChange={(e) => onUpdate({ ...entry, mood: e.target.value })}
            placeholder="Mood"
            className="rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
          />
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SYMPTOM_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSymptom(s)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                entry.symptoms.includes(s) ? "border-accent-pink bg-accent-pink/15 text-accent-pink" : "border-base-border text-gray-400 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          value={entry.notes}
          onChange={(e) => onUpdate({ ...entry, notes: e.target.value })}
          placeholder="Notes"
          className="mb-2 w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setEditing(false)} className="text-accent-green hover:text-white" title="Done">
            <Check size={16} />
          </button>
          <button type="button" onClick={onRemove} className="text-gray-500 hover:text-red-400" title="Remove">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-xl bg-base-card/60 px-3 py-2 text-sm">
      <div>
        <p className="text-gray-200">
          {entry.entryDate} — {memberName(members, entry.memberId)}
          <span className="ml-2 text-xs text-accent-pink">{FLOW_OPTIONS.find((f) => f.value === entry.flow)?.label}</span>
        </p>
        <p className="text-xs text-gray-500">
          {[...(entry.symptoms.length ? [entry.symptoms.join(", ")] : []), entry.mood, entry.notes].filter(Boolean).join(" · ") || "No symptoms noted"}
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

function CycleTrackerSection() {
  const { members, activeMemberId } = useHousehold();
  const [entries, setEntries] = useSupabaseSynced<CycleLog>("health_cycle_logs", "fitness.cycleLogs", [], {
    ownerLocalId: (c) => c.memberId,
    toRow: (c) => ({ entry_date: c.entryDate, flow: c.flow, symptoms: c.symptoms, mood: c.mood || null, notes: c.notes || null }),
    fromRow: (row, ownerId) => ({
      id: row.id,
      memberId: ownerId,
      entryDate: row.entry_date,
      flow: row.flow,
      symptoms: row.symptoms ?? [],
      mood: row.mood ?? "",
      notes: row.notes ?? "",
    }),
  });

  const activeId = activeMemberId ?? "shared";
  const sorted = useMemo(() => [...entries].sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1)), [entries]);
  const mine = useMemo(() => entries.filter((e) => e.memberId === activeId), [entries, activeId]);
  const prediction = useMemo(
    () => predictCycle(mine.map((e) => ({ entryDate: e.entryDate, flow: e.flow }))),
    [mine]
  );

  const blankDraft = (): CycleLog => ({ id: "", memberId: activeId, entryDate: todayIso(), flow: "medium", symptoms: [], mood: "", notes: "" });
  const [draft, setDraft] = useState<CycleLog>(blankDraft());
  const toggleDraftSymptom = (s: string) =>
    setDraft((d) => ({ ...d, symptoms: d.symptoms.includes(s) ? d.symptoms.filter((x) => x !== s) : [...d.symptoms, s] }));

  const addEntry = () => {
    setEntries((prev) => [{ ...draft, id: uid() }, ...prev]);
    setDraft(blankDraft());
  };
  const updateEntry = (id: string, c: CycleLog) => setEntries((prev) => prev.map((x) => (x.id === id ? c : x)));
  const removeEntry = (id: string) => setEntries((prev) => prev.filter((x) => x.id !== id));

  return (
    <section className="glass-card rounded-xl2 p-5">
      <div className="relative z-10 mb-4">
        <h2 className="flex items-center gap-2 font-medium text-white">
          <CalendarIcon size={16} className="text-accent-pink" /> Cycle tracker
        </h2>
        <p className="mt-1 text-sm text-gray-400">
          Log flow and symptoms by day for whichever household member wants to track this — predictions below are
          calendar-based estimates from your own logged history, not a diagnosis or a contraceptive method.
        </p>
      </div>

      {prediction.lastStart ? (
        <div className="relative z-10 mb-4 grid grid-cols-2 gap-3 rounded-xl2 bg-white/[0.03] p-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-gray-500">Cycle day</p>
            <p className="text-lg font-semibold text-white">{prediction.cycleDay}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Next period (est.)</p>
            <p className="text-lg font-semibold text-white">{prediction.predictedNextStart}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Fertile window (est.)</p>
            <p className="text-sm font-medium text-accent-pink">{prediction.fertileWindowStart} – {prediction.fertileWindowEnd}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Avg cycle / period</p>
            <p className="text-sm font-medium text-gray-200">
              {prediction.avgCycleLength}d / {prediction.avgPeriodLength}d
              {prediction.usingDefaultCycleLength && <span className="text-gray-500"> (default, log 2+ cycles for a real average)</span>}
            </p>
          </div>
        </div>
      ) : (
        <p className="relative z-10 mb-4 text-xs text-gray-500">
          Log at least one period's start day to see cycle-day tracking; log two full cycles for real predictions
          instead of the 28-day default.
        </p>
      )}

      <div className="relative z-10 mb-4 rounded-xl2 border border-dashed border-base-border bg-base-card/30 p-4">
        <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MemberSelect members={members} value={draft.memberId} onChange={(id) => setDraft({ ...draft, memberId: id })} />
          <input
            type="date"
            value={draft.entryDate}
            onChange={(e) => setDraft({ ...draft, entryDate: e.target.value })}
            className="rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
          />
          <select
            value={draft.flow}
            onChange={(e) => setDraft({ ...draft, flow: e.target.value as CycleFlow })}
            className="rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
          >
            {FLOW_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <input
            value={draft.mood}
            onChange={(e) => setDraft({ ...draft, mood: e.target.value })}
            placeholder="Mood"
            className="rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
          />
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SYMPTOM_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleDraftSymptom(s)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                draft.symptoms.includes(s) ? "border-accent-pink bg-accent-pink/15 text-accent-pink" : "border-base-border text-gray-400 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          placeholder="Notes"
          className="mb-2 w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        <button type="button" onClick={addEntry} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
          <Plus size={14} /> Log day
        </button>
      </div>

      <div className="relative z-10 space-y-2">
        {sorted.length === 0 && <p className="text-xs text-gray-500">Nothing logged yet.</p>}
        {sorted.map((c) => (
          <CycleLogRow key={c.id} entry={c} members={members} onUpdate={(v) => updateEntry(c.id, v)} onRemove={() => removeEntry(c.id)} />
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */

export default function FitnessPage() {
  const [latestForActive, setLatestForActive] = useState<{ weightKg?: number; heightCm?: number } | undefined>();

  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Fitness</h1>
          <p className="mt-1 text-sm text-gray-400">
            BMI, body measurements, and cycle tracking — everything syncs live to your household database, same as
            Health.
          </p>
        </div>
        <BmiCalculator latestForMember={latestForActive} />
        <MeasurementsSection onLatestForActive={setLatestForActive} />
        <CycleTrackerSection />
      </main>
    </div>
  );
}
