"use client";

// Life Goals & Trips — bucket-list/travel tracker, shared by default (same
// spirit as the mood board above it: either of you can add/edit/remove).
// localStorage-backed for now, same as every other module pending the
// Supabase wiring pass (see HANDOVER.md).
import { useLocalStorage } from "@/lib/useLocalStorage";
import { Plane, Sparkle, Target, Plus, Trash2 } from "lucide-react";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

type GoalType = "trip" | "experience" | "goal";
type GoalStatus = "idea" | "planned" | "booked" | "done";

type LifeGoal = {
  id: string;
  type: GoalType;
  title: string;
  target: string; // freeform timeframe, e.g. "2027", "Dec 2026", "Someday"
  notes: string;
  status: GoalStatus;
};

const TYPE_META: Record<GoalType, { label: string; icon: typeof Plane }> = {
  trip: { label: "Trip", icon: Plane },
  experience: { label: "Experience", icon: Sparkle },
  goal: { label: "Life goal", icon: Target },
};

const STATUS_META: Record<GoalStatus, { label: string; color: string }> = {
  idea: { label: "Idea", color: "bg-white/10 text-gray-300 border-white/10" },
  planned: { label: "Planned", color: "bg-accent-blue/15 text-accent-blue border-accent-blue/30" },
  booked: { label: "Booked", color: "bg-accent-orange/15 text-accent-orange border-accent-orange/30" },
  done: { label: "Done", color: "bg-accent-green/15 text-accent-green border-accent-green/30" },
};

const STATUS_ORDER: GoalStatus[] = ["booked", "planned", "idea", "done"];

function GoalCard({ goal, onUpdate, onRemove }: { goal: LifeGoal; onUpdate: (g: LifeGoal) => void; onRemove: () => void }) {
  const Icon = TYPE_META[goal.type].icon;
  return (
    <div
      className={`rounded-xl2 border border-base-border bg-base-card/40 p-4 ${
        goal.status === "done" ? "opacity-60" : ""
      }`}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-accent-purple">
          <Icon size={16} />
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Title</label>
            <input
              value={goal.title}
              onChange={(e) => onUpdate({ ...goal, title: e.target.value })}
              placeholder="e.g. Japan in cherry blossom season"
              className={`w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm outline-none focus:border-accent-purple ${
                goal.status === "done" ? "text-gray-400 line-through" : "text-gray-100"
              }`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Target</label>
            <input
              value={goal.target}
              onChange={(e) => onUpdate({ ...goal, target: e.target.value })}
              placeholder="e.g. 2027, Dec 2026, Someday"
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Type</label>
            <select
              value={goal.type}
              onChange={(e) => onUpdate({ ...goal, type: e.target.value as GoalType })}
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            >
              {(Object.keys(TYPE_META) as GoalType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_META[t].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Status</label>
            <select
              value={goal.status}
              onChange={(e) => onUpdate({ ...goal, status: e.target.value as GoalStatus })}
              className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            >
              {(Object.keys(STATUS_META) as GoalStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" onClick={onRemove} className="mt-1 shrink-0 text-gray-500 hover:text-red-400" title="Remove">
          <Trash2 size={16} />
        </button>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500">Notes</label>
        <textarea
          value={goal.notes}
          onChange={(e) => onUpdate({ ...goal, notes: e.target.value })}
          placeholder="Budget, who's coming, must-see list, requirements..."
          rows={2}
          className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
      </div>
      <span className={`relative z-10 mt-3 inline-block rounded-full border px-2.5 py-0.5 text-xs ${STATUS_META[goal.status].color}`}>
        {STATUS_META[goal.status].label}
      </span>
    </div>
  );
}

export default function VisionGoals() {
  const [goals, setGoals] = useLocalStorage<LifeGoal[]>("vision.goals", []);

  const addGoal = (type: GoalType) => {
    setGoals((prev) => [
      { id: uid(), type, title: "", target: "", notes: "", status: "idea" },
      ...prev,
    ]);
  };
  const updateGoal = (id: string, g: LifeGoal) => setGoals((prev) => prev.map((x) => (x.id === id ? g : x)));
  const removeGoal = (id: string) => setGoals((prev) => prev.filter((x) => x.id !== id));

  const sorted = [...goals].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  const doneCount = goals.filter((g) => g.status === "done").length;

  return (
    <section className="glass-card rounded-xl2 p-5">
      <div className="relative z-10 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-white">Life goals &amp; trips</h2>
          <p className="mt-1 text-sm text-gray-400">
            Bucket list, travel plans, and shared experiences — shared by default.
            {goals.length > 0 ? ` ${doneCount}/${goals.length} done.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addGoal("trip")}
            className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white"
          >
            <Plus size={14} /> Trip
          </button>
          <button
            type="button"
            onClick={() => addGoal("experience")}
            className="flex items-center gap-1 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-200 hover:border-accent-purple"
          >
            <Plus size={14} /> Experience
          </button>
          <button
            type="button"
            onClick={() => addGoal("goal")}
            className="flex items-center gap-1 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-200 hover:border-accent-purple"
          >
            <Plus size={14} /> Life goal
          </button>
        </div>
      </div>
      <div className="relative z-10 space-y-3">
        {sorted.length === 0 && <p className="text-xs text-gray-500">Nothing on the list yet — add a trip, experience, or goal above.</p>}
        {sorted.map((g) => (
          <GoalCard key={g.id} goal={g} onUpdate={(v) => updateGoal(g.id, v)} onRemove={() => removeGoal(g.id)} />
        ))}
      </div>
    </section>
  );
}
